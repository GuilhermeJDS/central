/**
 * Coletor do Instagram (conta profissional, API oficial da Meta). Só servidor.
 *
 * Dois tipos de token, pelo prefixo:
 * - IG… (Instagram API com login do Instagram, graph.instagram.com): perfil,
 *   publicações, insights. Vale 60 dias e renova sozinho (rotina diária).
 * - EAA… (Instagram Graph API pelo Facebook, graph.facebook.com): tudo isso
 *   + busca por hashtag (virais). A conta vem da Página ligada ou, no login
 *   unificado (usuário do sistema, sem Página), dos alvos das permissões do
 *   token (debug_token). Renova se META_APP_ID/META_APP_SECRET estiverem no
 *   ambiente; token de Página e de usuário do sistema não vencem.
 *
 * Limites: ~200 chamadas/hora por conta na Meta (aqui 150) e 30 hashtags
 * distintas por semana (o cache de 6 h evita repetir a mesma).
 */
import "server-only";

import { campo, impressao, limpar, lista, pedir, texto, type RespostaHttp } from "@/lib/redes/http";
import { bloquearAte, reservar } from "@/lib/redes/limites";
import {
  ErroRede,
  metricas,
  numero,
  type Conexao,
  type ContaExterna,
  type Metrica,
  type Perfil,
  type Publicacao,
  type ResultadoTeste,
} from "@/lib/redes/tipos";

const REDE = "INSTAGRAM" as const;
const VERSAO = process.env.META_GRAPH_VERSION?.trim() || "v23.0";
const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;
const MAX_POR_HORA = 150;
const VALIDADE_TOKEN_LONGO_MS = 60 * DIA;

type Sabor = "instagram" | "facebook";

function limparToken(t: string): string {
  return t.trim().replace(/^Bearer\s+/i, "");
}

function sabor(token: string): Sabor {
  return token.startsWith("EAA") ? "facebook" : "instagram";
}

function base(s: Sabor): string {
  return s === "facebook" ? `https://graph.facebook.com/${VERSAO}` : `https://graph.instagram.com/${VERSAO}`;
}

function erroMeta(r: RespostaHttp, token: string): ErroRede {
  const codigo = numero(campo(r.corpo, "error", "code"));
  const sub = numero(campo(r.corpo, "error", "error_subcode"));
  const msg = limpar(campo(r.corpo, "error", "message"), [token]);

  if (codigo === 190) {
    if (sub === 463 || /expired|session has expired/i.test(msg))
      return new ErroRede(REDE, "token_vencido", "o token venceu. Gere um novo e troque aqui.");
    return new ErroRede(REDE, "token_invalido", "o token não é válido. Confira se colou inteiro, sem espaços.");
  }
  if (codigo === 4 || codigo === 17 || codigo === 32 || codigo === 613 || r.status === 429) {
    bloquearAte(REDE, impressao(token), Date.now() + HORA);
    return new ErroRede(REDE, "limite", "limite de chamadas da Meta atingido. Tente de novo em 1 hora.");
  }
  if (/hashtag/i.test(msg) && /limit|30/i.test(msg))
    return new ErroRede(REDE, "limite", "a Meta deixa buscar só 30 hashtags diferentes por semana. Tente uma já usada ou espere.");
  if (codigo === 10 || (codigo !== null && codigo >= 200 && codigo < 300) || r.status === 403)
    return new ErroRede(
      REDE,
      "sem_permissao",
      "o token não tem as permissões necessárias (leitura do perfil, das publicações e dos insights). Gere de novo marcando essas permissões.",
    );
  if (r.status >= 500) return new ErroRede(REDE, "indisponivel", "a Meta está instável agora. Tente de novo em instantes.");
  return new ErroRede(REDE, "indisponivel", msg ? `a Meta recusou: ${msg}` : `a Meta recusou (erro ${r.status}).`);
}

async function get(token: string, caminho: string, params: Record<string, string> = {}): Promise<unknown> {
  reservar(REDE, impressao(token), MAX_POR_HORA, HORA);
  const url = new URL(base(sabor(token)) + caminho);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("access_token", token);
  const r = await pedir(REDE, url.toString());
  if (r.status >= 400 || campo(r.corpo, "error")) throw erroMeta(r, token);
  return r.corpo;
}

// ---------------------------------------------------------------------------
// Conta
// ---------------------------------------------------------------------------

const CAMPOS_IG_LOGIN = "user_id,username,name,account_type,followers_count,media_count";
const CAMPOS_IG_FB = "id,username,name,followers_count,media_count,biography,website";

/** EAA…: acha a conta profissional ligada (token de Página ou de usuário). */
async function contaIgDoFacebook(token: string): Promise<Record<string, unknown> | null> {
  const doMe = await get(token, "/me", { fields: `instagram_business_account{${CAMPOS_IG_FB}}` }).catch((e) => {
    if (e instanceof ErroRede && e.motivo !== "indisponivel") throw e;
    return null;
  });
  const direto = campo(doMe, "instagram_business_account");
  if (direto && typeof direto === "object") return direto as Record<string, unknown>;

  const paginas = await get(token, "/me/accounts", {
    fields: `name,instagram_business_account{${CAMPOS_IG_FB}}`,
    limit: "25",
  }).catch((e) => {
    if (e instanceof ErroRede && e.motivo !== "indisponivel") throw e;
    return null;
  });
  for (const p of lista(campo(paginas, "data"))) {
    const ig = campo(p, "instagram_business_account");
    if (ig && typeof ig === "object") return ig as Record<string, unknown>;
  }

  // Login unificado (token de usuário do sistema, sem Página): a conta
  // liberada vem nos alvos das permissões do próprio token.
  for (const id of await contasDasPermissoes(token)) {
    const ig = await get(token, `/${id}`, { fields: CAMPOS_IG_FB }).catch((e) => {
      if (e instanceof ErroRede && e.motivo !== "indisponivel" && e.motivo !== "sem_permissao") throw e;
      return null;
    });
    if (ig && typeof ig === "object" && campo(ig, "username")) return ig as Record<string, unknown>;
  }
  return null;
}

/** IDs de contas do Instagram nas permissões granulares do token (debug_token). */
async function contasDasPermissoes(token: string): Promise<string[]> {
  const d = await get(token, "/debug_token", { input_token: token }).catch(() => null);
  const ids = new Set<string>();
  for (const g of lista(campo(d, "data", "granular_scopes"))) {
    const escopo = texto(campo(g, "scope")) ?? "";
    if (!escopo.startsWith("instagram_")) continue;
    for (const t of lista(campo(g, "target_ids"))) if (t != null && /^\d+$/.test(String(t))) ids.add(String(t));
  }
  return [...ids].slice(0, 5);
}

async function expiracaoFacebook(token: string): Promise<Date | null> {
  try {
    const d = await get(token, "/debug_token", { input_token: token });
    const exp = numero(campo(d, "data", "expires_at"));
    return exp && exp > 0 ? new Date(exp * 1000) : null;
  } catch {
    return null; // não é fatal: a rede só não informou
  }
}

export async function testar(tokenBruto: string): Promise<ResultadoTeste> {
  const token = limparToken(tokenBruto);
  if (token.length < 30 || /\s/.test(token))
    return { ok: false, conta: null, motivo: "Instagram: cole o token inteiro, sem espaços." };
  try {
    let conta: ContaExterna;
    if (sabor(token) === "instagram") {
      const me = await get(token, "/me", { fields: CAMPOS_IG_LOGIN });
      const tipo = texto(campo(me, "account_type"));
      if (tipo && tipo !== "BUSINESS" && tipo !== "MEDIA_CREATOR")
        throw new ErroRede(REDE, "conta_nao_profissional", "a conta é pessoal. Mude para profissional (comercial ou criador) no app do Instagram.");
      const id = texto(campo(me, "user_id")) ?? String(campo(me, "user_id") ?? campo(me, "id") ?? "");
      if (!id) throw new ErroRede(REDE, "nao_encontrado", "a Meta não devolveu a conta desse token.");
      conta = {
        id,
        nome: `@${texto(campo(me, "username")) ?? id}`,
        // Token longo do Instagram: 60 dias a partir de agora (a rotina renova antes).
        expiraEm: new Date(Date.now() + VALIDADE_TOKEN_LONGO_MS),
      };
    } else {
      const ig = await contaIgDoFacebook(token);
      if (!ig)
        throw new ErroRede(
          REDE,
          "conta_nao_profissional",
          "nenhuma conta profissional do Instagram liberada nesse token. Gere de novo escolhendo a conta do Instagram.",
        );
      const id = String(ig.id ?? "");
      conta = { id, nome: `@${texto(ig.username) ?? id}`, expiraEm: await expiracaoFacebook(token) };
    }
    return { ok: true, conta, motivo: null };
  } catch (e) {
    if (e instanceof ErroRede) return { ok: false, conta: null, motivo: e.message };
    return { ok: false, conta: null, motivo: "Instagram: não deu para testar agora. Tente de novo." };
  }
}

// ---------------------------------------------------------------------------
// Leituras
// ---------------------------------------------------------------------------

function raiz(con: Conexao): string {
  return sabor(con.token) === "instagram" ? "/me" : `/${con.contaExternaId}`;
}

export async function perfil(con: Conexao): Promise<Perfil> {
  const ig = sabor(con.token) === "instagram";
  const p = await get(con.token, raiz(con), { fields: ig ? CAMPOS_IG_LOGIN : CAMPOS_IG_FB });
  const usuario = texto(campo(p, "username"));
  return {
    id: con.contaExternaId,
    nome: texto(campo(p, "name")) ?? usuario ?? con.contaExternaId,
    usuario,
    seguidores: numero(campo(p, "followers_count")),
    publicacoes: numero(campo(p, "media_count")),
    link: usuario ? `https://www.instagram.com/${usuario}/` : null,
    descricao: texto(campo(p, "biography")),
  };
}

const CAMPOS_MIDIA =
  "id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count";

function publicacaoDe(m: unknown, extras: Record<string, unknown> = {}): Publicacao {
  return {
    id: String(campo(m, "id") ?? ""),
    texto: (texto(campo(m, "caption")) ?? "").slice(0, 600),
    link: texto(campo(m, "permalink")),
    data: texto(campo(m, "timestamp")),
    formato: texto(campo(m, "media_product_type")) ?? texto(campo(m, "media_type")),
    imagem: texto(campo(m, "thumbnail_url")) ?? texto(campo(m, "media_url")),
    metricas: metricas({
      curtidas: campo(m, "like_count"),
      comentarios: campo(m, "comments_count"),
      visualizacoes: extras.views,
      alcance: extras.reach,
      salvamentos: extras.saved,
      compartilhamentos: extras.shares,
    }),
  };
}

async function insightsMidia(token: string, id: string): Promise<Record<string, unknown>> {
  const d = await get(token, `/${id}/insights`, { metric: "reach,saved,shares,views" });
  const out: Record<string, unknown> = {};
  for (const i of lista(campo(d, "data"))) {
    const nome = texto(campo(i, "name"));
    if (nome) out[nome] = campo(i, "values", 0, "value") ?? campo(i, "total_value", "value");
  }
  return out;
}

/** Últimas publicações com curtidas/comentários e, nas 12 primeiras, alcance, views, salvos e compart. */
export async function publicacoes(con: Conexao, limite = 12): Promise<Publicacao[]> {
  const d = await get(con.token, `${raiz(con)}/media`, { fields: CAMPOS_MIDIA, limit: String(Math.min(limite, 25)) });
  const midias = lista(campo(d, "data"));
  const extras = await Promise.allSettled(
    midias.slice(0, 12).map((m) => insightsMidia(con.token, String(campo(m, "id") ?? ""))),
  );
  return midias.map((m, i) => {
    const e = extras[i];
    return publicacaoDe(m, e && e.status === "fulfilled" ? e.value : {});
  });
}

/** Números da conta nos últimos 28 dias (o que a Meta liberar). */
export async function insightsConta(con: Conexao): Promise<Metrica[]> {
  const ate = Math.floor(Date.now() / 1000);
  const desde = ate - 28 * 86_400;
  const pedirMetricas = (lista_: string) =>
    get(con.token, `${raiz(con)}/insights`, {
      metric: lista_,
      period: "day",
      metric_type: "total_value",
      since: String(desde),
      until: String(ate),
    });
  let d: unknown;
  try {
    d = await pedirMetricas("reach,views,accounts_engaged,total_interactions,likes,comments,shares,saves");
  } catch (e) {
    if (!(e instanceof ErroRede) || e.motivo !== "indisponivel") throw e;
    d = await pedirMetricas("reach,accounts_engaged,total_interactions");
  }
  const out: Metrica[] = [];
  for (const i of lista(campo(d, "data"))) {
    const nome = texto(campo(i, "name"));
    const valor = numero(campo(i, "total_value", "value"));
    if (nome && valor !== null) out.push({ nome: `${nome}_28d`, valor });
  }
  return out;
}

/** Hashtag do nicho → posts que mais performam (virais). Só com token EAA…. */
export async function buscaHashtag(con: Conexao, termo: string): Promise<{ hashtag: string; publicacoes: Publicacao[] }> {
  const hashtag = termo
    .normalize("NFC")
    .toLowerCase()
    .replace(/^#/, "")
    .replace(/[^\p{L}\p{N}_]/gu, "")
    .slice(0, 60);
  if (!hashtag) throw new ErroRede(REDE, "entrada", "diga a hashtag ou o tema do nicho para buscar.");
  if (sabor(con.token) !== "facebook")
    throw new ErroRede(
      REDE,
      "sem_permissao",
      "a busca por hashtag só existe na API da Meta pelo Facebook. Troque pelo token EAA… (Página ligada ao Instagram) para buscar os virais.",
    );
  const busca = await get(con.token, "/ig_hashtag_search", { user_id: con.contaExternaId, q: hashtag });
  const id = texto(campo(busca, "data", 0, "id"));
  if (!id) throw new ErroRede(REDE, "nao_encontrado", `a hashtag #${hashtag} não foi encontrada.`);
  const top = await get(con.token, `/${id}/top_media`, {
    user_id: con.contaExternaId,
    fields: "id,caption,media_type,permalink,timestamp,like_count,comments_count",
    limit: "25",
  });
  const posts = lista(campo(top, "data"))
    .map((m) => publicacaoDe(m))
    .sort(
      (a, b) =>
        (b.metricas.curtidas ?? 0) + 3 * (b.metricas.comentarios ?? 0) - ((a.metricas.curtidas ?? 0) + 3 * (a.metricas.comentarios ?? 0)),
    );
  return { hashtag, publicacoes: posts };
}

// ---------------------------------------------------------------------------
// Renovação
// ---------------------------------------------------------------------------

/**
 * Renova o token longo. Devolve o novo (com o vencimento) ou null quando não
 * há o que renovar (EAA… sem app configurado / token de Página que não vence).
 */
export async function renovar(
  tokenBruto: string,
  app?: { id: string; segredo: string } | null,
): Promise<{ token: string; expiraEm: Date | null } | null> {
  const token = limparToken(tokenBruto);
  if (sabor(token) === "instagram") {
    const url = new URL("https://graph.instagram.com/refresh_access_token");
    url.searchParams.set("grant_type", "ig_refresh_token");
    url.searchParams.set("access_token", token);
    const r = await pedir(REDE, url.toString());
    const novo = texto(campo(r.corpo, "access_token"));
    if (r.status >= 400 || !novo) throw erroMeta(r, token);
    const seg = numero(campo(r.corpo, "expires_in")) ?? VALIDADE_TOKEN_LONGO_MS / 1000;
    return { token: novo, expiraEm: new Date(Date.now() + seg * 1000) };
  }
  // App do próprio cliente (colado no guia) ou o app da Korely.
  const appId = app?.id || process.env.META_APP_ID?.trim();
  const segredo = app?.segredo || process.env.META_APP_SECRET?.trim();
  if (!appId || !segredo) return null;
  const url = new URL(`https://graph.facebook.com/${VERSAO}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", segredo);
  url.searchParams.set("fb_exchange_token", token);
  const r = await pedir(REDE, url.toString());
  const novo = texto(campo(r.corpo, "access_token"));
  if (r.status >= 400 || !novo) throw erroMeta(r, token);
  const seg = numero(campo(r.corpo, "expires_in"));
  return { token: novo, expiraEm: seg ? new Date(Date.now() + seg * 1000) : await expiracaoFacebook(novo) };
}
