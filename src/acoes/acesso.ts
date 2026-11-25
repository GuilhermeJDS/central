"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { enderecoPublico, instalado, marcarPasso } from "@/lib/config";
import { aleatorio, conferirSenha, hashSenha, sha256 } from "@/lib/cripto";
import { db } from "@/lib/db";
import { EmailIndisponivel, enviarEmail } from "@/lib/email";
import { abrirSessao, fecharSessao } from "@/lib/sessao";

export type Resultado = { ok: boolean; mensagem: string; campo?: string } | null;

const senhaForte = z.string().min(8, "A senha precisa de 8 caracteres ou mais.").max(200);

/** Freio simples contra tentativa de senha em massa (por processo). */
const tentativas = new Map<string, { n: number; ate: number }>();
function freio(chave: string) {
  const agora = Date.now();
  const t = tentativas.get(chave);
  if (t && t.ate > agora && t.n >= 8) return false;
  tentativas.set(chave, t && t.ate > agora ? { n: t.n + 1, ate: t.ate } : { n: 1, ate: agora + 15 * 60_000 });
  return true;
}

/** Primeiro acesso: cria a empresa e o dono, e abre o onboarding. */
export async function instalar(_: Resultado, f: FormData): Promise<Resultado> {
  if (await instalado()) redirect("/entrar");
  const r = z
    .object({
      nome: z.string().trim().min(2, "Diga seu nome.").max(80),
      empresa: z.string().trim().min(2, "Diga o nome da empresa.").max(80),
      email: z.string().trim().toLowerCase().email("E-mail inválido."),
      senha: senhaForte,
    })
    .safeParse(Object.fromEntries(f));
  if (!r.success) {
    const i = r.error.issues[0];
    return { ok: false, mensagem: i.message, campo: String(i.path[0] ?? "") };
  }
  const conta = await db.account.create({ data: { nome: r.data.empresa, email: r.data.email } });
  const u = await db.user.create({
    data: { accountId: conta.id, nome: r.data.nome, email: r.data.email, senhaHash: await hashSenha(r.data.senha) },
  });
  await marcarPasso("conta");
  await abrirSessao(u.id, u.versaoSessao);
  redirect("/instalar/ia");
}

export async function entrar(_: Resultado, f: FormData): Promise<Resultado> {
  const email = String(f.get("email") ?? "").trim().toLowerCase();
  const senha = String(f.get("senha") ?? "");
  if (!freio(`login:${email}`)) return { ok: false, mensagem: "Muitas tentativas. Espere 15 minutos." };
  const u = await db.user.findUnique({ where: { email } });
  if (!u || !(await conferirSenha(senha, u.senhaHash))) return { ok: false, mensagem: "E-mail ou senha não conferem." };
  await abrirSessao(u.id, u.versaoSessao);
  tentativas.delete(`login:${email}`);
  redirect("/central");
}

export async function sair() {
  await fecharSessao();
  redirect("/entrar");
}

export async function pedirNovaSenha(_: Resultado, f: FormData): Promise<Resultado> {
  const email = String(f.get("email") ?? "").trim().toLowerCase();
  const neutro: Resultado = { ok: true, mensagem: "Se esse e-mail tem conta, o link chegou. Vale por 1 hora." };
  if (!freio(`senha:${email}`)) return neutro;
  const u = await db.user.findUnique({ where: { email } });
  if (!u) return neutro;
  const token = aleatorio(32);
  await db.tokenSenha.create({ data: { usuarioId: u.id, hash: sha256(token), expiraEm: new Date(Date.now() + 3_600_000) } });
  const link = `${await enderecoPublico()}/redefinir/${token}`;
  try {
    await enviarEmail(u.email, "Trocar a senha", `<p>Para criar uma senha nova, abra o link (vale por 1 hora):</p><p><a href="${link}">${link}</a></p><p>Se não foi você, ignore este e-mail.</p>`);
  } catch (e) {
    if (e instanceof EmailIndisponivel) {
      // Sem e-mail configurado: o link aparece no terminal de quem roda a Central.
      console.log(`\n[senha] E-mail não configurado. Link para ${u.email}:\n${link}\n`);
      return { ok: true, mensagem: "O e-mail ainda não está configurado: o link apareceu no terminal onde a Central roda. Ou rode npm run senha." };
    }
    console.error("[senha]", e);
    return { ok: false, mensagem: "Não consegui enviar o e-mail. Confira o Resend em Conexões." };
  }
  return neutro;
}

export async function redefinirSenha(_: Resultado, f: FormData): Promise<Resultado> {
  const token = String(f.get("token") ?? "");
  const r = senhaForte.safeParse(String(f.get("senha") ?? ""));
  if (!r.success) return { ok: false, mensagem: r.error.issues[0].message };
  const t = await db.tokenSenha.findUnique({ where: { hash: sha256(token) } });
  if (!t || t.usadoEm || t.expiraEm < new Date()) return { ok: false, mensagem: "Link vencido ou já usado. Peça outro." };
  const u = await db.user.update({ where: { id: t.usuarioId }, data: { senhaHash: await hashSenha(r.data), versaoSessao: { increment: 1 } } });
  await db.tokenSenha.update({ where: { id: t.id }, data: { usadoEm: new Date() } });
  await abrirSessao(u.id, u.versaoSessao);
  redirect("/central");
}
