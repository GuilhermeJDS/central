/**
 * Partes comuns do Google (YouTube e Google Empresa): erro padrão das APIs
 * do Google e o token OAuth colado pelo cliente.
 *
 * Token de acesso (ya29.…) vale 1 hora. Token de renovação (1//…) só funciona
 * com o app OAuth do .env (GOOGLE_OAUTH_CLIENT_ID / _SECRET); sem ele, a
 * mensagem pede o token de acesso.
 */
import "server-only";

import type { RedeConectavel } from "@/lib/redes/catalogo";
import { gravarCache, lerCache } from "@/lib/redes/cache";
import { campo, impressao, limpar, lista, pedir, texto, type RespostaHttp } from "@/lib/redes/http";
import { bloquearAte } from "@/lib/redes/limites";
import { ErroRede } from "@/lib/redes/tipos";

function motivosGoogle(corpo: unknown): string[] {
  const r: string[] = [];
  for (const e of lista(campo(corpo, "error", "errors"))) {
    const x = texto(campo(e, "reason"));
    if (x) r.push(x);
  }
  for (const d of lista(campo(corpo, "error", "details"))) {
    const x = texto(campo(d, "reason"));
    if (x) r.push(x);
  }
  const s = texto(campo(corpo, "error", "status"));
  if (s) r.push(s);
  return r;
}

/** Converte a resposta de erro do Google em ErroRede (sem o token). */
export function erroGoogle(
  rede: RedeConectavel,
  r: RespostaHttp,
  segredos: Array<string | null | undefined>,
  ctx: { oauth: boolean; api: string; chave: string },
): ErroRede {
  const motivos = motivosGoogle(r.corpo).join(" ");
  const msg = limpar(campo(r.corpo, "error", "message"), segredos);

  if (/API_KEY_INVALID|keyInvalid|API key not valid/i.test(`${motivos} ${msg}`))
    return new ErroRede(rede, "token_invalido", "a API key não é válida. Confira se colou a chave inteira.");
  if (/API_KEY_(HTTP_REFERRER|IP_ADDRESS|SERVICE)_BLOCKED|API_KEY_SERVICE_BLOCKED/i.test(motivos))
    return new ErroRede(rede, "sem_permissao", "a chave tem uma restrição (site, IP ou API) que bloqueia a Central. Tire a restrição ou libere a API.");
  if (/accessNotConfigured|SERVICE_DISABLED/i.test(motivos) || /has not been used in project|is disabled/i.test(msg))
    return new ErroRede(rede, "sem_permissao", `a ${ctx.api} não está ativada no projeto do Google Cloud dessa chave. Ative e tente de novo.`);
  if (/quotaExceeded|dailyLimitExceeded|RATE_LIMIT_EXCEEDED|rateLimitExceeded|RESOURCE_EXHAUSTED|userRateLimitExceeded/i.test(motivos) || r.status === 429) {
    bloquearAte(rede, ctx.chave, Date.now() + 10 * 60_000);
    return new ErroRede(rede, "limite", "a cota da API acabou por agora. Tente mais tarde (a do dia zera às 4h ou 5h de Brasília).");
  }
  if (r.status === 401)
    return new ErroRede(rede, "token_vencido", "o token OAuth venceu ou é inválido (o de acesso do Google dura 1 hora). Gere outro e troque.");
  if (r.status === 403) {
    if (/insufficient|ACCESS_TOKEN_SCOPE_INSUFFICIENT|SCOPE/i.test(`${motivos} ${msg}`))
      return new ErroRede(rede, "sem_permissao", "o token não tem o escopo necessário. Gere de novo marcando a permissão pedida.");
    return new ErroRede(rede, "sem_permissao", `sem permissão para essa leitura${msg ? ` (${msg})` : ""}.`);
  }
  if (r.status === 404) return new ErroRede(rede, "nao_encontrado", "não encontrado.");
  if (r.status === 400 && ctx.oauth && /token/i.test(msg))
    return new ErroRede(rede, "token_invalido", "o token OAuth não é válido.");
  if (r.status >= 500) return new ErroRede(rede, "indisponivel", "o Google está instável agora. Tente de novo em instantes.");
  return new ErroRede(rede, "indisponivel", msg ? `o Google recusou: ${msg}` : `o Google recusou (erro ${r.status}).`);
}

export type TokenGoogle = { acesso: string; expiraEm: Date | null; escopos: string[] };

const TOKENINFO = "https://oauth2.googleapis.com/tokeninfo";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

/** Aceita token de acesso (ya29.) ou de renovação (1//) e devolve um de acesso válido. */
export type AppOAuth = { id: string; segredo: string };

export async function tokenGoogle(rede: RedeConectavel, colado: string, app?: AppOAuth | null): Promise<TokenGoogle> {
  const token = colado.trim().replace(/^Bearer\s+/i, "");
  const chaveCache = `google-acesso:${impressao(token)}`;
  const emCache = lerCache<TokenGoogle>(chaveCache);
  if (emCache) return emCache;

  if (token.startsWith("1//")) {
    // App do próprio cliente (colado no guia) ou o app OAuth do .env.
    const id = app?.id || process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
    const segredo = app?.segredo || process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
    if (!id || !segredo)
      throw new ErroRede(rede, "entrada", "esse é um token de renovação (1//…): cole também o Client ID e o Client secret do seu app no Google Cloud.");
    const r = await pedir(rede, TOKEN_URL, {
      metodo: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      corpo: new URLSearchParams({ client_id: id, client_secret: segredo, refresh_token: token, grant_type: "refresh_token" }).toString(),
    });
    const acesso = texto(campo(r.corpo, "access_token"));
    if (r.status !== 200 || !acesso) {
      const erro = texto(campo(r.corpo, "error"));
      if (erro === "invalid_client" || erro === "unauthorized_client")
        throw new ErroRede(rede, "entrada", "o Client ID ou o Client secret não confere com o token de renovação.");
      throw new ErroRede(rede, "token_invalido", "o token de renovação não é válido ou foi revogado. Gere outro no OAuth Playground.");
    }
    const seg = Number(campo(r.corpo, "expires_in")) || 3600;
    const t: TokenGoogle = {
      acesso,
      expiraEm: null, // o de renovação não vence sozinho
      escopos: (texto(campo(r.corpo, "scope")) ?? "").split(" ").filter(Boolean),
    };
    gravarCache(chaveCache, t, Math.max(60, seg - 120) * 1000);
    return t;
  }

  if (!/^ya29\.[\w.\-]{20,}$/.test(token))
    throw new ErroRede(rede, "entrada", "o token OAuth do Google começa com ya29. Confira se colou inteiro.");
  const r = await pedir(rede, `${TOKENINFO}?access_token=${encodeURIComponent(token)}`);
  if (r.status !== 200)
    throw new ErroRede(rede, "token_vencido", "o token OAuth venceu ou é inválido (o de acesso do Google dura 1 hora). Gere outro.");
  const seg = Number(campo(r.corpo, "expires_in")) || 0;
  const t: TokenGoogle = {
    acesso: token,
    expiraEm: seg > 0 ? new Date(Date.now() + seg * 1000) : null,
    escopos: (texto(campo(r.corpo, "scope")) ?? "").split(" ").filter(Boolean),
  };
  if (seg > 120) gravarCache(chaveCache, t, (seg - 60) * 1000);
  return t;
}

export function temEscopo(t: TokenGoogle, ...procurados: string[]): boolean {
  // tokeninfo do refresh nem sempre devolve escopo: na dúvida, deixa a API decidir.
  if (!t.escopos.length) return true;
  return procurados.some((p) => t.escopos.some((e) => e.endsWith(p)));
}
