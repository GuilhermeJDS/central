/**
 * Início do "Conectar com…": guarda o estado (cookie cifrado) e manda a
 * pessoa para a tela oficial da plataforma.
 */
import { NextResponse } from "next/server";

import { enderecoPublico } from "@/lib/config";
import { ehAlvoOAuth, novoEstado, oauthLigado, urlAutorizacao } from "@/lib/redes/oauth";

import { donoDaSessao, gravarEstado, voltar } from "../_comum";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ alvo: string }> }) {
  const { alvo } = await params;
  if (!ehAlvoOAuth(alvo) || !oauthLigado(alvo)) return voltar({ ok: false, mensagem: "Essa conexão automática não está ligada. Use o colar token." }, request);

  // Endereço da Central: o salvo em Configurações, o APP_URL ou o desta requisição.
  // Se o endereço oficial for outro domínio, o cookie tem que nascer lá: vai para ele.
  const enderecoBase = process.env.OAUTH_BASE_URL?.trim() || (await enderecoPublico(request));
  const aqui = new URL(request.url);
  const base = new URL(enderecoBase);
  if (aqui.host !== base.host) return NextResponse.redirect(new URL(aqui.pathname, base).toString(), 307);

  const dono = await donoDaSessao();
  if ("erro" in dono) {
    if (dono.erro === "login") return NextResponse.redirect(`${enderecoBase}/entrar`, 303);
    return voltar({ ok: false, mensagem: dono.erro === "papel" ? "Só o dono da conta conecta as contas." : "Nenhuma conta nesta Central." }, request);
  }

  const e = novoEstado(alvo, dono.accountId, enderecoBase);
  const res = NextResponse.redirect(urlAutorizacao(e), 303);
  gravarEstado(res, e);
  return res;
}
