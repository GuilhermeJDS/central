/**
 * Coletor do X (bearer token do cliente). Só servidor.
 *
 * - Token de usuário (OAuth 2.0): /2/users/me acha a conta sozinho.
 * - Bearer de app: precisa do @ do perfil (/2/users/by/username).
 * - Busca recente (virais da semana): /2/tweets/search/recent, se o plano
 *   da API do cliente liberar.
 *
 * Limites: o X manda x-rate-limit-remaining/reset; ao zerar (ou 429), ninguém
 * chama de novo até o reset. Além disso, 60 leituras/hora por token aqui.
 */
import "server-only";

import { campo, impressao, limpar, lista, pedir, texto, type RespostaHttp } from "@/lib/redes/http";
import { bloquearAte, reservar } from "@/lib/redes/limites";
import {
  ErroRede,
  metricas,
  numero,
  type Conexao,
  type Perfil,
  type Publicacao,
  type ResultadoTeste,
} from "@/lib/redes/tipos";

const REDE = "X" as const;
const API = "https://api.x.com/2";
const HORA = 60 * 60 * 1000;
const CAMPOS_USUARIO = "public_metrics,username,name,description";
const CAMPOS_POST = "created_at,public_metrics";

function limparToken(t: string): string {
  return t.trim().replace(/^Bearer\s+/i, "");
}

function erroX(r: RespostaHttp, token: string): ErroRede {
  const detalhe = limpar(
    texto(campo(r.corpo, "detail")) ?? texto(campo(r.corpo, "title")) ?? texto(campo(r.corpo, "errors", 0, "message")),
    [token],
  );
  const motivo = texto(campo(r.corpo, "reason")) ?? "";
  if (r.status === 401) return new ErroRede(REDE, "token_invalido", "o token não é válido ou foi revogado.");
  if (r.status === 402 || /credit|usage ?cap|billing|payment/i.test(`${detalhe} ${motivo}`))
    return new ErroRede(
      REDE,
      "sem_permissao",
      "o token está certo, mas a conta de desenvolvedor do X está sem crédito. Desde 2026 toda leitura da API do X é paga: cadastre um cartão em Billing no portal do X (vem com crédito inicial) e teste de novo.",
    );
  if (r.status === 429) {
    const reset = numero(r.headers.get("x-rate-limit-reset"));
    const ate = reset ? reset * 1000 : Date.now() + 15 * 60_000;
    bloquearAte(REDE, impressao(token), ate);
    const min = Math.max(1, Math.ceil((ate - Date.now()) / 60_000));
    return new ErroRede(REDE, "limite", `limite da API do X atingido. Tente de novo em ${min} min.`);
  }
  if (r.status === 403) {
    if (/client-not-enrolled/i.test(motivo))
      return new ErroRede(REDE, "sem_permissao", "o app do X não está ligado a um projeto com acesso à API v2.");
    return new ErroRede(REDE, "sem_permissao", `o plano da API do X não libera essa leitura${detalhe ? ` (${detalhe})` : ""}.`);
  }
  if (r.status === 404) return new ErroRede(REDE, "nao_encontrado", "perfil não encontrado.");
  if (r.status >= 500) return new ErroRede(REDE, "indisponivel", "o X está instável agora. Tente de novo em instantes.");
  return new ErroRede(REDE, "indisponivel", detalhe ? `o X recusou: ${detalhe}` : `o X recusou (erro ${r.status}).`);
}

async function get(token: string, caminho: string, params: Record<string, string> = {}): Promise<unknown> {
  reservar(REDE, impressao(token), 60, HORA);
  const url = new URL(`${API}${caminho}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const r = await pedir(REDE, url.toString(), { headers: { Authorization: `Bearer ${token}` } });
  if (r.status >= 400) throw erroX(r, token);
  // Chegou a zero nesta janela: respeita o reset antes da próxima chamada.
  if (r.headers.get("x-rate-limit-remaining") === "0") {
    const reset = numero(r.headers.get("x-rate-limit-reset"));
    if (reset) bloquearAte(REDE, impressao(token), reset * 1000);
  }
  // Erros parciais (ex.: usuário suspenso) vêm com 200 e sem data.
  if (!campo(r.corpo, "data") && lista(campo(r.corpo, "errors")).length) {
    const tipo = texto(campo(r.corpo, "errors", 0, "title")) ?? "";
    if (/not found/i.test(tipo)) throw new ErroRede(REDE, "nao_encontrado", "perfil não encontrado.");
  }
  return r.corpo;
}

function usuarioDe(bruto: string | null | undefined): string | null {
  const s = (bruto ?? "").trim();
  const m = s.match(/(?:x\.com\/|twitter\.com\/|^@?)([A-Za-z0-9_]{1,15})(?:[/?#]|$)/);
  return m ? m[1] : null;
}

export async function testar(tokenBruto: string, opcoes: { usuario?: string | null } = {}): Promise<ResultadoTeste> {
  const token = limparToken(tokenBruto);
  if (token.length < 30 || /\s/.test(token))
    return { ok: false, conta: null, motivo: "X: cole o bearer token inteiro, sem espaços." };
  try {
    let u: unknown;
    try {
      u = campo(await get(token, "/users/me", { "user.fields": CAMPOS_USUARIO }), "data");
    } catch (e) {
      // Bearer de app não tem "me": cai para o @ informado.
      if (!(e instanceof ErroRede) || e.motivo !== "sem_permissao") throw e;
      const usuario = usuarioDe(opcoes.usuario);
      if (!usuario) {
        // Confere se o token vale (perfil público fixo) antes de pedir o @.
        await get(token, "/users/by/username/XDevelopers");
        throw new ErroRede(REDE, "entrada", "esse é um bearer de app: informe o @ do perfil.");
      }
      u = campo(await get(token, `/users/by/username/${usuario}`, { "user.fields": CAMPOS_USUARIO }), "data");
    }
    const id = texto(campo(u, "id"));
    if (!id) throw new ErroRede(REDE, "nao_encontrado", "perfil não encontrado. Confira o @.");
    // Bearer de app não vence; token de usuário o X não informa aqui.
    return { ok: true, conta: { id, nome: `@${texto(campo(u, "username")) ?? id}`, expiraEm: null }, motivo: null };
  } catch (e) {
    if (e instanceof ErroRede) return { ok: false, conta: null, motivo: e.message };
    return { ok: false, conta: null, motivo: "X: não deu para testar agora. Tente de novo." };
  }
}

// ---------------------------------------------------------------------------
// Leituras
// ---------------------------------------------------------------------------

export async function perfil(con: Conexao): Promise<Perfil> {
  const u = campo(await get(con.token, `/users/${con.contaExternaId}`, { "user.fields": CAMPOS_USUARIO }), "data");
  const usuario = texto(campo(u, "username"));
  return {
    id: con.contaExternaId,
    nome: texto(campo(u, "name")) ?? usuario ?? con.contaExternaId,
    usuario,
    seguidores: numero(campo(u, "public_metrics", "followers_count")),
    publicacoes: numero(campo(u, "public_metrics", "tweet_count")),
    link: usuario ? `https://x.com/${usuario}` : null,
    descricao: texto(campo(u, "description")),
  };
}

function postDe(p: unknown, autor?: { usuario: string | null; seguidores: number | null }): Publicacao {
  const id = String(campo(p, "id") ?? "");
  const m = campo(p, "public_metrics");
  const rt = (numero(campo(m, "retweet_count")) ?? 0) + (numero(campo(m, "quote_count")) ?? 0);
  return {
    id,
    texto: (texto(campo(p, "text")) ?? "").slice(0, 600),
    link: id ? `https://x.com/${autor?.usuario ?? "i"}/status/${id}` : null,
    data: texto(campo(p, "created_at")),
    formato: "post",
    autor: autor?.usuario ? `@${autor.usuario}` : null,
    seguidoresAutor: autor?.seguidores ?? null,
    metricas: metricas({
      visualizacoes: campo(m, "impression_count"),
      curtidas: campo(m, "like_count"),
      comentarios: campo(m, "reply_count"),
      compartilhamentos: campo(m, "retweet_count") === undefined ? undefined : rt,
      salvamentos: campo(m, "bookmark_count"),
    }),
  };
}

/** Últimos posts do perfil (sem retweets e respostas) com métricas. */
export async function posts(con: Conexao, limite = 20): Promise<Publicacao[]> {
  const d = await get(con.token, `/users/${con.contaExternaId}/tweets`, {
    max_results: String(Math.max(5, Math.min(limite, 100))),
    exclude: "retweets,replies",
    "tweet.fields": CAMPOS_POST,
  });
  return lista(campo(d, "data")).map((p) => postDe(p));
}

/** Busca recente (7 dias) do nicho, em português, ranqueada por engajamento. */
export async function buscaRecente(con: Conexao, termo: string): Promise<Publicacao[]> {
  const q = termo.replace(/[()]/g, " ").trim().slice(0, 200);
  if (!q) throw new ErroRede(REDE, "entrada", "diga o tema do nicho para buscar.");
  const d = await get(con.token, "/tweets/search/recent", {
    query: `${q} lang:pt -is:retweet -is:reply`,
    max_results: "50",
    "tweet.fields": `${CAMPOS_POST},author_id`,
    expansions: "author_id",
    "user.fields": "username,public_metrics",
  });
  const autores = new Map<string, { usuario: string | null; seguidores: number | null }>();
  for (const u of lista(campo(d, "includes", "users")))
    autores.set(String(campo(u, "id")), {
      usuario: texto(campo(u, "username")),
      seguidores: numero(campo(u, "public_metrics", "followers_count")),
    });
  const peso = (p: Publicacao) =>
    (p.metricas.curtidas ?? 0) + 2 * (p.metricas.compartilhamentos ?? 0) + (p.metricas.comentarios ?? 0);
  return lista(campo(d, "data"))
    .map((p) => postDe(p, autores.get(String(campo(p, "author_id")))))
    .sort((a, b) => peso(b) - peso(a))
    .slice(0, 15);
}
