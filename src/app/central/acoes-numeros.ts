"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { contaCentral } from "@/app/central/_lib/sessao";
import { prisma } from "@/lib/prisma";

export type ResultadoNumeros = { ok: boolean; mensagem: string } | null;

const inteiro = z.preprocess((v) => (v === "" || v == null ? 0 : Number(String(v).replace(/\D/g, ""))), z.number().int().min(0).max(10_000_000));
const schema = z.object({
  mes: z.string().regex(/^\d{4}-\d{2}$/, "Escolha o mês."),
  receita: z.preprocess((v) => (v === "" || v == null ? 0 : Number(String(v).replace(/\./g, "").replace(",", "."))), z.number().min(0).max(1e10)),
  atendimentos: inteiro,
  cancelados: inteiro,
  faltas: inteiro,
  clientesAtivos: inteiro,
  clientesNovos: inteiro,
  clientesSumidos: inteiro,
});

/** Números do mês digitados em Operação (o agente manda os mesmos pela API). */
export async function salvarNumerosAcao(_: ResultadoNumeros, f: FormData): Promise<ResultadoNumeros> {
  const { accountId } = await contaCentral();
  const r = schema.safeParse(Object.fromEntries(f));
  if (!r.success) return { ok: false, mensagem: r.error.issues[0].message };
  const { mes, receita, ...resto } = r.data;
  const dados = { ...resto, receitaCentavos: Math.round(receita * 100) };
  await prisma.numeroMes.upsert({ where: { accountId_mes: { accountId, mes } }, update: dados, create: { accountId, mes, ...dados } });
  revalidatePath("/central", "layout");
  return { ok: true, mensagem: "Números salvos. O Gerente Rotina lê na próxima leitura." };
}
