/**
 * Painel de execuções da Central (para quem desenvolve): cada execução de
 * execucoes_skill com chefe, skill, modelo, tokens, custo, tempo e resultado,
 * com filtros e o total do mês. Filtra sempre pelo accountId da sessão.
 *
 * Custo: execuções na chave do cliente gravam custo 0 para a Korely; aqui o
 * custo é ESTIMADO pela tabela de preço do provedor (o que o cliente paga na
 * conta dele). Modelo sem preço na tabela aparece como "—".
 */
import { nomeDaAcao, semIdDeSkill, skillsDoNome } from "@/lib/central/nome-acao";
import "server-only";

import type { Prisma, StatusExecucao, TipoExecucao } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/** US$ por milhão de tokens (entrada / saída). Fonte: tabela pública da Anthropic, nov/2026. */
export const PRECO_TABELA: Record<string, { entrada: number; saida: number }> = {
  "claude-opus-5-5": { entrada: 4, saida: 20 },
  "claude-sonnet-5-5": { entrada: 2, saida: 10 },
  "claude-haiku-5-5": { entrada: 0.1, saida: 0.5 },
};

export function custoEstimadoUsd(modelo: string | null, entrada: number, saida: number): number | null {
  const p = modelo ? PRECO_TABELA[modelo] : undefined;
  if (!p) return null;
  return (entrada * p.entrada + saida * p.saida) / 1_000_000;
}

export type FiltrosExecucoes = {
  /** "AAAA-MM" (fuso de São Paulo). */
  mes: string;
  chefe?: string;
  /** Nome da ação (nome-acao.ts); vale para todas as skills com esse nome. */
  acao?: string;
  modelo?: string;
  tipo?: TipoExecucao;
  status?: StatusExecucao;
};

export type LinhaExecucao = {
  id: string;
  em: string;
  chefe: string;
  tipo: TipoExecucao;
  /** Nome da ação em português; null quando não rodou skill. */
  acao: string | null;
  modelo: string | null;
  provedor: string | null;
  tokensEntrada: number;
  tokensSaida: number;
  custoUsd: number | null;
  /** ms entre começar e terminar; null se não terminou. */
  tempoMs: number | null;
  status: StatusExecucao;
  decisao: string | null;
  titulo: string | null;
  erro: string | null;
  saida: string | null;
  paiId: string | null;
};

export type TotaisMes = {
  execucoes: number;
  erros: number;
  tokensEntrada: number;
  tokensSaida: number;
  custoUsd: number;
  /** Execuções com modelo fora da tabela (custo não somado). */
  semPreco: number;
  tempoMedioMs: number | null;
  /** Mesmo total no mês anterior, para comparar. */
  anterior: { execucoes: number; custoUsd: number };
};

const MES = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function mesAtual(agora = new Date()): string {
  const sp = new Date(agora.getTime() - 3 * 3_600_000);
  return `${sp.getUTCFullYear()}-${String(sp.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function lerMes(m: string | undefined): string {
  return m && MES.test(m) ? m : mesAtual();
}

export function mesVizinho(mes: string, delta: number): string {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Começo e fim do mês em São Paulo (UTC-3). */
function faixaDoMes(mes: string): { gte: Date; lt: Date } {
  const [a, m] = mes.split("-").map(Number);
  return { gte: new Date(Date.UTC(a, m - 1, 1, 3)), lt: new Date(Date.UTC(a, m, 1, 3)) };
}

function where(accountId: string, f: FiltrosExecucoes): Prisma.ExecucaoSkillWhereInput {
  return {
    accountId,
    criadaEm: faixaDoMes(f.mes),
    ...(f.chefe ? { chefe: f.chefe } : {}),
    ...(f.acao ? { skill: { in: skillsDoNome(f.acao) } } : {}),
    ...(f.modelo ? { modelo: f.modelo } : {}),
    ...(f.tipo ? { tipo: f.tipo } : {}),
    ...(f.status ? { status: f.status } : {}),
  };
}

async function somar(w: Prisma.ExecucaoSkillWhereInput) {
  const grupos = await prisma.execucaoSkill.groupBy({
    by: ["modelo"],
    where: w,
    _count: { _all: true },
    _sum: { tokensEntrada: true, tokensSaida: true },
  });
  let execucoes = 0;
  let custoUsd = 0;
  let semPreco = 0;
  let tokensEntrada = 0;
  let tokensSaida = 0;
  for (const g of grupos) {
    const n = g._count._all;
    const te = g._sum.tokensEntrada ?? 0;
    const ts = g._sum.tokensSaida ?? 0;
    execucoes += n;
    tokensEntrada += te;
    tokensSaida += ts;
    const c = custoEstimadoUsd(g.modelo, te, ts);
    if (c === null) {
      if (te + ts > 0) semPreco += n;
    } else custoUsd += c;
  }
  return { execucoes, custoUsd, semPreco, tokensEntrada, tokensSaida };
}

export async function totaisDoMes(accountId: string, f: FiltrosExecucoes): Promise<TotaisMes> {
  const w = where(accountId, f);
  const [atual, anterior, erros, tempos] = await Promise.all([
    somar(w),
    somar(where(accountId, { ...f, mes: mesVizinho(f.mes, -1) })),
    prisma.execucaoSkill.count({ where: { ...w, status: { in: ["ERRO", "RECUSADA"] } } }),
    prisma.execucaoSkill.findMany({
      where: { ...w, iniciadaEm: { not: null }, concluidaEm: { not: null } },
      select: { iniciadaEm: true, concluidaEm: true },
      take: 2000,
    }),
  ]);
  const ms = tempos.map((t) => (t.concluidaEm as Date).getTime() - (t.iniciadaEm as Date).getTime()).filter((x) => x >= 0);
  return {
    ...atual,
    erros,
    tempoMedioMs: ms.length ? Math.round(ms.reduce((a, b) => a + b, 0) / ms.length) : null,
    anterior: { execucoes: anterior.execucoes, custoUsd: anterior.custoUsd },
  };
}

export async function listarExecucoes(accountId: string, f: FiltrosExecucoes, limite = 200): Promise<LinhaExecucao[]> {
  const linhas = await prisma.execucaoSkill.findMany({
    where: where(accountId, f),
    orderBy: { criadaEm: "desc" },
    take: limite,
    select: {
      id: true,
      criadaEm: true,
      chefe: true,
      tipo: true,
      skill: true,
      repositorio: true,
      modelo: true,
      provedor: true,
      tokensEntrada: true,
      tokensSaida: true,
      iniciadaEm: true,
      concluidaEm: true,
      status: true,
      decisao: true,
      titulo: true,
      erro: true,
      saida: true,
      execucaoPaiId: true,
    },
  });
  return linhas.map((l) => ({
    id: l.id,
    em: l.criadaEm.toISOString(),
    chefe: l.chefe,
    tipo: l.tipo,
    acao: l.skill ? nomeDaAcao(l.repositorio, l.skill) : null,
    modelo: l.modelo,
    provedor: l.provedor,
    tokensEntrada: l.tokensEntrada,
    tokensSaida: l.tokensSaida,
    custoUsd: custoEstimadoUsd(l.modelo, l.tokensEntrada, l.tokensSaida),
    tempoMs: l.iniciadaEm && l.concluidaEm ? l.concluidaEm.getTime() - l.iniciadaEm.getTime() : null,
    status: l.status,
    decisao: l.decisao,
    titulo: l.titulo ? semIdDeSkill(l.titulo) : null,
    erro: l.erro ? semIdDeSkill(l.erro) : null,
    saida: l.saida ? l.saida.slice(0, 1500) : null,
    paiId: l.execucaoPaiId,
  }));
}

/** Valores que existem no mês, para montar os filtros. */
export async function opcoesDeFiltro(accountId: string, mes: string) {
  const w: Prisma.ExecucaoSkillWhereInput = { accountId, criadaEm: faixaDoMes(mes) };
  const [chefes, skills, modelos] = await Promise.all([
    prisma.execucaoSkill.groupBy({ by: ["chefe"], where: w, orderBy: { chefe: "asc" } }),
    prisma.execucaoSkill.groupBy({ by: ["repositorio", "skill"], where: { ...w, skill: { not: null } } }),
    prisma.execucaoSkill.groupBy({ by: ["modelo"], where: { ...w, modelo: { not: null } }, orderBy: { modelo: "asc" } }),
  ]);
  return {
    chefes: chefes.map((c) => c.chefe),
    acoes: [...new Set(skills.map((s) => nomeDaAcao(s.repositorio, s.skill)))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    modelos: modelos.map((m) => m.modelo as string).filter((m) => m !== "direto"),
  };
}

export type DiaExecucoes = {
  /** Dia do mês (1…31). */
  dia: number;
  execucoes: number;
  custoUsd: number;
  tokens: number;
  erros: number;
  /** Tempo médio do dia (ms); null sem execução terminada. */
  tempoMedioMs: number | null;
};

/** Um ponto por dia do mês (fuso de São Paulo), com os mesmos filtros da lista. */
export async function serieDoMes(accountId: string, f: FiltrosExecucoes): Promise<DiaExecucoes[]> {
  const [a, m] = f.mes.split("-").map(Number);
  const nDias = new Date(Date.UTC(a, m, 0)).getUTCDate();
  const dias: (DiaExecucoes & { somaMs: number; nMs: number })[] = Array.from({ length: nDias }, (_, i) => ({
    dia: i + 1,
    execucoes: 0,
    custoUsd: 0,
    tokens: 0,
    erros: 0,
    tempoMedioMs: null,
    somaMs: 0,
    nMs: 0,
  }));
  const linhas = await prisma.execucaoSkill.findMany({
    where: where(accountId, f),
    select: { criadaEm: true, modelo: true, tokensEntrada: true, tokensSaida: true, status: true, iniciadaEm: true, concluidaEm: true },
    take: 20_000,
  });
  for (const l of linhas) {
    const d = dias[new Date(l.criadaEm.getTime() - 3 * 3_600_000).getUTCDate() - 1];
    if (!d) continue;
    d.execucoes++;
    d.tokens += l.tokensEntrada + l.tokensSaida;
    d.custoUsd += custoEstimadoUsd(l.modelo, l.tokensEntrada, l.tokensSaida) ?? 0;
    if (l.status === "ERRO" || l.status === "RECUSADA") d.erros++;
    if (l.iniciadaEm && l.concluidaEm) {
      const ms = l.concluidaEm.getTime() - l.iniciadaEm.getTime();
      if (ms >= 0) {
        d.somaMs += ms;
        d.nMs++;
      }
    }
  }
  return dias.map(({ somaMs, nMs, ...d }) => ({ ...d, tempoMedioMs: nMs ? Math.round(somaMs / nMs) : null }));
}
