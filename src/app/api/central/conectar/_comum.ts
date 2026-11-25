/**
 * Partes comuns do "Conectar com…" da Central: cookie do estado (cifrado),
 * dono da conta e a volta para Conexões com o aviso (cifrado, à prova de
 * link forjado).
 */
import "server-only";

import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { cifrar, decifrar } from "@/lib/ia/cofre";
import { baseApp, ehAlvoOAuth, type EstadoOAuth } from "@/lib/redes/oauth";

export const COOKIE_OAUTH = "central_oauth";
export const VALIDADE_ESTADO_MS = 10 * 60_000;

/** Só o dono (CLIENT_ADMIN) ou o SUPER_ADMIN, sempre com a conta da sessão. */
export async function donoDaSessao(): Promise<{ accountId: string } | { erro: "login" | "papel" | "conta" }> {
  const session = await auth();
  if (!session?.user) return { erro: "login" };
  const papel = session.user.role;
  if (papel !== "CLIENT_ADMIN" && papel !== "SUPER_ADMIN") return { erro: "papel" };
  if (!session.user.accountId) return { erro: "conta" };
  return { accountId: session.user.accountId };
}

export function gravarEstado(res: NextResponse, e: EstadoOAuth): void {
  res.cookies.set(COOKIE_OAUTH, cifrar(JSON.stringify(e)), {
    httpOnly: true,
    secure: baseApp().startsWith("https://"),
    // lax: o cookie volta no redirecionamento GET vindo da plataforma.
    sameSite: "lax",
    path: "/api/central/conectar",
    maxAge: VALIDADE_ESTADO_MS / 1000,
  });
}

export function lerEstado(bruto: string | undefined): EstadoOAuth | null {
  if (!bruto) return null;
  try {
    const e = JSON.parse(decifrar(bruto)) as EstadoOAuth;
    if (!e || !ehAlvoOAuth(e.alvo) || typeof e.estado !== "string" || typeof e.verificador !== "string") return null;
    if (typeof e.em !== "number" || Date.now() - e.em > VALIDADE_ESTADO_MS) return null;
    return e;
  } catch {
    return null;
  }
}

export type AvisoConexao = { ok: boolean; mensagem: string };

/** De volta para Conexões com o aviso cifrado em ?r= (a página decifra). */
export function voltar(aviso: AvisoConexao): NextResponse {
  const u = new URL(`${baseApp()}/central/conexoes`);
  u.searchParams.set("r", cifrar(JSON.stringify({ ...aviso, em: Date.now() })));
  const res = NextResponse.redirect(u.toString(), 303);
  res.cookies.delete({ name: COOKIE_OAUTH, path: "/api/central/conectar" });
  return res;
}

/** Lê o aviso de ?r= (só vale por 5 min; link adulterado vira null). */
export function lerAviso(r: string | undefined): AvisoConexao | null {
  if (!r) return null;
  try {
    const j = JSON.parse(decifrar(r)) as AvisoConexao & { em?: number };
    if (typeof j.mensagem !== "string" || typeof j.em !== "number" || Date.now() - j.em > 5 * 60_000) return null;
    return { ok: !!j.ok, mensagem: j.mensagem.slice(0, 400) };
  } catch {
    return null;
  }
}
