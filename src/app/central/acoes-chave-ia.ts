"use server";

/**
 * Chave de IA na Central (Conexões). accountId sempre da sessão da Central;
 * só o dono (CLIENT_ADMIN) ou o SUPER_ADMIN mexe. Não exige plano: dá para
 * conectar a chave antes de assinar.
 */
import { revalidatePath } from "next/cache";

import { sessaoCentral } from "@/app/central/_lib/sessao";
import { auth } from "@/lib/auth";
import {
  apagarChave,
  modelosDaChaveNova,
  modelosDaChaveSalva,
  salvarChave,
  salvarModeloChefe,
  testarChaveGuardada,
  usarChave,
  type ResultadoChave,
  type ResultadoModelos,
} from "@/lib/ia/chaves-conta";

async function dono(): Promise<{ accountId: string } | { ok: false; mensagem: string }> {
  const [s, session] = await Promise.all([sessaoCentral(), auth()]);
  if (s.estado !== "ok" || !s.accountId) return { ok: false, mensagem: "Nenhuma conta nesta Central." };
  const papel = session?.user?.role;
  if (papel !== "CLIENT_ADMIN" && papel !== "SUPER_ADMIN") return { ok: false, mensagem: "Só o dono da conta mexe na chave de IA." };
  return { accountId: s.accountId };
}

/** Lista real de modelos da chave recém-colada (nada é gravado). */
export async function modelosChaveNovaCentralAcao(provedor: string, chave: string): Promise<ResultadoModelos> {
  const d = await dono();
  if (!("accountId" in d)) return d;
  return modelosDaChaveNova(provedor, chave);
}

/** Lista real de modelos de uma chave já guardada. */
export async function modelosChaveSalvaCentralAcao(provedor: string): Promise<ResultadoModelos> {
  const d = await dono();
  if (!("accountId" in d)) return d;
  return modelosDaChaveSalva(d.accountId, provedor);
}

async function rodar(fn: (accountId: string) => Promise<ResultadoChave>): Promise<ResultadoChave> {
  const [s, session] = await Promise.all([sessaoCentral(), auth()]);
  if (s.estado !== "ok" || !s.accountId) return { ok: false, mensagem: "Nenhuma conta nesta Central." };
  const papel = session?.user?.role;
  if (papel !== "CLIENT_ADMIN" && papel !== "SUPER_ADMIN") return { ok: false, mensagem: "Só o dono da conta mexe na chave de IA." };
  const r = await fn(s.accountId);
  if (r.ok) revalidatePath("/central", "layout");
  return r;
}

export async function salvarChaveIaCentralAcao(form: FormData): Promise<ResultadoChave> {
  return rodar((id) => salvarChave(id, form.get("provedor"), form.get("chave"), form.get("modelo")));
}

export async function usarChaveIaCentralAcao(provedor: string): Promise<ResultadoChave> {
  return rodar((id) => usarChave(id, provedor));
}

export async function apagarChaveIaCentralAcao(provedor: string): Promise<ResultadoChave> {
  return rodar((id) => apagarChave(id, provedor));
}

export async function salvarModeloChefeCentralAcao(chefe: string, escolha: string): Promise<ResultadoChave> {
  return rodar((id) => salvarModeloChefe(id, chefe, escolha));
}

export async function testarChaveIaCentralAcao(provedor: string): Promise<ResultadoChave> {
  return rodar((id) => testarChaveGuardada(id, provedor));
}
