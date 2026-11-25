import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { assinar, iguais } from "@/lib/cripto";
import { instalado } from "@/lib/config";
import { db } from "@/lib/db";

const COOKIE = "central_sessao";
const DURACAO_S = 60 * 60 * 24 * 30;

/** Cookie: id.versao.expira.assinatura (HMAC com o segredo do sistema). */
export async function abrirSessao(usuarioId: string, versao: number) {
  const expira = Math.floor(Date.now() / 1000) + DURACAO_S;
  const corpo = `${usuarioId}.${versao}.${expira}`;
  (await cookies()).set(COOKIE, `${corpo}.${await assinar(corpo)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && !process.env.APP_URL?.startsWith("http://"),
    path: "/",
    maxAge: DURACAO_S,
  });
}

export async function fecharSessao() {
  (await cookies()).delete(COOKIE);
}

export const usuarioAtual = cache(async () => {
  const valor = (await cookies()).get(COOKIE)?.value;
  if (!valor) return null;
  const [id, versao, expira, sig] = valor.split(".");
  if (!id || !versao || !expira || !sig) return null;
  if (Number(expira) < Date.now() / 1000) return null;
  if (!iguais(sig, await assinar(`${id}.${versao}.${expira}`))) return null;
  const u = await db.user.findUnique({ where: { id }, select: { id: true, nome: true, email: true, versaoSessao: true, accountId: true } });
  if (!u || u.versaoSessao !== Number(versao)) return null;
  return { id: u.id, nome: u.nome, email: u.email, accountId: u.accountId };
});

/** Para páginas e ações do painel: sem instalação vai para /instalar, sem login para /entrar. */
export async function exigirUsuario() {
  const u = await usuarioAtual();
  if (u) return u;
  if (!(await instalado())) redirect("/instalar");
  redirect("/entrar");
}
