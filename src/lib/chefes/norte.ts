/**
 * Norte — DIRETORIA. Não roda skill: olha o negócio inteiro e aponta o caminho.
 *
 * - acaoDaSemana: ficha + últimas 3 execuções concluídas de cada departamento +
 *   o resultado mais recente do Gerente Rotina e do Inspetor Rastro → UMA
 *   ação da semana (JSON).
 * - rotear: diz qual chefe atende um pedido. Não encadeia: o dono confirma
 *   antes de mandar o pedido para o outro chefe.
 * - Promptmaster (motor.ts, afinarPedido): pedido livre curto e solto passa
 *   pelo Norte antes do chefe escolher; a corrente mostra "Norte · Pedido
 *   afinado". Fora: /67 (seis agentes + juiz: caro demais para a ação da
 *   semana) e /china-maxing (truque de token, sem uso aqui).
 *
 * SEGURANÇA: o `accountId` sempre vem do servidor (sessão autenticada).
 */
import "server-only";

import { z } from "zod";

import type { Departamento } from "@/generated/prisma/client";
import {
  chamarModelo,
  usoDe,
  extrairJson,
  mensagemDeErro,
} from "@/lib/chefes/chamar-modelo";
import { GERENTE_ROTINA } from "@/lib/chefes/gerente-rotina";
import { INSPETOR_RASTRO } from "@/lib/chefes/inspetor-rastro";
import { resumirFicha } from "@/lib/chefes/motor";
import { obterFicha } from "@/lib/negocio/ficha";
import { insumosDoNorte } from "@/lib/central/ligacoes";
import { prisma } from "@/lib/prisma";
import {
  concluirExecucao,
  criarExecucao,
  falharExecucao,
  marcarRodando,
  ultimasExecucoes,
} from "@/lib/skills/execucoes";

const NOME = "Norte";
const DEPARTAMENTO: Departamento = "DIRETORIA";
const TIMEOUT_NORTE_MS = 60 * 1000;

/**
 * Chefes que atendem pedidos, com o departamento de cada um. Os nomes têm que
 * bater com `nome` em editora-pauta.ts, negociador-trato.ts, conselho.ts,
 * gerente-rotina.ts e inspetor-rastro.ts.
 */
export const CHEFES_ATENDEM = {
  "Editora Pauta": { departamento: "REDES", faz: "redes sociais: Instagram, YouTube, LinkedIn, X (posts, roteiros, perfil, plano de conteúdo, respostas)" },
  "Negociador Trato": { departamento: "VENDAS", faz: "vendas e clientes: mensagem para cliente sumido ou que parou de vir, follow-up, resposta para objeção (tá caro), proposta, contrato, funil, previsão do mês, prospecção, cliente grande/empresa" },
  Conselho: { departamento: "ESTRATEGIA", faz: "estratégia: testar ideia, concorrentes, painel de clientes, oferta (e página da oferta), preço, pré-venda, marca, números (margem, ponto de equilíbrio), marketing, lançamento, operação, plano de negócio" },
  [GERENTE_ROTINA.nome]: { departamento: GERENTE_ROTINA.departamento, faz: "números da rotina (só leitura, não escreve mensagem): agenda, atendimentos, faltas, cancelamentos, quantos clientes sumiram, receita do mês" },
  [INSPETOR_RASTRO.nome]: { departamento: INSPETOR_RASTRO.departamento, faz: "presença no Google: ficha no Maps, nota, avaliações, link de avaliação e comparação com concorrentes vizinhos" },
} as const satisfies Record<string, { departamento: Departamento; faz: string }>;

export type NomeChefe = keyof typeof CHEFES_ATENDEM;
const NOMES_CHEFES = Object.keys(CHEFES_ATENDEM) as [NomeChefe, ...NomeChefe[]];
const DEPARTAMENTOS_CHEFES = [...new Set(Object.values(CHEFES_ATENDEM).map((c) => c.departamento))];

function listaChefes(): string {
  return NOMES_CHEFES.map((n) => `- ${n} (${CHEFES_ATENDEM[n].departamento}): ${CHEFES_ATENDEM[n].faz}`).join("\n");
}

// ---------------------------------------------------------------------------
// acaoDaSemana
// ---------------------------------------------------------------------------

const acaoSchema = z.object({
  departamento: z.string().trim(),
  chefe: z.enum(NOMES_CHEFES),
  titulo: z.string().trim().min(1).max(160),
  porQue: z.string().trim().min(1).max(800),
  pedidoParaChefe: z.string().trim().min(1).max(2000),
});

export type AcaoDaSemana = {
  departamento: Departamento;
  chefe: NomeChefe;
  titulo: string;
  porQue: string;
  pedidoParaChefe: string;
};

export type ResultadoAcaoDaSemana =
  | { status: "concluida"; execucaoId: string; acao: AcaoDaSemana }
  | { status: "sem_ficha" }
  | { status: "erro"; mensagem: string };

const PROMPT_ACAO = [
  "Você é o Norte, diretor de um pequeno negócio brasileiro. Não executa tarefas: escolhe a UMA ação que mais move o negócio nesta semana.",
  "",
  "Regras:",
  "- Olhe a ficha (objetivo do dono), o que cada departamento já fez, os números da rotina e a comparação no Google com os concorrentes (se houver).",
  "- Escolha uma ação só, concreta e que dê para fazer nesta semana. Não repita o que já foi feito.",
  "- O chefe tem que ser um destes, com o departamento dele:",
  listaChefes(),
  "- pedidoParaChefe: o pedido pronto, escrito como o dono pediria ao chefe, claro e completo.",
  "- porQue: por que esta ação agora, ligada ao objetivo do dono e ao que os dados mostram. Não invente número.",
  "- Português do Brasil, linguagem simples, sem travessão \"—\".",
  "",
  "Responda SÓ com JSON, sem texto antes ou depois, sem cercas de código:",
  '{"departamento":"","chefe":"","titulo":"","porQue":"","pedidoParaChefe":""}',
].join("\n");

function resumirExecucao(e: {
  criadaEm: Date;
  chefe: string;
  repositorio: string | null;
  skill: string | null;
  saida: string | null;
}): string {
  const data = e.criadaEm.toISOString().slice(0, 10);
  const quem = e.skill ? `${e.repositorio}/${e.skill}` : `chefe ${e.chefe}`;
  const trecho = (e.saida ?? "").replace(/\s+/g, " ").slice(0, 300);
  return `- ${data} ${quem}: ${trecho}`;
}

async function contextoDepartamentos(accountId: string): Promise<string> {
  const blocos = await Promise.all(
    DEPARTAMENTOS_CHEFES.map(async (dep) => {
      const ultimas = await ultimasExecucoes(accountId, dep, 3);
      return `${dep}:\n${ultimas.length ? ultimas.map(resumirExecucao).join("\n") : "(nada ainda)"}`;
    }),
  );
  return blocos.join("\n\n");
}

/** Resultado mais recente de um chefe que lê números (Gerente Rotina, Inspetor Rastro). */
async function ultimaLeitura(
  accountId: string,
  chefe: { nome: string; departamento: Departamento },
  acao?: string,
): Promise<string> {
  const e = await prisma.execucaoSkill.findFirst({
    where: {
      accountId,
      departamento: chefe.departamento,
      chefe: chefe.nome,
      status: "CONCLUIDA",
      ...(acao ? { acao: acao } : {}),
    },
    orderBy: { criadaEm: "desc" },
    select: { criadaEm: true, saida: true },
  });
  if (!e?.saida) return "(nenhuma leitura ainda)";
  return `Leitura de ${e.criadaEm.toISOString().slice(0, 10)}:\n${e.saida.slice(0, 3000)}`;
}

export async function acaoDaSemana(accountId: string, jaPlanejadas: string[] = []): Promise<ResultadoAcaoDaSemana> {
  const exec = await criarExecucao({
    accountId,
    departamento: DEPARTAMENTO,
    chefe: NOME,
    tipo: "CHEFE",
    entrada: { acao: "acaoDaSemana" },
  });

  const ficha = await obterFicha(accountId);
  if (!ficha) {
    await falharExecucao(accountId, exec.id, "Negócio sem ficha preenchida.");
    return { status: "sem_ficha" };
  }

  try {
    await marcarRodando(accountId, exec.id);
    const [departamentos, rotina, presenca, juntos] = await Promise.all([
      contextoDepartamentos(accountId),
      ultimaLeitura(accountId, GERENTE_ROTINA),
      ultimaLeitura(accountId, INSPETOR_RASTRO, "compararVizinhos"),
      insumosDoNorte(accountId),
    ]);
    // Departamentos conectados: guarda quem alimentou a ação (a tela mostra).
    if (juntos.fontes.length)
      await prisma.execucaoSkill.updateMany({
        where: { id: exec.id, accountId },
        data: { entrada: { acao: "acaoDaSemana", fontes: juntos.fontes } },
      });
    const mensagem = [
      "<ficha>",
      resumirFicha(ficha),
      "</ficha>",
      "",
      "<ultimas_execucoes_por_departamento>",
      departamentos,
      "</ultimas_execucoes_por_departamento>",
      "",
      "<rotina>",
      rotina,
      "</rotina>",
      "",
      "<presenca_google>",
      presenca,
      "</presenca_google>",
      ...(juntos.bloco
        ? ["", "<trabalho_aprovado_dos_departamentos>", juntos.bloco, "</trabalho_aprovado_dos_departamentos>"]
        : []),
      ...(jaPlanejadas.length
        ? [
            "",
            "<ja_planejadas_nesta_semana>",
            ...jaPlanejadas.map((t) => `- ${t}`),
            "</ja_planejadas_nesta_semana>",
            "Escolha uma ação diferente de todas as já planejadas nesta semana.",
          ]
        : []),
    ].join("\n");

    const r = await chamarModelo(accountId, PROMPT_ACAO, mensagem, { maxTokens: 1024, timeoutMs: TIMEOUT_NORTE_MS, chefe: "Norte" });
    const parsed = acaoSchema.safeParse(extrairJson(r.texto));
    if (!parsed.success) throw new Error(`JSON do Norte fora do formato: ${parsed.error.message}`);
    // O departamento sai do chefe escolhido (fonte da verdade é a lista).
    const acao: AcaoDaSemana = {
      ...parsed.data,
      departamento: CHEFES_ATENDEM[parsed.data.chefe].departamento,
    };

    await concluirExecucao(accountId, exec.id, {
      saida: JSON.stringify(acao),
      ...usoDe(r),
    });
    return { status: "concluida", execucaoId: exec.id, acao };
  } catch (e) {
    const mensagem = mensagemDeErro(e);
    await falharExecucao(accountId, exec.id, mensagem);
    return { status: "erro", mensagem };
  }
}

// ---------------------------------------------------------------------------
// rotear
// ---------------------------------------------------------------------------

const roteamentoSchema = z.object({ chefe: z.enum(NOMES_CHEFES) });

const PROMPT_ROTEAR = [
  "Você é o Norte, diretor de um pequeno negócio brasileiro. Diga qual chefe atende o pedido do dono.",
  "",
  "Chefes:",
  listaChefes(),
  "",
  "Responda SÓ com JSON, sem texto antes ou depois:",
  '{"chefe":"<nome exato de um chefe da lista>"}',
].join("\n");

/**
 * Qual chefe atende o pedido. `chefeQueRecusou` é o chefe que já disse
 * "outro_departamento" (o Norte não devolve o pedido para ele).
 * Lança erro se falhar (registrado na execução).
 */
export async function rotear(
  accountId: string,
  pedido: string,
  chefeQueRecusou?: string,
): Promise<{ chefe: NomeChefe; departamento: Departamento }> {
  const exec = await criarExecucao({
    accountId,
    departamento: DEPARTAMENTO,
    chefe: NOME,
    tipo: "CHEFE",
    entrada: { acao: "rotear", pedido, chefeQueRecusou: chefeQueRecusou ?? null },
  });

  try {
    await marcarRodando(accountId, exec.id);
    const mensagem = [
      "<pedido>",
      pedido,
      "</pedido>",
      chefeQueRecusou ? `\n${chefeQueRecusou} já disse que este pedido não é do departamento dele. Escolha outro.` : "",
    ].join("\n");
    const r = await chamarModelo(accountId, PROMPT_ROTEAR, mensagem, { maxTokens: 100, timeoutMs: TIMEOUT_NORTE_MS, chefe: "Norte" });
    const parsed = roteamentoSchema.safeParse(extrairJson(r.texto));
    if (!parsed.success) throw new Error(`Norte devolveu chefe fora da lista: ${r.texto.slice(0, 200)}`);
    const { chefe } = parsed.data;
    const resultado = { chefe, departamento: CHEFES_ATENDEM[chefe].departamento };

    await concluirExecucao(accountId, exec.id, {
      saida: JSON.stringify(resultado),
      ...usoDe(r),
    });
    return resultado;
  } catch (e) {
    await falharExecucao(accountId, exec.id, mensagemDeErro(e));
    throw e;
  }
}
