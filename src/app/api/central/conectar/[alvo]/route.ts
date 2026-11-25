/**
 * Início do "Conectar com…": guarda o estado (cookie cifrado) e manda a
 * pessoa para a tela oficial da plataforma.
 */
import { NextResponse } from "next/server";

import { baseApp, ehAlvoOAuth, novoEstado, oauthLigado, urlAutorizacao } from "@/lib/redes/oauth";

import { donoDaSessao, gravarEstado, voltar } from "../_comum";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ alvo: string }> }) {
  const { alvo } = await params;
  if (!ehAlvoOAuth(alvo) || !oauthLigado(alvo)) return voltar({ ok: false, mensagem: "Essa conexão automática não está ligada. Use o colar token." });

  // O retorno cadastrado nas plataformas é o do domínio principal: o cookie tem que nascer lá.
  const aqui = new URL(request.url);
  const base = new URL(baseApp());
  if (aqui.host !== base.host) return NextResponse.redirect(new URL(aqui.pathname, base).toString(), 307);

  const dono = await donoDaSessao();
  if ("erro" in dono) {
    if (dono.erro === "login") return NextResponse.redirect(`${baseApp()}/login?redirect=${encodeURIComponent("/central/conexoes")}`, 303);
    return voltar({ ok: false, mensagem: dono.erro === "papel" ? "Só o dono da conta conecta as contas." : "Nenhuma conta nesta Central." });
  }

  const e = novoEstado(alvo, dono.accountId);
  const res = NextResponse.redirect(urlAutorizacao(e), 303);
  gravarEstado(res, e);
  return res;
}
