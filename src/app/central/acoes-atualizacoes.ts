"use server";

import { revalidatePath } from "next/cache";

import { atualizarAgora, catalogo, instalarSkill, logAtualizacao, marcarTudoVisto, projetos, removerSkill } from "@/lib/atualizacoes";
import { exigirUsuario } from "@/lib/sessao";

export type ResultadoAt = { ok: boolean; mensagem: string };

export async function verificarAgoraAcao(): Promise<ResultadoAt> {
  await exigirUsuario();
  const [c, p] = await Promise.all([catalogo(true), projetos(true)]);
  revalidatePath("/central", "layout");
  const erro = c.erro ?? p.erro;
  return erro ? { ok: false, mensagem: `Não consegui falar com o GitHub agora (${erro}). Mostrando o que já tinha.` } : { ok: true, mensagem: "Conferido agora no GitHub." };
}

export async function atualizarCentralAcao(): Promise<ResultadoAt> {
  await exigirUsuario();
  return atualizarAgora();
}

export async function logAtualizacaoAcao(): Promise<string> {
  await exigirUsuario();
  return logAtualizacao();
}

export async function instalarSkillAcao(slug: string): Promise<ResultadoAt> {
  await exigirUsuario();
  const r = await instalarSkill(slug);
  revalidatePath("/central", "layout");
  return r;
}

export async function removerSkillAcao(slug: string): Promise<ResultadoAt> {
  await exigirUsuario();
  await removerSkill(slug);
  revalidatePath("/central", "layout");
  return { ok: true, mensagem: "Skill removida." };
}

export async function marcarVistoAcao() {
  await exigirUsuario();
  await marcarTudoVisto();
  revalidatePath("/central", "layout");
}
