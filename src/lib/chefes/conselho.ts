/**
 * Conselho — chefe do departamento ESTRATEGIA.
 *
 * Roda as 11 skills do Founder (conselho, concorrentes, painel de clientes,
 * preço, oferta, números, marketing, marca, operação, lançamento e plano), a
 * parte de oferta do Whale (pesquisa de dor cara, página da oferta, preço
 * pelo que já gastam, pré-venda, datas do lançamento, demonstração, pedidos
 * dos clientes e caso de sucesso) e o larp (teste da ideia sem dó).
 *
 * founder-competitors roda com o que a ficha e o Inspetor Rastro sabem (sem
 * busca na web); founder-consumer roda sempre no modo rápido (20 compradores).
 */
import "server-only";

import { calcularNumeros, textoDosNumeros } from "@/lib/chefes/gerente-rotina";
import type { ConfigChefe } from "@/lib/chefes/motor";
import { executarSkillFounder } from "@/lib/skills/founder/executar";
import { executarSkillIllegalCodes } from "@/lib/skills/illegal-codes/executar";
import { executarSkillWhale } from "@/lib/skills/whale/executar";

/** Skills que usam os números da casa (receita, atendimentos, clientes). */
const COM_NUMEROS = new Set([
  "founder/founder-cfo",
  "founder/founder-pricing",
  "founder/founder-plan",
  "founder/founder-ops",
  "whale/pricing",
]);

export const CONSELHO: ConfigChefe = {
  nome: "Conselho",
  departamento: "ESTRATEGIA",
  repositorios: {
    founder: {
      pastaSkills: "founder-skill/skills",
      skills: [
        "founder-board",
        "founder-brand",
        "founder-cfo",
        "founder-competitors",
        "founder-consumer",
        "founder-launch",
        "founder-marketing",
        "founder-offer",
        "founder-ops",
        "founder-plan",
        "founder-pricing",
      ],
      executar: executarSkillFounder,
    },
    whale: {
      pastaSkills: "whale-skill",
      skills: [
        "market-researcher",
        "offer-builder",
        "pricing",
        "pre-sale",
        "launch-planner",
        "demo-builder",
        "requirements",
        "case-study",
      ],
      executar: executarSkillWhale,
    },
    illegal: {
      pastaSkills: "claude-illegal-codes",
      skills: ["larp"],
      executar: executarSkillIllegalCodes,
    },
  },
  regras: [
    "founder-consumer roda sempre no modo rápido: escreva --quick (20 compradores) na entrada.",
    "founder-competitors: use o que a ficha e os outros departamentos sabem dos concorrentes; não peça links.",
    "Para \"testar/desmontar uma ideia sem dó\", use illegal/larp; para o voto de um conselho, founder/founder-board.",
    "Oferta em uma página, preço a partir do que o cliente já gasta e pré-venda ficam no repositório whale.",
  ],
  dados: async (accountId, repositorio, skill) => {
    if (!COM_NUMEROS.has(`${repositorio}/${skill}`)) return null;
    const { numeros, semUnidade } = await calcularNumeros(accountId);
    if (semUnidade || !numeros.clientesAtendidosHistorico) return null;
    return textoDosNumeros(numeros);
  },
};
