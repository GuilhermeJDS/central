/**
 * Entrada da Central: qualquer usuário logado. Nada de nicho, unidade,
 * cookie de unidade ou estado do plano: a Central é isolada do painel atual
 * e nunca manda para /dashboard. Conta NÃO é exigida: sem conta a Central
 * abre inteira com dados de exemplo.
 *
 * Conta usada: sempre a do usuário logado (inclusive o SUPER_ADMIN). Não
 * existe escolha de conta: sem conta própria, a Central mostra o exemplo.
 *
 * Acesso: toda conta vê a Central com os próprios dados. Trial vigente ou
 * plano pago usa tudo; trial vencido / sem plano pago só vê (gerar, aprovar e
 * pedir abrem "Escolha um plano para continuar"). Compras seguem liberadas.
 *
 * Chefes: só rodam com a conta liberada (lib/central/liberacao) e com a
 * chave de IA do próprio cliente (Conexões → Chave de IA). A Central nunca
 * usa a chave do ambiente (.env), em nenhum caso (nem SUPER_ADMIN).
 */
import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { auth } from "@/lib/auth";
import { centralLiberada, podeGerarChefes } from "@/lib/central/liberacao";
import { SemChaveIA } from "@/lib/ia/credencial";
import { prisma } from "@/lib/prisma";

export type SessaoCentral =
  | {
      estado: "ok";
      accountId: string | null;
      primeiroNome: string;
      nomeConta: string | null;
      /** SUPER_ADMIN (não vê conta alheia; também precisa da própria chave). */
      admin: boolean;
      /** Trial vigente ou plano pago (estadoContaCanonico.temAcessoGeral): usa tudo. */
      liberado: boolean;
    }
  | { estado: "sem_acesso" };

async function nomeDaConta(accountId: string): Promise<string | null> {
  const a = await prisma.account.findUnique({
    where: { id: accountId },
    select: { nome: true, fichaNegocio: { select: { nomeNegocio: true } } },
  });
  if (!a) return null;
  return a.fichaNegocio?.nomeNegocio || a.nome;
}

/** Sem sessão → /login. Os outros casos voltam como estado para a tela mostrar. */
export const sessaoCentral = cache(async (): Promise<SessaoCentral> => {
  const session = await auth();
  if (!session?.user) redirect(`/login?redirect=${encodeURIComponent("/central")}`);
  const admin = session.user.role === "SUPER_ADMIN";
  const primeiroNome = (session.user.name ?? "").trim().split(/\s+/)[0] ?? "";

  const accountId = session.user.accountId ?? null;
  const nome = accountId ? await nomeDaConta(accountId) : null;
  if (!accountId || nome === null)
    return { estado: "ok", accountId: null, primeiroNome, nomeConta: null, admin, liberado: false };
  const liberado = await centralLiberada(accountId);
  return { estado: "ok", accountId, primeiroNome, nomeConta: nome, admin, liberado };
});

export const MENSAGEM_ESCOLHA_PLANO = "Escolha um plano para continuar.";

/** Só leitura (status de pedido, posts, imagens): basta ter conta, liberada ou não. */
export async function contaCentralLeitura(): Promise<{ accountId: string }> {
  const s = await sessaoCentral();
  if (s.estado !== "ok") throw new Error("Sem acesso à Central.");
  if (!s.accountId) throw new Error("Sem conta nesta Central.");
  return { accountId: s.accountId };
}

/**
 * Para o que escreve (aprovar, pedir, editar): sem liberação = erro. A tela
 * já abre "Escolha um plano para continuar"; isto é a trava do servidor.
 */
export async function contaCentral(): Promise<{ accountId: string }> {
  const s = await sessaoCentral();
  const { accountId } = await contaCentralLeitura();
  if (s.estado !== "ok" || !s.liberado) throw new Error(MENSAGEM_ESCOLHA_PLANO);
  return { accountId };
}

/** Conta liberada (trial ou pago) com a chave de IA do próprio cliente conectada. */
export async function podeGerarNaCentral(accountId: string): Promise<boolean> {
  const s = await sessaoCentral();
  return podeGerarChefes(accountId, { liberado: s.estado === "ok" && s.liberado });
}

/** Trava das ações que chamam o modelo (pedido, ajuste, Norte). */
export async function contaCentralGeracao(): Promise<{ accountId: string }> {
  const { accountId } = await contaCentral();
  if (!(await podeGerarNaCentral(accountId))) throw new SemChaveIA();
  return { accountId };
}

/** Tema da Central: segue o tema do painel do usuário (executivo vira escuro). */
export type TemaCentral = "claro" | "escuro";
export const temaCentral = cache(async (): Promise<TemaCentral> => {
  const session = await auth();
  if (!session?.user?.id) return "claro";
  const u = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { temaPanel: true, temaEscuro: true },
  });
  if (!u) return "claro";
  if (u.temaPanel === "escuro" || u.temaPanel === "executivo") return "escuro";
  if (u.temaPanel === "claro") return "claro";
  return u.temaEscuro ? "escuro" : "claro";
});
