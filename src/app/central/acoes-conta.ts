"use server";

/**
 * Conta na Central (menu do avatar): perfil, senha e preferências. Sempre o
 * usuário da sessão.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { abrirSessao } from "@/lib/sessao";
import { conferirSenha, hashSenha } from "@/lib/cripto";
import { prisma } from "@/lib/prisma";

export type ResultadoConta = { ok: boolean; mensagem: string; campo?: string };

async function usuario() {
  const s = await auth();
  if (!s?.user?.id) return { erro: "Entre de novo para continuar." as const };
  return { id: s.user.id };
}

const perfilSchema = z.object({
  nome: z.string().trim().min(2, "Informe seu nome.").max(80, "Nome muito longo."),
  email: z.string().trim().toLowerCase().email("E-mail inválido.").max(160),
  telefone: z
    .string()
    .trim()
    .max(20)
    .transform((v) => v.replace(/[^\d+()\s-]/g, ""))
    .refine((v) => !v || v.replace(/\D/g, "").length >= 10, "WhatsApp com DDD, só números."),
});

export async function salvarPerfilCentral(form: FormData): Promise<ResultadoConta> {
  const u = await usuario();
  if ("erro" in u) return { ok: false, mensagem: u.erro! };
  const d = perfilSchema.safeParse({ nome: form.get("nome") ?? "", email: form.get("email") ?? "", telefone: form.get("telefone") ?? "" });
  if (!d.success) {
    const i = d.error.issues[0];
    return { ok: false, mensagem: i?.message ?? "Confira os campos.", campo: String(i?.path[0] ?? "") };
  }
  const emUso = await prisma.user.findFirst({ where: { email: d.data.email, NOT: { id: u.id } }, select: { id: true } });
  if (emUso) return { ok: false, mensagem: "Este e-mail já está em outra conta.", campo: "email" };
  await prisma.user.update({ where: { id: u.id }, data: { nome: d.data.nome, email: d.data.email, telefone: d.data.telefone || null } });
  revalidatePath("/central", "layout");
  return { ok: true, mensagem: "Dados salvos." };
}

export async function trocarSenhaCentral(form: FormData): Promise<ResultadoConta> {
  const u = await usuario();
  if ("erro" in u) return { ok: false, mensagem: u.erro! };
  const atual = String(form.get("atual") ?? "");
  const nova = String(form.get("nova") ?? "");
  if (nova.length < 8) return { ok: false, mensagem: "A nova senha precisa de 8 caracteres ou mais.", campo: "nova" };
  if (nova.length > 128) return { ok: false, mensagem: "Senha longa demais.", campo: "nova" };
  const user = await prisma.user.findUnique({ where: { id: u.id }, select: { senhaHash: true } });
  if (!user) return { ok: false, mensagem: "Usuário não encontrado." };
  if (!(await conferirSenha(atual, user.senhaHash))) return { ok: false, mensagem: "A senha atual não confere.", campo: "atual" };
  if (await conferirSenha(nova, user.senhaHash)) return { ok: false, mensagem: "A nova senha é igual à atual.", campo: "nova" };
  // Trocar a senha derruba as outras sessões; esta continua aberta.
  const novo = await prisma.user.update({ where: { id: u.id }, data: { senhaHash: await hashSenha(nova), versaoSessao: { increment: 1 } } });
  await abrirSessao(novo.id, novo.versaoSessao);
  return { ok: true, mensagem: "Senha trocada." };
}

export async function salvarPreferenciasCentral(form: FormData): Promise<ResultadoConta> {
  const u = await usuario();
  if ("erro" in u) return { ok: false, mensagem: u.erro! };
  const tema = form.get("tema") === "escuro" ? "escuro" : "claro";
  const notificacoesEmail = form.get("notificacoesEmail") === "on";
  await prisma.user.update({ where: { id: u.id }, data: { temaPanel: tema, temaEscuro: tema === "escuro", notificacoesEmail } });
  revalidatePath("/central", "layout");
  return { ok: true, mensagem: "Preferências salvas." };
}
