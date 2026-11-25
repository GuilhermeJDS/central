/**
 * Conselho — chefe do departamento ESTRATEGIA.
 *
 * Dois repositórios (pastas em skills/):
 *  - estrategia: avaliar a ideia, concorrentes, teste com clientes, oferta,
 *    preço, lançamento, marca e marketing.
 *  - operacao: números e caixa, operação do dia e plano do negócio (o
 *    Gerente Rotina lê os números; quem escreve o plano é o Conselho).
 *
 * Concorrentes roda com o que a ficha e o Inspetor Rastro sabem (sem busca
 * na web); o teste com clientes simula 20 compradores.
 */
import "server-only";

import { calcularNumeros, textoDosNumeros } from "@/lib/chefes/gerente-rotina";
import type { ConfigChefe } from "@/lib/chefes/motor";
import { executorDeSkills } from "@/lib/skills/executar";

/** Skills que usam os números do mês (receita, atendimentos, clientes). */
const COM_NUMEROS = new Set(["operacao/numeros-e-caixa", "operacao/plano-do-negocio", "operacao/operacao-do-dia", "estrategia/preco"]);

export const CONSELHO: ConfigChefe = {
  nome: "Conselho",
  departamento: "ESTRATEGIA",
  repositorios: {
    estrategia: {
      pastaSkills: "estrategia",
      skills: ["avaliar-ideia", "concorrentes", "teste-com-clientes", "oferta", "preco", "lancamento", "marca", "marketing"],
      executar: executorDeSkills(),
    },
    operacao: {
      pastaSkills: "operacao",
      skills: ["numeros-e-caixa", "operacao-do-dia", "plano-do-negocio"],
      executar: executorDeSkills(),
    },
  },
  regras: [
    "Concorrentes: use o que a ficha e os outros departamentos sabem; não peça links.",
    "Para \"testar/desmontar uma ideia sem dó\" ou o voto de um conselho, use estrategia/avaliar-ideia.",
    "Pré-venda e datas do lançamento: estrategia/lancamento. Oferta em uma página: estrategia/oferta.",
  ],
  dados: async (accountId, repositorio, skill) => {
    if (!COM_NUMEROS.has(`${repositorio}/${skill}`)) return null;
    const { numeros, semUnidade } = await calcularNumeros(accountId);
    if (semUnidade || !numeros.clientesAtendidosHistorico) return null;
    return textoDosNumeros(numeros);
  },
};
