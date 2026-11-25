/**
 * Volta do "Conectar com…": confere estado + conta, troca o código pelos
 * tokens, testa a conta de verdade e grava cifrado. Sempre termina em
 * Conexões com um aviso.
 */
import { revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";

import { conectarOpenRouter } from "@/lib/ia/chaves-conta";
import { conectarRedeOAuth } from "@/lib/redes/contas";
import { CATALOGO_REDES } from "@/lib/redes/catalogo";
import { ehAlvoOAuth, REDE_DO_ALVO, trocarCodigoOpenRouter, trocarCodigoRede } from "@/lib/redes/oauth";
import { ErroRede } from "@/lib/redes/tipos";

import { COOKIE_OAUTH, donoDaSessao, lerEstado, voltar } from "../../_comum";

export const dynamic = "force-dynamic";

function nomeDo(alvo: string): string {
  if (alvo === "openrouter") return "OpenRouter";
  return ehAlvoOAuth(alvo) && alvo !== "openrouter" ? CATALOGO_REDES[REDE_DO_ALVO[alvo]].nome : "A plataforma";
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ alvo: string }> }) {
  const { alvo } = await params;
  const q = request.nextUrl.searchParams;
  const nome = nomeDo(alvo);

  if (q.get("error")) {
    const cancelou = /denied|cancel/i.test(`${q.get("error")} ${q.get("error_reason") ?? ""}`);
    return voltar({ ok: false, mensagem: cancelou ? `${nome}: a autorização foi cancelada. Nada foi conectado.` : `${nome} recusou a autorização. Tente de novo.` });
  }

  const e = lerEstado(request.cookies.get(COOKIE_OAUTH)?.value);
  const codigo = q.get("code");
  if (!e || e.alvo !== alvo || q.get("state") !== e.estado || !codigo)
    return voltar({ ok: false, mensagem: `${nome}: a conexão expirou ou veio de outra aba. Clique em Conectar de novo.` });

  const dono = await donoDaSessao();
  if ("erro" in dono || dono.accountId !== e.accountId)
    return voltar({ ok: false, mensagem: "A sessão mudou no meio da conexão. Entre de novo e conecte." });

  try {
    if (e.alvo === "openrouter") {
      const chave = await trocarCodigoOpenRouter(e, codigo);
      const r = await conectarOpenRouter(dono.accountId, chave);
      revalidatePath("/central", "layout");
      return voltar(r);
    }
    const rede = REDE_DO_ALVO[e.alvo];
    const tokens = await trocarCodigoRede(e, codigo);
    const r = await conectarRedeOAuth(dono.accountId, rede, tokens);
    if (r.ok) revalidatePath("/central", "layout");
    return voltar(r);
  } catch (err) {
    const msg = err instanceof ErroRede || (err instanceof Error && e.alvo === "openrouter") ? err.message : `${nome}: não deu para conectar agora. Tente de novo em instantes.`;
    return voltar({ ok: false, mensagem: msg });
  }
}
