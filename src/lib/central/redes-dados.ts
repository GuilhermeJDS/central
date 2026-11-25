/**
 * Dados de uma área das Redes: o que está sendo gerado e o que espera o sim
 * do dono naquela rede. Filtra pelo accountId da sessão.
 */
import "server-only";

import { cortar, primeiraFrase } from "@/lib/central/dados";
import { REDE_DO_REPOSITORIO } from "@/lib/chefes/dados-redes";
import type { AreaRede } from "@/lib/central/redes-areas";
import { prisma } from "@/lib/prisma";

export type TrabalhoRede = {
  id: string;
  titulo: string;
  resumo: string;
  estado: "gerando" | "pendente";
  skill: string | null;
  em: string;
};

const LIMITE_GERANDO_MS = 15 * 60 * 1000;

function redeDa(entradaPai: unknown, repositorio: string | null): string | null {
  const r = entradaPai && typeof entradaPai === "object" ? (entradaPai as { rede?: unknown }).rede : null;
  if (typeof r === "string") return r;
  return repositorio ? (REDE_DO_REPOSITORIO[repositorio] ?? null) : null;
}

export async function trabalhosDaRede(accountId: string, area: AreaRede): Promise<TrabalhoRede[]> {
  const execs = await prisma.execucaoSkill.findMany({
    where: {
      accountId,
      departamento: "REDES",
      tipo: "SKILL",
      repositorio: area.repositorio,
      OR: [
        { status: "CONCLUIDA", decisao: "PENDENTE" },
        { status: { in: ["NA_FILA", "RODANDO"] }, criadaEm: { gte: new Date(Date.now() - LIMITE_GERANDO_MS) } },
      ],
    },
    orderBy: { criadaEm: "desc" },
    take: 40,
    select: {
      id: true,
      status: true,
      titulo: true,
      saida: true,
      skill: true,
      repositorio: true,
      criadaEm: true,
      execucaoPai: { select: { entrada: true } },
      filhas: { where: { tipo: "REVISOR", status: "CONCLUIDA" }, select: { saida: true }, take: 1 },
    },
  });
  return execs
    .filter((e) => redeDa(e.execucaoPai?.entrada, e.repositorio) === area.rede)
    .map((e) => {
      const texto = e.filhas[0]?.saida || e.saida || "";
      return {
        id: e.id,
        titulo: e.titulo || (e.status === "CONCLUIDA" ? primeiraFrase(texto, 90) : "") || "Gerando…",
        resumo: e.status === "CONCLUIDA" ? cortar(texto.replace(/[#*_`>]+/g, " "), 180) : "",
        estado: e.status === "CONCLUIDA" ? ("pendente" as const) : ("gerando" as const),
        skill: e.skill,
        em: e.criadaEm.toISOString(),
      };
    });
}
