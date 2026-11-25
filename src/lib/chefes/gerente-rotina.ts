/**
 * Gerente Rotina — chefe do departamento OPERACAO.
 *
 * a) Calcula em código (sem modelo), a partir dos números do mês que o dono
 *    informa em Operação (ou que o agente dele manda pela API). Sem nenhum
 *    mês informado → { status: "sem_dados" } sem quebrar nada.
 *    Números:
 *    atendimentos, cancelados e faltas (30 dias contra os 30 anteriores),
 *    clientes que não voltam há mais de 60 dias e receita do mês contra o
 *    mês anterior.
 * b) Uma chamada transforma os números em até 3 insights. O modelo não pode
 *    inventar número: todo número da resposta tem que estar nos dados.
 * c) Sem dados suficientes → { status: "sem_dados" } sem chamar o modelo.
 *
 * Skills de repositório (conferido em 2026-11-11): nenhuma cabe aqui. Os
 * números saem do banco em código e conferirNumeros barra número inventado;
 * a mensagem para cliente sumido é do Negociador Trato (win-back), que usa
 * estes mesmos números.
 *
 * SEGURANÇA: o `accountId` sempre vem do servidor (sessão autenticada).
 */
import "server-only";

import { z } from "zod";

import {
  MODELO_CHEFES,
  chamarModelo,
  usoDe,
  extrairJson,
  mensagemDeErro,
} from "@/lib/chefes/chamar-modelo";
import { startOfDayBR, toDateKeyBR } from "@/lib/agenda-date";
import { obterFicha } from "@/lib/negocio/ficha";
import { prisma } from "@/lib/prisma";
import {
  concluirExecucao,
  criarExecucao,
  falharExecucao,
  marcarRodando,
} from "@/lib/skills/execucoes";

export const GERENTE_ROTINA = { nome: "Gerente Rotina", departamento: "OPERACAO" } as const;

const MAX_TOKENS_ROTINA = 1024;
const TIMEOUT_ROTINA_MS = 60 * 1000;
const DIA_MS = 86_400_000;
/** Menos atendimentos que isso nos dois meses = sem dados suficientes. */
const MINIMO_AGENDAMENTOS_60_DIAS = 5;

// ---------------------------------------------------------------------------
// Números
// ---------------------------------------------------------------------------

export type NumerosRotina = {
  atendimentos30: number;
  atendimentosAnteriores30: number;
  cancelados30: number;
  canceladosAnteriores30: number;
  faltas30: number;
  faltasAnteriores30: number;
  clientesAtendidosHistorico: number;
  clientesSemVoltar60: number;
  receitaMesAtual: number;
  receitaMesAnteriorMesmoPeriodo: number;
  receitaMesAnteriorInteiro: number;
  diaDoMes: number;
};

export type InsightRotina = { titulo: string; porQuePesa: string; oQueFazer: string };

export type ResultadoRotina =
  | { status: "concluida"; execucaoId: string; numeros: NumerosRotina; insights: InsightRotina[] }
  | { status: "sem_dados" }
  | { status: "erro"; mensagem: string };

/** A Operação tem dados quando a conta informou os números de algum mês. */
export async function temUnidadeOperacao(accountId: string): Promise<boolean> {
  return (await prisma.numeroMes.count({ where: { accountId } })) > 0;
}

/** "2026-11" do mês de hoje (horário de Brasília) e do anterior. */
export function mesesAtualEAnterior(agora = new Date()): { atual: string; anterior: string; dia: number } {
  const [ano, mes, dia] = toDateKeyBR(agora).split("-").map(Number);
  const atual = `${ano}-${String(mes).padStart(2, "0")}`;
  const anterior = mes === 1 ? `${ano - 1}-12` : `${ano}-${String(mes - 1).padStart(2, "0")}`;
  return { atual, anterior, dia };
}

const ZERO: NumerosRotina = {
  atendimentos30: 0,
  atendimentosAnteriores30: 0,
  cancelados30: 0,
  canceladosAnteriores30: 0,
  faltas30: 0,
  faltasAnteriores30: 0,
  clientesAtendidosHistorico: 0,
  clientesSemVoltar60: 0,
  receitaMesAtual: 0,
  receitaMesAnteriorMesmoPeriodo: 0,
  receitaMesAnteriorInteiro: 0,
  diaDoMes: 0,
};

/**
 * Números da Operação a partir dos meses informados (tabela numeros_mes):
 * o mês atual contra o anterior. "30 dias" aqui é o mês. Sem nenhum mês
 * informado → semUnidade (nome herdado: "sem dados para ler").
 */
export async function calcularNumeros(
  accountId: string,
): Promise<{ numeros: NumerosRotina; agendamentos60: number; semUnidade?: true }> {
  const { atual, anterior, dia } = mesesAtualEAnterior();
  const linhas = await prisma.numeroMes.findMany({ where: { accountId }, orderBy: { mes: "desc" }, take: 2 });
  if (!linhas.length) return { semUnidade: true, agendamentos60: 0, numeros: ZERO };
  // Mês atual ainda não informado: o último informado faz o papel de "atual".
  const a = linhas.find((l) => l.mes === atual) ?? linhas[0];
  const b = linhas.find((l) => l.mes === anterior && l !== a) ?? (linhas[1] !== a ? linhas[1] : undefined);
  const reais = (c: number) => Math.round(c) / 100;
  // Mesmo período do mês anterior: proporcional ao dia em que o atual parou.
  const diaAtual = a.mes === atual ? Math.min(a.ateDia, dia) : a.ateDia;
  const proporcao = b ? Math.min(1, diaAtual / 30) : 0;
  return {
    agendamentos60: a.atendimentos + (b?.atendimentos ?? 0),
    numeros: {
      atendimentos30: a.atendimentos,
      atendimentosAnteriores30: b?.atendimentos ?? 0,
      cancelados30: a.cancelados,
      canceladosAnteriores30: b?.cancelados ?? 0,
      faltas30: a.faltas,
      faltasAnteriores30: b?.faltas ?? 0,
      clientesAtendidosHistorico: a.clientesAtivos,
      clientesSemVoltar60: a.clientesSumidos,
      receitaMesAtual: reais(a.receitaCentavos),
      receitaMesAnteriorMesmoPeriodo: b ? reais(b.receitaCentavos * proporcao) : 0,
      receitaMesAnteriorInteiro: b ? reais(b.receitaCentavos) : 0,
      diaDoMes: diaAtual,
    },
  };
}

function variacao(atual: number, anterior: number): string {
  if (anterior === 0) return atual === 0 ? "sem mudança" : "sem base de comparação";
  const p = Math.round(((atual - anterior) / anterior) * 100);
  return p === 0 ? "sem mudança" : `${p > 0 ? "+" : ""}${p}%`;
}

function reais(v: number): string {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function textoDosNumeros(n: NumerosRotina): string {
  return [
    `Atendimentos realizados nos últimos 30 dias: ${n.atendimentos30} (30 dias anteriores: ${n.atendimentosAnteriores30}; variação: ${variacao(n.atendimentos30, n.atendimentosAnteriores30)})`,
    `Cancelamentos nos últimos 30 dias: ${n.cancelados30} (30 dias anteriores: ${n.canceladosAnteriores30}; variação: ${variacao(n.cancelados30, n.canceladosAnteriores30)})`,
    `Faltas nos últimos 30 dias: ${n.faltas30} (30 dias anteriores: ${n.faltasAnteriores30}; variação: ${variacao(n.faltas30, n.faltasAnteriores30)})`,
    `Clientes que já foram atendidos: ${n.clientesAtendidosHistorico}`,
    `Clientes sem voltar há mais de 60 dias e sem horário marcado: ${n.clientesSemVoltar60}`,
    `Receita do mês até hoje (dia ${n.diaDoMes}): ${reais(n.receitaMesAtual)}`,
    `Receita do mês anterior no mesmo período: ${reais(n.receitaMesAnteriorMesmoPeriodo)} (variação: ${variacao(n.receitaMesAtual, n.receitaMesAnteriorMesmoPeriodo)})`,
    `Receita do mês anterior inteiro: ${reais(n.receitaMesAnteriorInteiro)}`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Insights
// ---------------------------------------------------------------------------

const insightsSchema = z.object({
  insights: z
    .array(
      z.object({
        titulo: z.string().trim().min(1).max(120),
        porQuePesa: z.string().trim().min(1).max(600),
        oQueFazer: z.string().trim().min(1).max(600),
      }),
    )
    .min(1)
    .max(3),
});

const PROMPT_ROTINA = [
  "Você é o Gerente Rotina de um pequeno negócio brasileiro de atendimento com hora marcada.",
  "Recebe os números da operação, já calculados. Transforme-os em ATÉ 3 insights úteis para o dono.",
  "",
  "Regras:",
  "- Use SÓ os números que estão em <numeros>. Não calcule número novo, não estime, não arredonde diferente. Se citar um número, copie como está.",
  "- Escolha o que mais pesa no caixa e na agenda. Se um número estiver estável e sem problema, não force insight sobre ele.",
  "- titulo: curto e direto. porQuePesa: por que isso importa para o negócio, em uma ou duas frases. oQueFazer: uma ação concreta para esta semana.",
  "- Português do Brasil, linguagem simples, sem travessão \"—\".",
  "",
  "Responda SÓ com JSON, sem texto antes ou depois, sem cercas de código:",
  '{"insights":[{"titulo":"","porQuePesa":"","oQueFazer":""}]}',
].join("\n");

/** Números como sequência de dígitos (sem separador), para comparar. */
function numerosDoTexto(texto: string): string[] {
  return (texto.match(/\d+(?:[.,]\d+)*/g) ?? []).map((n) => n.replace(/[.,]/g, ""));
}

/** Garante que todo número dos insights veio dos dados enviados. */
export function conferirNumeros(
  insights: Array<{ titulo: string; porQuePesa: string; oQueFazer: string }>,
  fonte: string,
): void {
  const permitidos = new Set(numerosDoTexto(fonte));
  for (const i of insights) {
    for (const n of numerosDoTexto(`${i.titulo} ${i.porQuePesa} ${i.oQueFazer}`)) {
      if (!permitidos.has(n)) throw new Error(`Insight com número que não veio dos dados: ${n}`);
    }
  }
}

// ---------------------------------------------------------------------------
// lerRotina
// ---------------------------------------------------------------------------

export async function lerRotina(accountId: string): Promise<ResultadoRotina> {
  const exec = await criarExecucao({
    accountId,
    departamento: GERENTE_ROTINA.departamento,
    chefe: GERENTE_ROTINA.nome,
    tipo: "CHEFE",
    entrada: { acao: "lerRotina" },
  });

  try {
    await marcarRodando(accountId, exec.id);
    const { numeros, agendamentos60, semUnidade } = await calcularNumeros(accountId);

    if (semUnidade || agendamentos60 < MINIMO_AGENDAMENTOS_60_DIAS) {
      await concluirExecucao(accountId, exec.id, {
        saida: JSON.stringify(
          semUnidade
            ? { status: "sem_dados", motivo: "sem_unidade" }
            : { status: "sem_dados", agendamentos60, numeros },
        ),
        modelo: MODELO_CHEFES,
        tokensEntrada: 0,
        tokensSaida: 0,
      });
      return { status: "sem_dados" };
    }

    const textoNumeros = textoDosNumeros(numeros);
    const ficha = await obterFicha(accountId);
    const mensagem = [
      ficha ? `<negocio>\n${ficha.nomeNegocio} (${ficha.cidade}): ${ficha.oQueVende}\n</negocio>\n` : "",
      "<numeros>",
      textoNumeros,
      "</numeros>",
    ].join("\n");

    const r = await chamarModelo(accountId, PROMPT_ROTINA, mensagem, {
      maxTokens: MAX_TOKENS_ROTINA,
      timeoutMs: TIMEOUT_ROTINA_MS,
      chefe: "Gerente Rotina",
    });
    const parsed = insightsSchema.safeParse(extrairJson(r.texto));
    if (!parsed.success) throw new Error(`JSON do Gerente Rotina fora do formato: ${parsed.error.message}`);
    const insights = parsed.data.insights;
    // Números da ficha também podem aparecer (ex.: nome com número).
    conferirNumeros(insights, `${mensagem}\n30 60`);

    await concluirExecucao(accountId, exec.id, {
      saida: JSON.stringify({ status: "concluida", numeros, insights }),
      ...usoDe(r),
    });
    return { status: "concluida", execucaoId: exec.id, numeros, insights };
  } catch (e) {
    const mensagem = mensagemDeErro(e);
    await falharExecucao(accountId, exec.id, mensagem);
    return { status: "erro", mensagem };
  }
}
