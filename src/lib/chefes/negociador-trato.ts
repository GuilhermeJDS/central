/**
 * Negociador Trato — chefe do departamento VENDAS.
 *
 * Roda as 11 skills do Closer (prospecção, pesquisa, funil, follow-up,
 * cliente sumido, proposta, contrato, previsão, agenda, registro e treino) e
 * a parte de venda do Whale (objeções, cliente grande e o acompanhamento da
 * proposta grande). O cardápio com o nome de cada ação fica em cardapio.ts.
 *
 * As skills que no repositório original leem o CRM, o Gmail, a agenda ou a
 * web rodam aqui com o que a Central tem: a ficha, os números do negócio
 * (atendimentos, clientes sumidos, receita, calculados em código pelo
 * Gerente Rotina) e o que o dono escrever no pedido. Nenhum script roda.
 */
import "server-only";

import { calcularNumeros, textoDosNumeros } from "@/lib/chefes/gerente-rotina";
import type { ConfigChefe } from "@/lib/chefes/motor";
import { executarSkillCloser, SKILLS_CLOSER } from "@/lib/skills/closer/executar";
import { executarSkillWhale } from "@/lib/skills/whale/executar";

/** Skills que usam os números da casa (agenda, clientes, receita). */
const COM_NUMEROS = new Set([
  "closer/win-back",
  "closer/follow-up",
  "closer/pipeline",
  "closer/forecaster",
  "closer/scheduler",
  "closer/record-keeper",
  "closer/sales-coach",
  "whale/objection-handler",
]);

export const NEGOCIADOR_TRATO: ConfigChefe = {
  nome: "Negociador Trato",
  departamento: "VENDAS",
  repositorios: {
    closer: {
      pastaSkills: "closer-skill",
      skills: SKILLS_CLOSER,
      executar: executarSkillCloser,
    },
    whale: {
      pastaSkills: "whale-skill",
      skills: ["objection-handler", "whale-hunter", "follow-up"],
      executar: executarSkillWhale,
    },
  },
  regras: [
    "Mensagem para cliente sumido, cliente que parou de vir ou que não volta é SUA (skill win-back): nunca mande para outro departamento.",
    "Follow-up, proposta, contrato, objeção (\"tá caro\"), funil, previsão de vendas, agenda de cliente e prospecção também são seus.",
    "Para pedidos sobre uma empresa ou contrato grande, prefira o repositório whale (whale-hunter, objection-handler, follow-up).",
  ],
  dados: async (accountId, repositorio, skill) => {
    if (!COM_NUMEROS.has(`${repositorio}/${skill}`)) return null;
    const { numeros, semUnidade } = await calcularNumeros(accountId);
    if (semUnidade || !numeros.clientesAtendidosHistorico) return null;
    return textoDosNumeros(numeros);
  },
};
