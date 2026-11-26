"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { contaCentral } from "@/app/central/_lib/sessao";
import { salvarGeral } from "@/lib/config";
import { conferirSenha, hashSenha } from "@/lib/cripto";
import { db } from "@/lib/db";
import { abrirSessao, exigirUsuario } from "@/lib/sessao";

export type ResultadoConfig = { ok: boolean; mensagem: string } | null;

const erro = (e: z.ZodError): ResultadoConfig => ({ ok: false, mensagem: e.issues[0]?.message ?? "Confira os campos." });

export async function salvarVoceAcao(_: ResultadoConfig, f: FormData): Promise<ResultadoConfig> {
  const u = await exigirUsuario();
  const r = z.object({ nome: z.string().trim().min(2, "Diga seu nome.").max(80), email: z.string().trim().toLowerCase().email("E-mail inválido.") }).safeParse(Object.fromEntries(f));
  if (!r.success) return erro(r.error);
  if (await db.user.findFirst({ where: { email: r.data.email, NOT: { id: u.id } }, select: { id: true } })) return { ok: false, mensagem: "Esse e-mail já é de outra pessoa." };
  await db.user.update({ where: { id: u.id }, data: r.data });
  revalidatePath("/central", "layout");
  return { ok: true, mensagem: "Salvo." };
}

export async function trocarSenhaAcao(_: ResultadoConfig, f: FormData): Promise<ResultadoConfig> {
  const u = await exigirUsuario();
  const atual = String(f.get("atual") ?? "");
  const nova = String(f.get("nova") ?? "");
  if (nova.length < 8) return { ok: false, mensagem: "A senha nova precisa de 8 caracteres ou mais." };
  const eu = await db.user.findUnique({ where: { id: u.id }, select: { senhaHash: true } });
  if (!eu || !(await conferirSenha(atual, eu.senhaHash))) return { ok: false, mensagem: "A senha atual não confere." };
  const novo = await db.user.update({ where: { id: u.id }, data: { senhaHash: await hashSenha(nova), versaoSessao: { increment: 1 } } });
  await abrirSessao(novo.id, novo.versaoSessao);
  return { ok: true, mensagem: "Senha trocada. As outras sessões caíram." };
}

export async function salvarSistemaAcao(_: ResultadoConfig, f: FormData): Promise<ResultadoConfig> {
  const { accountId } = await contaCentral();
  const r = z
    .object({
      empresa: z.string().trim().min(2, "Diga o nome da empresa.").max(80),
      appUrl: z.union([z.literal(""), z.string().trim().url("Endereço inválido. Ex.: https://central.seudominio.com")]),
    })
    .safeParse(Object.fromEntries(f));
  if (!r.success) return erro(r.error);
  await db.account.update({ where: { id: accountId }, data: { nome: r.data.empresa } });
  await salvarGeral({ appUrl: r.data.appUrl.replace(/\/+$/, "") });
  revalidatePath("/central", "layout");
  return { ok: true, mensagem: "Salvo." };
}

export async function novaPessoaAcao(_: ResultadoConfig, f: FormData): Promise<ResultadoConfig> {
  const { accountId } = await contaCentral();
  const r = z
    .object({ nome: z.string().trim().min(2, "Diga o nome.").max(80), email: z.string().trim().toLowerCase().email("E-mail inválido."), senha: z.string().min(8, "Senha inicial com 8 caracteres ou mais.") })
    .safeParse(Object.fromEntries(f));
  if (!r.success) return erro(r.error);
  if (await db.user.findUnique({ where: { email: r.data.email } })) return { ok: false, mensagem: "Esse e-mail já entra no painel." };
  await db.user.create({ data: { accountId, nome: r.data.nome, email: r.data.email, senhaHash: await hashSenha(r.data.senha) } });
  revalidatePath("/central/configuracoes");
  return { ok: true, mensagem: `${r.data.nome} já pode entrar com esse e-mail e senha.` };
}

export async function removerPessoaAcao(id: string): Promise<void> {
  const u = await exigirUsuario();
  if (id === u.id) return;
  await db.user.deleteMany({ where: { id, accountId: u.accountId } });
  revalidatePath("/central/configuracoes");
}
