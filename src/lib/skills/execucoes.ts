/**
 * Registro das execuções dos chefes (chefe → skill → revisor).
 *
 * O `accountId` sempre vem da sessão no servidor; toda função filtra por ele.
 */
import "server-only";

import type {
  Departamento,
  ExecucaoSkill,
  Prisma,
  TipoExecucao,
} from "@/generated/prisma/client";
import type { OrigemChave } from "@/lib/ia/credencial";
import type { ProvedorIA } from "@/lib/ia/provedores/catalogo";
import { prisma } from "@/lib/prisma";

/**
 * Preço em US$ por milhão de tokens (entrada sem cache / saída), preço padrão
 * de cada provedor. Conferido em 2026-11-11 nas páginas oficiais:
 * - Anthropic: platform.claude.com (pricing) — Opus 5.5, Sonnet 5.5, Haiku 5.5
 *   (Haiku: até 100 mil tokens de entrada; acima, 0,50 / 2,50).
 * - OpenAI: developers.openai.com/api/docs/pricing — gpt-5, gpt-5-mini e
 *   gpt-4.1 aparecem como "deprecated", mas ainda com preço.
 * - Google: ai.google.dev/gemini-api/docs/pricing — 2.5 Pro até 200 mil
 *   tokens de entrada (acima: 2,50 / 15,00).
 * - DeepSeek: api-docs.deepseek.com/quick_start/pricing — deepseek-chat e
 *   deepseek-reasoner foram aposentados em 24/07/2026 e apontavam para o
 *   deepseek-v4-flash (sem e com raciocínio): ficam com o preço dele.
 * - xAI: docs.x.ai/developers/pricing — grok-4 e grok-3-mini foram aposentados
 *   em 15/05/2026 e são cobrados pelo preço do grok-4.3.
 * Modelo fora da tabela: custo 0 e aviso no log.
 */
export const PRECO_POR_MILHAO: Record<string, { entrada: number; saida: number }> = {
  // Anthropic
  "claude-opus-5-5": { entrada: 4.0, saida: 20.0 },
  "claude-sonnet-5-5": { entrada: 2.0, saida: 10.0 },
  "claude-haiku-5-5": { entrada: 0.1, saida: 0.5 },
  // OpenAI
  "gpt-5": { entrada: 1.25, saida: 10.0 },
  "gpt-5-mini": { entrada: 0.25, saida: 2.0 },
  "gpt-4.1": { entrada: 2.0, saida: 8.0 },
  "gpt-4.1-mini": { entrada: 0.4, saida: 1.6 },
  // Google
  "gemini-2.5-pro": { entrada: 1.25, saida: 10.0 },
  "gemini-2.5-flash": { entrada: 0.3, saida: 2.5 },
  // DeepSeek
  "deepseek-v4-flash": { entrada: 0.14, saida: 0.28 },
  "deepseek-v4-pro": { entrada: 0.435, saida: 0.87 },
  "deepseek-chat": { entrada: 0.14, saida: 0.28 },
  "deepseek-reasoner": { entrada: 0.14, saida: 0.28 },
  // xAI
  "grok-4.7": { entrada: 2.0, saida: 6.0 },
  "grok-4.3": { entrada: 1.25, saida: 2.5 },
  "grok-4": { entrada: 1.25, saida: 2.5 },
  "grok-3-mini": { entrada: 1.25, saida: 2.5 },
};

/**
 * Custo em milionésimos de dólar (inteiro).
 * US$ por milhão de tokens == micro-US$ por token, então
 * custo = tokens × preço. Conta em centavos para não acumular erro de float.
 */
export function calcularCustoMicroUsd(
  modelo: string,
  tokensEntrada: number,
  tokensSaida: number,
): number {
  const preco = PRECO_POR_MILHAO[modelo];
  if (!preco) {
    console.warn(`[execucoes] modelo sem preço na tabela: "${modelo}" (custo 0)`);
    return 0;
  }
  const centEntrada = Math.round(preco.entrada * 100);
  const centSaida = Math.round(preco.saida * 100);
  return Math.round((tokensEntrada * centEntrada + tokensSaida * centSaida) / 100);
}

export type NovaExecucao = {
  accountId: string;
  departamento: Departamento;
  chefe: string;
  tipo: TipoExecucao;
  repositorio?: string | null;
  skill?: string | null;
  execucaoPaiId?: string | null;
  entrada: Prisma.InputJsonValue;
};

/**
 * O "acao" da entrada vira coluna própria: filtrar dentro do JSON tem sintaxe
 * diferente no Postgres e no SQLite, e a coluna funciona igual nos dois.
 */
function acaoDaEntrada(entrada: Prisma.InputJsonValue): string | null {
  if (entrada && typeof entrada === "object" && !Array.isArray(entrada)) {
    const a = (entrada as Record<string, unknown>).acao;
    if (typeof a === "string") return a;
  }
  return null;
}

export async function criarExecucao(dados: NovaExecucao): Promise<ExecucaoSkill> {
  if (dados.execucaoPaiId) {
    // A execução pai precisa ser do mesmo negócio.
    const pai = await prisma.execucaoSkill.findFirst({
      where: { id: dados.execucaoPaiId, accountId: dados.accountId },
      select: { id: true },
    });
    if (!pai) throw new Error("Execução pai não encontrada para este negócio.");
  }
  return prisma.execucaoSkill.create({
    data: {
      accountId: dados.accountId,
      departamento: dados.departamento,
      chefe: dados.chefe,
      tipo: dados.tipo,
      repositorio: dados.repositorio ?? null,
      skill: dados.skill ?? null,
      execucaoPaiId: dados.execucaoPaiId ?? null,
      entrada: dados.entrada,
      acao: acaoDaEntrada(dados.entrada),
      status: "NA_FILA",
    },
  });
}

async function atualizarDoNegocio(
  accountId: string,
  id: string,
  data: Prisma.ExecucaoSkillUpdateManyMutationInput,
): Promise<void> {
  const { count } = await prisma.execucaoSkill.updateMany({
    where: { id, accountId },
    data,
  });
  if (count === 0) throw new Error("Execução não encontrada para este negócio.");
}

export async function marcarRodando(accountId: string, id: string): Promise<void> {
  await atualizarDoNegocio(accountId, id, {
    status: "RODANDO",
    iniciadaEm: new Date(),
  });
}

export async function concluirExecucao(
  accountId: string,
  id: string,
  r: {
    saida: string;
    /** Título curto da decisão (só SKILL), gerado junto com a saída. */
    titulo?: string | null;
    modelo: string;
    tokensEntrada: number;
    tokensSaida: number;
    /** null/ausente: não chamou modelo (busca, cálculo em código). */
    provedor?: ProvedorIA | null;
    /** "cliente": rodou na chave do cliente, custo 0 para a Central. */
    origem?: OrigemChave;
  },
): Promise<void> {
  await atualizarDoNegocio(accountId, id, {
    status: "CONCLUIDA",
    saida: r.saida,
    ...(r.titulo ? { titulo: r.titulo } : {}),
    modelo: r.modelo,
    tokensEntrada: r.tokensEntrada,
    tokensSaida: r.tokensSaida,
    provedor: r.provedor ?? null,
    custoMicroUsd: r.origem === "cliente" ? 0 : calcularCustoMicroUsd(r.modelo, r.tokensEntrada, r.tokensSaida),
    concluidaEm: new Date(),
  });
  // Regra: toda execução SKILL concluída nasce com decisão PENDENTE (Central).
  await prisma.execucaoSkill.updateMany({
    where: { id, accountId, tipo: "SKILL", decisao: null },
    data: { decisao: "PENDENTE" },
  });
}

/** Soma uma chamada extra (ex.: título de reserva) ao custo da execução. */
export async function somarUso(
  accountId: string,
  id: string,
  u: { modelo: string; tokensEntrada: number; tokensSaida: number; origem?: OrigemChave },
): Promise<void> {
  await atualizarDoNegocio(accountId, id, {
    tokensEntrada: { increment: u.tokensEntrada },
    tokensSaida: { increment: u.tokensSaida },
    custoMicroUsd: { increment: u.origem === "cliente" ? 0 : calcularCustoMicroUsd(u.modelo, u.tokensEntrada, u.tokensSaida) },
  });
}

/** Grava o título curto da decisão. */
export async function gravarTitulo(accountId: string, id: string, titulo: string): Promise<void> {
  await atualizarDoNegocio(accountId, id, { titulo });
}

export async function falharExecucao(
  accountId: string,
  id: string,
  erro: string,
  recusada = false,
): Promise<void> {
  await atualizarDoNegocio(accountId, id, {
    status: recusada ? "RECUSADA" : "ERRO",
    erro,
    concluidaEm: new Date(),
  });
}

/** Últimas execuções concluídas do departamento — o chefe lê para não se repetir. */
export async function ultimasExecucoes(
  accountId: string,
  departamento: Departamento,
  limite = 10,
): Promise<ExecucaoSkill[]> {
  return prisma.execucaoSkill.findMany({
    where: { accountId, departamento, status: "CONCLUIDA" },
    orderBy: { criadaEm: "desc" },
    take: Math.min(Math.max(1, limite), 100),
  });
}

/** Início do mês corrente no fuso de São Paulo (UTC-3, sem horário de verão). */
function inicioDoMesSaoPaulo(agora = new Date()): Date {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(agora);
  const ano = Number(partes.find((p) => p.type === "year")?.value);
  const mes = Number(partes.find((p) => p.type === "month")?.value);
  return new Date(Date.UTC(ano, mes - 1, 1, 3));
}

export async function usoDoMes(accountId: string): Promise<{
  tokensEntrada: number;
  tokensSaida: number;
  custoMicroUsd: number;
  execucoes: number;
}> {
  const r = await prisma.execucaoSkill.aggregate({
    where: { accountId, criadaEm: { gte: inicioDoMesSaoPaulo() } },
    _sum: { tokensEntrada: true, tokensSaida: true, custoMicroUsd: true },
    _count: { _all: true },
  });
  return {
    tokensEntrada: r._sum.tokensEntrada ?? 0,
    tokensSaida: r._sum.tokensSaida ?? 0,
    custoMicroUsd: r._sum.custoMicroUsd ?? 0,
    execucoes: r._count._all,
  };
}
