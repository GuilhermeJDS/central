/**
 * Coletor do LinkedIn (token de acesso do cliente). Só servidor.
 *
 * - Perfil: /v2/userinfo (escopos openid + profile).
 * - Página: se o token administra uma página (rw_organization_admin), a
 *   conexão fica na página (nome, seguidores, totais de engajamento).
 * - Publicações: /rest/posts, que o LinkedIn só libera com r_member_social
 *   (restrito) ou r_organization_social. Sem permissão volta vazio + aviso.
 *
 * Versão da API em LINKEDIN_API_VERSION (AAAAMM; cada uma vale ~1 ano).
 * Limite: o LinkedIn conta por dia por app/membro; aqui 100 leituras/hora.
 */
import "server-only";

import { campo, impressao, limpar, lista, pedir, texto, type RespostaHttp } from "@/lib/redes/http";
import { bloquearAte, reservar } from "@/lib/redes/limites";
import {
  ErroRede,
  metricas,
  numero,
  type Conexao,
  type Metrica,
  type Perfil,
  type Publicacao,
  type ResultadoTeste,
} from "@/lib/redes/tipos";

const REDE = "LINKEDIN" as const;
const VERSAO = process.env.LINKEDIN_API_VERSION?.trim() || "202606";
const HORA = 60 * 60 * 1000;
const VALIDADE_MS = 60 * 24 * HORA;

function limparToken(t: string): string {
  return t.trim().replace(/^Bearer\s+/i, "");
}

function erroLinkedin(r: RespostaHttp, token: string): ErroRede {
  const msg = limpar(campo(r.corpo, "message"), [token]);
  if (r.status === 401) {
    if (/expired/i.test(msg)) return new ErroRede(REDE, "token_vencido", "o token venceu (vale 60 dias). Gere outro e troque.");
    return new ErroRede(REDE, "token_invalido", "o token não é válido ou foi revogado.");
  }
  if (r.status === 403)
    return new ErroRede(REDE, "sem_permissao", "o token não tem a permissão para essa leitura no LinkedIn.");
  if (r.status === 426 || /version/i.test(msg))
    return new ErroRede(REDE, "indisponivel", "a versão da API do LinkedIn configurada saiu do ar. Abra uma issue no GitHub da Central.");
  if (r.status === 429) {
    bloquearAte(REDE, impressao(token), Date.now() + HORA);
    return new ErroRede(REDE, "limite", "limite diário da API do LinkedIn atingido. Tente mais tarde.");
  }
  if (r.status === 404) return new ErroRede(REDE, "nao_encontrado", "não encontrado.");
  if (r.status >= 500) return new ErroRede(REDE, "indisponivel", "o LinkedIn está instável agora. Tente de novo em instantes.");
  return new ErroRede(REDE, "indisponivel", msg ? `o LinkedIn recusou: ${msg}` : `o LinkedIn recusou (erro ${r.status}).`);
}

async function get(token: string, caminho: string, rest = true): Promise<unknown> {
  reservar(REDE, impressao(token), 100, HORA);
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (rest) {
    headers["LinkedIn-Version"] = VERSAO;
    headers["X-Restli-Protocol-Version"] = "2.0.0";
  }
  const r = await pedir(REDE, `https://api.linkedin.com${caminho}`, { headers });
  if (r.status >= 400) throw erroLinkedin(r, token);
  return r.corpo;
}

function idDaOrg(urn: string): string | null {
  return urn.match(/^urn:li:organization:(\d+)$/)?.[1] ?? null;
}

/** Primeira página que o token administra, ou null (sem permissão também é null). */
async function paginaAdministrada(token: string): Promise<{ urn: string; nome: string } | null> {
  try {
    const acl = await get(token, "/rest/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED&count=5");
    const urn = texto(campo(lista(campo(acl, "elements"))[0], "organization"));
    const id = urn ? idDaOrg(urn) : null;
    if (!urn || !id) return null;
    const org = await get(token, `/rest/organizations/${id}`);
    return { urn, nome: texto(campo(org, "localizedName")) ?? urn };
  } catch (e) {
    if (e instanceof ErroRede && (e.motivo === "sem_permissao" || e.motivo === "nao_encontrado")) return null;
    throw e;
  }
}

export async function testar(tokenBruto: string): Promise<ResultadoTeste> {
  const token = limparToken(tokenBruto);
  if (token.length < 30 || /\s/.test(token))
    return { ok: false, conta: null, motivo: "LinkedIn: cole o token inteiro, sem espaços." };
  try {
    const eu = await get(token, "/v2/userinfo", false).catch((e) => {
      if (e instanceof ErroRede && e.motivo === "sem_permissao")
        throw new ErroRede(REDE, "sem_permissao", "o token precisa dos escopos openid e profile (Sign In with LinkedIn).");
      throw e;
    });
    const sub = texto(campo(eu, "sub"));
    if (!sub) throw new ErroRede(REDE, "nao_encontrado", "o LinkedIn não devolveu o perfil desse token.");
    const pagina = await paginaAdministrada(token);
    const expiraEm = new Date(Date.now() + VALIDADE_MS);
    if (pagina) return { ok: true, conta: { id: pagina.urn, nome: `${pagina.nome} (página)`, expiraEm }, motivo: null };
    return {
      ok: true,
      conta: { id: `urn:li:person:${sub}`, nome: texto(campo(eu, "name")) ?? "Perfil do LinkedIn", expiraEm },
      motivo: null,
    };
  } catch (e) {
    if (e instanceof ErroRede) return { ok: false, conta: null, motivo: e.message };
    return { ok: false, conta: null, motivo: "LinkedIn: não deu para testar agora. Tente de novo." };
  }
}

// ---------------------------------------------------------------------------
// Leituras
// ---------------------------------------------------------------------------

export async function perfil(con: Conexao): Promise<Perfil> {
  const orgId = idDaOrg(con.contaExternaId);
  if (orgId) {
    const org = await get(con.token, `/rest/organizations/${orgId}`);
    const seguidores = await get(
      con.token,
      `/rest/networkSizes/${encodeURIComponent(con.contaExternaId)}?edgeType=COMPANY_FOLLOWED_BY_MEMBER`,
    ).catch(() => null);
    const vanity = texto(campo(org, "vanityName"));
    return {
      id: con.contaExternaId,
      nome: texto(campo(org, "localizedName")) ?? con.contaExternaId,
      usuario: vanity,
      seguidores: numero(campo(seguidores, "firstDegreeSize")),
      publicacoes: null,
      link: vanity ? `https://www.linkedin.com/company/${vanity}/` : null,
      descricao: (texto(campo(org, "localizedDescription")) ?? "").slice(0, 500) || null,
    };
  }
  const eu = await get(con.token, "/v2/userinfo", false);
  return {
    id: con.contaExternaId,
    nome: texto(campo(eu, "name")) ?? "Perfil do LinkedIn",
    usuario: null,
    seguidores: null,
    publicacoes: null,
    link: null,
  };
}

export type PublicacoesLinkedin = {
  publicacoes: Publicacao[];
  /** Totais da página (impressões, cliques, reações…), quando a API libera. */
  totais: Metrica[];
  /** O que a API não liberou para este token. */
  aviso: string | null;
};

/** As publicações que a API liberar para o token (sem permissão: vazio + aviso). */
export async function publicacoes(con: Conexao, limite = 10): Promise<PublicacoesLinkedin> {
  const out: PublicacoesLinkedin = { publicacoes: [], totais: [], aviso: null };
  try {
    const d = await get(
      con.token,
      `/rest/posts?author=${encodeURIComponent(con.contaExternaId)}&q=author&count=${Math.min(limite, 50)}&sortBy=LAST_MODIFIED`,
    );
    out.publicacoes = lista(campo(d, "elements")).map((p) => {
      const id = String(campo(p, "id") ?? "");
      const quando = numero(campo(p, "publishedAt")) ?? numero(campo(p, "createdAt"));
      return {
        id,
        texto: (texto(campo(p, "commentary")) ?? "").slice(0, 800),
        link: id ? `https://www.linkedin.com/feed/update/${id}/` : null,
        data: quando ? new Date(quando).toISOString() : null,
        formato: texto(campo(p, "content", "media", "id"))?.includes("video") ? "video" : "post",
        metricas: {},
      };
    });
  } catch (e) {
    if (!(e instanceof ErroRede) || e.motivo !== "sem_permissao") throw e;
    out.aviso =
      "O LinkedIn não liberou a leitura das publicações para esse token (precisa de r_organization_social para página ou r_member_social para perfil).";
  }

  if (idDaOrg(con.contaExternaId)) {
    try {
      const s = await get(
        con.token,
        `/rest/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=${encodeURIComponent(con.contaExternaId)}`,
      );
      const t = campo(lista(campo(s, "elements"))[0], "totalShareStatistics");
      const m = metricas({
        visualizacoes: campo(t, "impressionCount"),
        curtidas: campo(t, "likeCount"),
        comentarios: campo(t, "commentCount"),
        compartilhamentos: campo(t, "shareCount"),
      });
      out.totais = Object.entries(m).map(([nome, valor]) => ({ nome: `${nome}_total`, valor: valor as number }));
      const cliques = numero(campo(t, "clickCount"));
      if (cliques !== null) out.totais.push({ nome: "cliques_total", valor: cliques });
    } catch (e) {
      if (!(e instanceof ErroRede) || e.motivo !== "sem_permissao") throw e;
    }
  }
  return out;
}
