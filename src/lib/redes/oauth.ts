/**
 * "Conectar com…" (OAuth): a pessoa entra na plataforma, autoriza e volta
 * para a Central já conectada. Convive com o "colar token" (fluxo avançado).
 *
 * Cada plataforma só liga quando o app do .env estiver no ambiente:
 *   Google (YouTube + Google Empresa)  GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET
 *   Instagram (login do Instagram)     INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET
 *   LinkedIn                           LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET
 *   X                                  X_CLIENT_ID / X_CLIENT_SECRET
 *   OpenRouter (IA)                    não precisa de app (PKCE); OPENROUTER_OAUTH=0 desliga
 *
 * URI de retorno a cadastrar em cada app: <APP_URL>/api/central/conectar/<alvo>/retorno
 * (OAUTH_BASE_URL troca o <APP_URL> só do OAuth, para testar em outro endereço).
 *
 * SEGURANÇA: estado + PKCE num cookie cifrado (AES-GCM, 10 min) preso à conta
 * da sessão. Os tokens só passam pela memória a caminho do cofre.
 */
import "server-only";

import { createHash, randomBytes } from "crypto";

import type { RedeConectavel } from "@/lib/redes/catalogo";
import { campo, pedir, texto } from "@/lib/redes/http";
import { ErroRede, numero } from "@/lib/redes/tipos";

export { ALVOS_OAUTH, ALVO_DA_REDE, REDE_DO_ALVO, ehAlvoOAuth, type AlvoOAuth } from "@/lib/redes/oauth-alvos";
import { REDE_DO_ALVO, type AlvoOAuth } from "@/lib/redes/oauth-alvos";

type App = { id: string; segredo: string };

function env(nome: string): string {
  return process.env[nome]?.trim() ?? "";
}

function appDo(alvo: AlvoOAuth): App | null {
  const [id, segredo] =
    alvo === "youtube" || alvo === "google-empresa"
      ? [env("GOOGLE_OAUTH_CLIENT_ID"), env("GOOGLE_OAUTH_CLIENT_SECRET")]
      : alvo === "instagram"
        ? [env("INSTAGRAM_APP_ID"), env("INSTAGRAM_APP_SECRET")]
        : alvo === "linkedin"
          ? [env("LINKEDIN_CLIENT_ID"), env("LINKEDIN_CLIENT_SECRET")]
          : alvo === "x"
            ? [env("X_CLIENT_ID"), env("X_CLIENT_SECRET")]
            : ["openrouter", "-"];
  return id && segredo ? { id, segredo } : null;
}

export function oauthLigado(alvo: AlvoOAuth): boolean {
  if (alvo === "openrouter") return env("OPENROUTER_OAUTH") !== "0";
  return !!appDo(alvo);
}

/** Redes com o botão "Conectar com…" (vai para a tela; sem segredo). */
export function redesComOAuth(): RedeConectavel[] {
  return (Object.keys(REDE_DO_ALVO) as Array<keyof typeof REDE_DO_ALVO>).filter(oauthLigado).map((a) => REDE_DO_ALVO[a]);
}

export function baseApp(): string {
  // OAUTH_BASE_URL: só para testar o retorno em outro endereço (ex.: http://localhost:3001).
  return (process.env.OAUTH_BASE_URL || process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
}

export function uriRetorno(alvo: AlvoOAuth): string {
  return `${baseApp()}/api/central/conectar/${alvo}/retorno`;
}

// ---------------------------------------------------------------------------
// Estado + PKCE
// ---------------------------------------------------------------------------

export type EstadoOAuth = { estado: string; verificador: string; alvo: AlvoOAuth; accountId: string; em: number };

const b64url = (b: Buffer) => b.toString("base64url");

export function novoEstado(alvo: AlvoOAuth, accountId: string): EstadoOAuth {
  return { estado: b64url(randomBytes(24)), verificador: b64url(randomBytes(48)), alvo, accountId, em: Date.now() };
}

function desafio(verificador: string): string {
  return b64url(createHash("sha256").update(verificador).digest());
}

const ESCOPOS_GOOGLE: Record<"youtube" | "google-empresa", string> = {
  youtube: "https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/yt-analytics.readonly",
  "google-empresa": "https://www.googleapis.com/auth/business.manage",
};

/** URL da tela oficial de login/autorização. */
export function urlAutorizacao(e: EstadoOAuth): string {
  const app = appDo(e.alvo);
  if (!app) throw new Error("app não configurado");
  const retorno = uriRetorno(e.alvo);
  let u: URL;
  switch (e.alvo) {
    case "youtube":
    case "google-empresa":
      u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      u.search = new URLSearchParams({
        client_id: app.id,
        redirect_uri: retorno,
        response_type: "code",
        scope: ESCOPOS_GOOGLE[e.alvo],
        access_type: "offline",
        // Sem "consent" o Google não devolve o refresh na segunda vez.
        prompt: "consent select_account",
        include_granted_scopes: "true",
        state: e.estado,
        code_challenge: desafio(e.verificador),
        code_challenge_method: "S256",
      }).toString();
      return u.toString();
    case "instagram":
      u = new URL("https://www.instagram.com/oauth/authorize");
      u.search = new URLSearchParams({
        client_id: app.id,
        redirect_uri: retorno,
        response_type: "code",
        scope: env("INSTAGRAM_OAUTH_ESCOPOS") || "instagram_business_basic,instagram_business_manage_insights",
        state: e.estado,
      }).toString();
      return u.toString();
    case "linkedin":
      u = new URL("https://www.linkedin.com/oauth/v2/authorization");
      u.search = new URLSearchParams({
        response_type: "code",
        client_id: app.id,
        redirect_uri: retorno,
        // Página da empresa: acrescente rw_organization_admin quando o produto for liberado.
        scope: env("LINKEDIN_OAUTH_ESCOPOS") || "openid profile",
        state: e.estado,
      }).toString();
      return u.toString();
    case "x":
      u = new URL("https://x.com/i/oauth2/authorize");
      u.search = new URLSearchParams({
        response_type: "code",
        client_id: app.id,
        redirect_uri: retorno,
        scope: "tweet.read users.read offline.access",
        state: e.estado,
        code_challenge: desafio(e.verificador),
        code_challenge_method: "S256",
      }).toString();
      return u.toString();
    case "openrouter":
      u = new URL("https://openrouter.ai/auth");
      // O OpenRouter não devolve "state": vai dentro do próprio retorno.
      u.search = new URLSearchParams({
        callback_url: `${retorno}?state=${encodeURIComponent(e.estado)}`,
        code_challenge: desafio(e.verificador),
        code_challenge_method: "S256",
      }).toString();
      return u.toString();
  }
}

// ---------------------------------------------------------------------------
// Troca do código
// ---------------------------------------------------------------------------

export type TokensRede = { token: string; refresh: string | null; expiraEm: Date | null };

function emSegundos(v: unknown): Date | null {
  const s = numero(v);
  return s && s > 0 ? new Date(Date.now() + s * 1000) : null;
}

const FORM = { "Content-Type": "application/x-www-form-urlencoded" };

/** Código de volta → tokens da rede. Erros sem token na mensagem. */
export async function trocarCodigoRede(e: EstadoOAuth, codigo: string): Promise<TokensRede> {
  if (e.alvo === "openrouter") throw new Error("alvo de IA");
  const rede = REDE_DO_ALVO[e.alvo];
  const app = appDo(e.alvo);
  if (!app) throw new ErroRede(rede, "entrada", "a conexão automática não está ligada agora. Use o colar token.");
  const retorno = uriRetorno(e.alvo);

  switch (e.alvo) {
    case "youtube":
    case "google-empresa": {
      const r = await pedir(rede, "https://oauth2.googleapis.com/token", {
        metodo: "POST",
        headers: FORM,
        corpo: new URLSearchParams({
          code: codigo,
          client_id: app.id,
          client_secret: app.segredo,
          redirect_uri: retorno,
          grant_type: "authorization_code",
          code_verifier: e.verificador,
        }).toString(),
      });
      const acesso = texto(campo(r.corpo, "access_token"));
      const refresh = texto(campo(r.corpo, "refresh_token"));
      if (r.status !== 200 || !acesso) throw new ErroRede(rede, "token_invalido", "o Google não confirmou a autorização. Tente de novo.");
      const escopos = texto(campo(r.corpo, "scope")) ?? "";
      const precisa = e.alvo === "youtube" ? ["youtube.readonly"] : ["business.manage"];
      if (!precisa.every((p) => escopos.includes(p)))
        throw new ErroRede(rede, "sem_permissao", "faltou marcar a permissão de leitura na tela do Google. Conecte de novo e deixe as caixas marcadas.");
      if (!refresh) throw new ErroRede(rede, "entrada", "o Google não mandou o acesso permanente. Remova a Central em myaccount.google.com/permissions e conecte de novo.");
      // Guarda o de renovação (1//…): não vence; o de acesso sai dele na hora de usar.
      return { token: refresh, refresh: e.alvo === "youtube" ? refresh : null, expiraEm: null };
    }
    case "instagram": {
      const r = await pedir(rede, "https://api.instagram.com/oauth/access_token", {
        metodo: "POST",
        headers: FORM,
        corpo: new URLSearchParams({
          client_id: app.id,
          client_secret: app.segredo,
          grant_type: "authorization_code",
          redirect_uri: retorno,
          code: codigo.replace(/#_$/, ""),
        }).toString(),
      });
      const curto = texto(campo(r.corpo, "access_token")) ?? texto(campo(r.corpo, "data", 0, "access_token"));
      if (r.status !== 200 || !curto) throw new ErroRede(rede, "token_invalido", "o Instagram não confirmou a autorização. Tente de novo.");
      // Curto (1 h) → longo (60 dias, renova sozinho na leitura).
      const u = new URL("https://graph.instagram.com/access_token");
      u.search = new URLSearchParams({ grant_type: "ig_exchange_token", client_secret: app.segredo, access_token: curto }).toString();
      const l = await pedir(rede, u.toString());
      const longo = texto(campo(l.corpo, "access_token"));
      if (l.status !== 200 || !longo) return { token: curto, refresh: null, expiraEm: new Date(Date.now() + 3600_000) };
      return { token: longo, refresh: null, expiraEm: emSegundos(campo(l.corpo, "expires_in")) };
    }
    case "linkedin": {
      const r = await pedir(rede, "https://www.linkedin.com/oauth/v2/accessToken", {
        metodo: "POST",
        headers: FORM,
        corpo: new URLSearchParams({
          grant_type: "authorization_code",
          code: codigo,
          redirect_uri: retorno,
          client_id: app.id,
          client_secret: app.segredo,
        }).toString(),
      });
      const acesso = texto(campo(r.corpo, "access_token"));
      if (r.status !== 200 || !acesso) throw new ErroRede(rede, "token_invalido", "o LinkedIn não confirmou a autorização. Tente de novo.");
      return { token: acesso, refresh: texto(campo(r.corpo, "refresh_token")), expiraEm: emSegundos(campo(r.corpo, "expires_in")) };
    }
    case "x": {
      const r = await pedir(rede, "https://api.x.com/2/oauth2/token", {
        metodo: "POST",
        headers: { ...FORM, Authorization: `Basic ${Buffer.from(`${app.id}:${app.segredo}`).toString("base64")}` },
        corpo: new URLSearchParams({
          code: codigo,
          grant_type: "authorization_code",
          redirect_uri: retorno,
          code_verifier: e.verificador,
          client_id: app.id,
        }).toString(),
      });
      const acesso = texto(campo(r.corpo, "access_token"));
      if (r.status !== 200 || !acesso) throw new ErroRede(rede, "token_invalido", "o X não confirmou a autorização. Tente de novo.");
      return { token: acesso, refresh: texto(campo(r.corpo, "refresh_token")), expiraEm: emSegundos(campo(r.corpo, "expires_in")) };
    }
  }
}

/**
 * Renova com o refresh token (X: o de acesso dura 2 h; LinkedIn: só com
 * refresh liberado). null = a rede não renova por aqui.
 */
export async function renovarRede(rede: RedeConectavel, refresh: string): Promise<TokensRede | null> {
  if (rede === "X") {
    const app = appDo("x");
    if (!app) return null;
    const r = await pedir(rede, "https://api.x.com/2/oauth2/token", {
      metodo: "POST",
      headers: { ...FORM, Authorization: `Basic ${Buffer.from(`${app.id}:${app.segredo}`).toString("base64")}` },
      corpo: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refresh, client_id: app.id }).toString(),
    });
    const acesso = texto(campo(r.corpo, "access_token"));
    if (r.status !== 200 || !acesso) throw new ErroRede(rede, "token_vencido", "a autorização do X caiu. Conecte de novo.");
    // O X troca o refresh a cada uso.
    return { token: acesso, refresh: texto(campo(r.corpo, "refresh_token")) ?? refresh, expiraEm: emSegundos(campo(r.corpo, "expires_in")) };
  }
  if (rede === "LINKEDIN") {
    const app = appDo("linkedin");
    if (!app) return null;
    const r = await pedir(rede, "https://www.linkedin.com/oauth/v2/accessToken", {
      metodo: "POST",
      headers: FORM,
      corpo: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refresh, client_id: app.id, client_secret: app.segredo }).toString(),
    });
    const acesso = texto(campo(r.corpo, "access_token"));
    if (r.status !== 200 || !acesso) throw new ErroRede(rede, "token_vencido", "a autorização do LinkedIn venceu. Conecte de novo.");
    return { token: acesso, refresh: texto(campo(r.corpo, "refresh_token")) ?? refresh, expiraEm: emSegundos(campo(r.corpo, "expires_in")) };
  }
  return null;
}

/** OpenRouter: código → chave da API do cliente (cobrança na conta dele). */
export async function trocarCodigoOpenRouter(e: EstadoOAuth, codigo: string): Promise<string> {
  const r = await fetch("https://openrouter.ai/api/v1/auth/keys", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: codigo, code_verifier: e.verificador, code_challenge_method: "S256" }),
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  }).catch(() => null);
  const j = r?.ok ? ((await r.json().catch(() => null)) as { key?: unknown } | null) : null;
  const chave = typeof j?.key === "string" ? j.key.trim() : "";
  if (!chave) throw new Error("O OpenRouter não confirmou a autorização. Tente de novo.");
  return chave;
}
