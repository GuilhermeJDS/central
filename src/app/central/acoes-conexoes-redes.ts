"use server";

/**
 * Contas das redes na Central (Conexões). accountId sempre da sessão da
 * Central; só o dono (CLIENT_ADMIN) ou o SUPER_ADMIN mexe. Não exige plano.
 * O token só passa por aqui a caminho do teste e do cofre; nunca volta.
 */
import { revalidatePath } from "next/cache";

import { sessaoCentral } from "@/app/central/_lib/sessao";
import { auth } from "@/lib/auth";
import { apagarConexao, conectarRede, testarConexao, type CamposConexao, type ResultadoConexao, type ResultadoTesteConexao } from "@/lib/redes/contas";

async function rodar(fn: (accountId: string) => Promise<ResultadoConexao>): Promise<ResultadoConexao> {
  const [s, session] = await Promise.all([sessaoCentral(), auth()]);
  if (s.estado !== "ok" || !s.accountId) return { ok: false, mensagem: "Nenhuma conta nesta Central." };
  const papel = session?.user?.role;
  if (papel !== "CLIENT_ADMIN" && papel !== "SUPER_ADMIN")
    return { ok: false, mensagem: "Só o dono da conta mexe nas contas das redes." };
  try {
    const r = await fn(s.accountId);
    if (r.ok) revalidatePath("/central", "layout");
    return r;
  } catch {
    return { ok: false, mensagem: "Não deu para salvar agora. Tente de novo em instantes." };
  }
}

function campos(form: FormData): CamposConexao {
  return {
    token: form.get("token"),
    oauth: form.get("oauth"),
    canal: form.get("canal"),
    usuario: form.get("usuario"),
    clientId: form.get("clientId"),
    clientSecret: form.get("clientSecret"),
    appId: form.get("appId"),
    appSecret: form.get("appSecret"),
  };
}

export async function conectarRedeCentralAcao(form: FormData): Promise<ResultadoConexao> {
  return rodar((id) => conectarRede(id, form.get("rede"), campos(form)));
}

/** "Testar" do guia: chama a rede de verdade, sem gravar nada. */
export async function testarRedeCentralAcao(form: FormData): Promise<ResultadoTesteConexao> {
  const [s, session] = await Promise.all([sessaoCentral(), auth()]);
  if (s.estado !== "ok" || !s.accountId) return { ok: false, mensagem: "Nenhuma conta nesta Central." };
  const papel = session?.user?.role;
  if (papel !== "CLIENT_ADMIN" && papel !== "SUPER_ADMIN") return { ok: false, mensagem: "Só o dono da conta testa os tokens das redes." };
  try {
    return await testarConexao(form.get("rede"), campos(form));
  } catch {
    return { ok: false, mensagem: "Não deu para testar agora. Tente de novo em instantes." };
  }
}

export async function apagarRedeCentralAcao(rede: string): Promise<ResultadoConexao> {
  return rodar((id) => apagarConexao(id, rede));
}
