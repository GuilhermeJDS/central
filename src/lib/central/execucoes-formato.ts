/**
 * Rótulos e formatos das Execuções (módulo puro: servidor e tela).
 */
import type { StatusExecucao, TipoExecucao } from "@/generated/prisma/client";

export const ROTULO_TIPO: Record<TipoExecucao, string> = { CHEFE: "Chefe", SKILL: "Trabalho", REVISOR: "Revisor", PRODUCAO: "Produção" };
export const ROTULO_STATUS: Record<StatusExecucao, string> = {
  CONCLUIDA: "Concluída",
  ERRO: "Erro",
  RODANDO: "Rodando",
  NA_FILA: "Na fila",
  RECUSADA: "Recusada",
};

const fmtInt = new Intl.NumberFormat("pt-BR");

export function usd(v: number | null): string {
  if (v === null) return "—";
  if (v === 0) return "US$ 0";
  const casas = v < 0.01 ? 4 : 2;
  return `US$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}`;
}
export function tokens(n: number): string {
  return n >= 10_000 ? `${(n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : fmtInt.format(n);
}
export function tempo(ms: number | null): string {
  if (ms === null) return "—";
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} s`;
}

