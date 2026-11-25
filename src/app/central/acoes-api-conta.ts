"use server";

/**
 * Chaves da API da conta (Conexões › API e MCP). accountId sempre da sessão
 * da Central; só o dono (CLIENT_ADMIN) ou o SUPER_ADMIN cria e revoga. Não
 * exige plano para criar: as ações que escrevem checam a liberação na hora.
 */
import { revalidatePath } from "next/cache";

import { sessaoCentral } from "@/app/central/_lib/sessao";
import { esquecerChaveConta, gerarChaveConta, MAX_CHAVES_ATIVAS } from "@/lib/api-conta/chaves";
import { ehEscopoConta } from "@/lib/api-conta/escopos";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type ResultadoNovaChave = { ok: true; chave: string; prefixo: string } | { ok: false; mensagem: string };

async function dono(): Promise<{ accountId: string; userId: string | null } | { ok: false; mensagem: string }> {
  const [s, session] = await Promise.all([sessaoCentral(), auth()]);
  if (s.estado !== "ok" || !s.accountId) return { ok: false, mensagem: "Nenhuma conta nesta Central." };
  const papel = session?.user?.role;
  if (papel !== "CLIENT_ADMIN" && papel !== "SUPER_ADMIN")
    return { ok: false, mensagem: "Só o dono da conta cria e revoga chaves." };
  return { accountId: s.accountId, userId: session?.user?.id ?? null };
}

export async function criarChaveContaAcao(form: FormData): Promise<ResultadoNovaChave> {
  const d = await dono();
  if (!("accountId" in d)) return d;
  const nome = String(form.get("nome") ?? "").trim().slice(0, 60);
  if (nome.length < 2) return { ok: false, mensagem: "Dê um nome para a chave (ex.: Claude Code)." };
  const escopos = [...new Set(form.getAll("escopos").map(String))].filter(ehEscopoConta);
  if (escopos.length === 0) return { ok: false, mensagem: "Escolha pelo menos um escopo." };

  const ativas = await prisma.chaveConta.count({ where: { accountId: d.accountId, revogadaEm: null } });
  if (ativas >= MAX_CHAVES_ATIVAS)
    return { ok: false, mensagem: `Já são ${MAX_CHAVES_ATIVAS} chaves ativas. Revogue uma antes de criar outra.` };

  const { chave, prefixo, hash } = gerarChaveConta();
  await prisma.chaveConta.create({
    data: { accountId: d.accountId, nome, prefixo, hash, escopos, criadoPorId: d.userId },
  });
  revalidatePath("/central/conexoes");
  return { ok: true, chave, prefixo };
}

export async function revogarChaveContaAcao(id: string): Promise<{ ok: boolean; mensagem?: string }> {
  const d = await dono();
  if (!("accountId" in d)) return d;
  const alvo = String(id).slice(0, 64);
  const { count } = await prisma.chaveConta.updateMany({
    where: { id: alvo, accountId: d.accountId, revogadaEm: null },
    data: { revogadaEm: new Date() },
  });
  esquecerChaveConta(alvo);
  revalidatePath("/central/conexoes");
  return count ? { ok: true } : { ok: false, mensagem: "Essa chave já não está ativa." };
}
