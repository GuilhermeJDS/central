/**
 * Negociador Trato — chefe do departamento VENDAS.
 *
 * Três repositórios (pastas em skills/):
 *  - prospeccao: a skill-prospeccao (8 manuais: prospecção fria, pesquisa do
 *    cliente, conversa no WhatsApp, objeções, follow-up e reconquista, lista
 *    negra, psicologia por perfil e operação 24/7).
 *  - vendas: proposta, contrato, funil e agenda.
 *  - chicote: a página de vendas da própria empresa.
 * O cardápio com o nome de cada ação fica em cardapio.ts.
 *
 * Tudo roda com o que a Central tem: a ficha, os números do mês (Gerente
 * Rotina) e o que o dono escrever no pedido. Nenhum script roda.
 */
import "server-only";

import { calcularNumeros, textoDosNumeros } from "@/lib/chefes/gerente-rotina";
import type { ConfigChefe } from "@/lib/chefes/motor";
import { executorDeSkills } from "@/lib/skills/executar";

/** Skills que usam os números do mês (clientes, receita). */
const COM_NUMEROS = new Set([
  "prospeccao/05-follow-up-e-reconquista",
  "prospeccao/04-quebra-de-objecoes",
  "prospeccao/07-psicologia-por-perfil",
  "vendas/funil",
  "vendas/agenda",
  "vendas/proposta",
]);

export const NEGOCIADOR_TRATO: ConfigChefe = {
  nome: "Negociador Trato",
  departamento: "VENDAS",
  repositorios: {
    prospeccao: {
      pastaSkills: "prospeccao",
      skills: [
        "01-prospeccao-fria",
        "02-pesquisa-de-lead",
        "03-negociacao-whatsapp",
        "04-quebra-de-objecoes",
        "05-follow-up-e-reconquista",
        "06-lista-negra-e-governanca",
        "07-psicologia-por-perfil",
        "08-arquitetura-operacao-24-7",
      ],
      executar: executorDeSkills(),
    },
    vendas: {
      pastaSkills: "vendas",
      skills: ["proposta", "contrato", "funil", "agenda"],
      executar: executorDeSkills(),
    },
    chicote: {
      pastaSkills: "chicote",
      skills: ["chicote"],
      executar: executorDeSkills(),
    },
  },
  regras: [
    "Mensagem para cliente sumido, cliente que parou de comprar ou que não volta é SUA (05-follow-up-e-reconquista): nunca mande para outro departamento.",
    "Follow-up, proposta, contrato, objeção (\"tá caro\"), funil, agenda de cliente, prospecção e conversa no WhatsApp também são seus.",
    "Página de vendas, landing page ou site que vende a oferta da própria empresa: chicote/chicote.",
  ],
  dados: async (accountId, repositorio, skill) => {
    if (!COM_NUMEROS.has(`${repositorio}/${skill}`)) return null;
    const { numeros, semUnidade } = await calcularNumeros(accountId);
    if (semUnidade || !numeros.clientesAtendidosHistorico) return null;
    return textoDosNumeros(numeros);
  },
};
