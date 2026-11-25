/**
 * Tempo limite dos trabalhos de produção. Um trabalho que passou do prazo
 * (o servidor caiu no meio, o `after` não rodou, o provedor nunca respondeu)
 * vira ERRO com o motivo, e o card mostra "Tentar de novo".
 *
 * Fica fora de producao.ts para a leitura das peças (pecas.ts, entregas.ts)
 * poder destravar sem import circular.
 */
import "server-only";

import { ROTULO_ETAPA_PRODUCAO, type EtapaProducao } from "@/lib/central/entregas-tipos";
import { prisma } from "@/lib/prisma";

/** Tempo da chamada ao modelo na produção. */
export const TIMEOUT_PRODUCAO_MS = 3 * 60 * 1000;
/** Tempo limite do trabalho depois que começa (chamada + salvar). Passou: vira ERRO. */
export const PRAZO_TRABALHO_MS = TIMEOUT_PRODUCAO_MS + 90 * 1000;
/** Espera máxima na fila (lib/central/fila) antes de começar. */
export const PRAZO_FILA_MS = 15 * 60 * 1000;

export async function destravarPresos(accountId: string): Promise<number> {
  const agora = new Date();
  const presos = await prisma.entregaChefe.findMany({
    where: {
      accountId,
      status: { in: ["NA_FILA", "PRODUZINDO"] },
      OR: [
        { producaoPrazo: { lt: agora } },
        { producaoPrazo: null, atualizadaEm: { lt: new Date(agora.getTime() - PRAZO_TRABALHO_MS) } },
      ],
    },
    select: { id: true, execucaoId: true, producaoEtapa: true },
  });
  if (!presos.length) return 0;
  const minutos = Math.round(PRAZO_TRABALHO_MS / 60_000);
  for (const p of presos) {
    const rotulo = ROTULO_ETAPA_PRODUCAO[p.producaoEtapa as EtapaProducao];
    const onde = rotulo ? ` (parou em: ${rotulo.toLowerCase()})` : " (nem chegou a começar)";
    await prisma.entregaChefe.updateMany({
      where: { id: p.id, accountId, status: { in: ["NA_FILA", "PRODUZINDO"] } },
      data: {
        status: "ERRO",
        producaoEtapa: null,
        producaoPrazo: null,
        erro: `Passou do tempo limite de ${minutos} min sem terminar${onde}. Tente de novo.`,
      },
    });
    if (p.execucaoId)
      await prisma.execucaoSkill.updateMany({
        where: { id: p.execucaoId, accountId, status: { in: ["NA_FILA", "RODANDO"] } },
        data: { status: "ERRO", erro: "Tempo limite da produção.", concluidaEm: agora },
      });
  }
  return presos.length;
}
