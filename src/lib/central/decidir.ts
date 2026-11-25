import "server-only";

/**
 * Decidir uma entrega pendente (aprovar, passar ou pedir ajuste). Quem chama
 * já resolveu a conta (sessão da Central ou chave da API) e as travas de
 * liberação; aqui os ids só acham registros DENTRO da conta.
 */
import { z } from "zod";

import { departamentoPorEnum } from "@/lib/central/departamentos";
import { chefeAtendePedido, dispararChefe } from "@/lib/central/disparar";
import { ROTULO_TIPO, type TipoEntrega } from "@/lib/central/entregas-tipos";
import { hrefDaPeca } from "@/lib/central/estudio/secoes";
import { TIPOS_CARROSSEL, TIPOS_VIDEO } from "@/lib/central/estudio/tipos";
import type { Departamento } from "@/generated/prisma/client";
import { agendarProducao } from "@/lib/central/producao";
import { prisma } from "@/lib/prisma";

export const decisaoSchema = z.enum(["APROVADA", "PASSADA", "AJUSTAR"]);
export type Escolha = z.infer<typeof decisaoSchema>;

export type ResultadoDecisao = {
  erro: string | null;
  /** Aprovou: a peça que o chefe está produzindo e onde ela vai cair. */
  producao?: { tipo: string; departamento: string; slug: string | null };
  /** Onde a peça aprovada foi parar (aviso "Foi para Carrosséis · Abrir"). */
  destino?: { rotulo: string; href: string };
  /** false: já tinha sido decidida (outra aba) ou não é desta conta. */
  decidida?: boolean;
};

function destinoDa(e: { id: string; tipo: TipoEntrega; departamento: Departamento }): { rotulo: string; href: string } {
  if (e.departamento === "REDES") {
    const rotulo = TIPOS_CARROSSEL.includes(e.tipo)
      ? "Carrosséis"
      : TIPOS_VIDEO.includes(e.tipo)
        ? "Reels e Vídeos"
        : "Pautas";
    return { rotulo, href: hrefDaPeca(e, null) };
  }
  const dep = departamentoPorEnum(e.departamento);
  return { rotulo: `${dep?.nome ?? "Central"} › Entregas`, href: `/central/entregas/${e.id}` };
}

export async function decidirExecucao(
  accountId: string,
  execucaoId: string,
  escolha: Escolha,
  textoAjuste: string,
): Promise<ResultadoDecisao> {
  const exec = await prisma.execucaoSkill.findFirst({
    where: { id: String(execucaoId).slice(0, 64), accountId, tipo: "SKILL", status: "CONCLUIDA", decisao: "PENDENTE" },
    select: {
      id: true,
      chefe: true,
      saida: true,
      filhas: { where: { tipo: "REVISOR", status: "CONCLUIDA" }, select: { saida: true }, take: 1 },
    },
  });
  if (!exec) return { erro: null, decidida: false };

  const { count } = await prisma.execucaoSkill.updateMany({
    where: { id: exec.id, accountId, decisao: "PENDENTE" },
    data: { decisao: escolha, decididaEm: new Date(), ajuste: escolha === "AJUSTAR" ? textoAjuste : null },
  });

  if (count > 0 && escolha === "APROVADA") {
    // Aprovou: o chefe produz a peça final, que cai em Entregas do departamento.
    try {
      const e = await agendarProducao(accountId, exec.id);
      if (e) {
        const dep = departamentoPorEnum(e.departamento);
        return {
          erro: null,
          decidida: true,
          producao: { tipo: ROTULO_TIPO[e.tipo], departamento: dep?.nome ?? "", slug: dep?.slug ?? null },
          destino: destinoDa(e),
        };
      }
    } catch (e) {
      console.error("[central] agendar produção", e);
    }
    return { erro: null, decidida: true };
  }

  if (count > 0 && escolha === "AJUSTAR" && chefeAtendePedido(exec.chefe)) {
    const anterior = exec.filhas[0]?.saida || exec.saida || "";
    const pedido = [
      `Ajuste o trabalho anterior. O que mudar: ${textoAjuste}`,
      "",
      "Trabalho anterior:",
      anterior.slice(0, 6000),
    ].join("\n");
    await dispararChefe(accountId, exec.chefe, pedido, exec.id);
  }
  return { erro: null, decidida: count > 0 };
}
