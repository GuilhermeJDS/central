/**
 * Inspetor Rastro — chefe do departamento PRESENCA (presença no Google).
 *
 * - preencherFicha: com o lugar achado no Maps, grava na ficha SÓ os campos
 *   vazios (nome, cidade, site, google) e marca a origem como RASTRO. Nunca
 *   sobrescreve o que o dono digitou.
 * - compararVizinhos: acha o negócio e 3 vizinhos do mesmo tipo, compara em
 *   código (nota, nº de avaliações, tem site) e uma chamada ao modelo vira até
 *   3 insights. O modelo não pode inventar número (mesma regra do Gerente
 *   Rotina). Se houver link de avaliação, ele vai no insight de avaliações.
 * - Cache de 7 dias pelas execuções do próprio Inspetor. Na execução ficam só
 *   os placeIds, a fonte usada (reach ou google) e o resultado do chefe,
 *   nunca a lista bruta de lugares.
 *
 * Skills de repositório (conferido em 2026-11-11): nenhuma cabe aqui. O
 * Rastro lê o Google em código e o modelo só escreve os insights, com os
 * números conferidos em código (conferirNumeros) — o crash-out repetiria
 * essa trava; Whale e Closer falam de vender, não de presença no Google.
 *
 * SEGURANÇA: o `accountId` sempre vem do servidor (sessão autenticada).
 */
import "server-only";

import { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import {
  MODELO_CHEFES,
  chamarModelo,
  usoDe,
  extrairJson,
  mensagemDeErro,
} from "@/lib/chefes/chamar-modelo";
import { conferirNumeros } from "@/lib/chefes/gerente-rotina";
import { obterFicha } from "@/lib/negocio/ficha";
import { prisma } from "@/lib/prisma";
import {
  buscarNegocio,
  buscarVizinhos,
  linkAvaliacao,
  type Lugar,
} from "@/lib/rastro/busca";
import {
  concluirExecucao,
  criarExecucao,
  falharExecucao,
  marcarRodando,
} from "@/lib/skills/execucoes";

export const INSPETOR_RASTRO = { nome: "Inspetor Rastro", departamento: "PRESENCA" } as const;

const MAX_TOKENS_RASTRO = 1024;
const TIMEOUT_RASTRO_MS = 60 * 1000;
const CACHE_MS = 7 * 86_400_000;
const LIMITE_VIZINHOS = 3;
const ACAO_COMPARAR = "compararVizinhos";

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

async function gravarEntrada(accountId: string, id: string, entrada: Prisma.InputJsonValue): Promise<void> {
  await prisma.execucaoSkill.updateMany({ where: { id, accountId }, data: { entrada } });
}

/** Execução concluída sem modelo (custo zero). */
async function concluirSemModelo(accountId: string, id: string, saida: unknown): Promise<void> {
  await concluirExecucao(accountId, id, {
    saida: JSON.stringify(saida),
    modelo: MODELO_CHEFES,
    tokensEntrada: 0,
    tokensSaida: 0,
  });
}

function vazio(v: string | null | undefined): boolean {
  return !v || !v.trim();
}

/** "Rua X, 10 - Centro, Campinas - SP, 13000-000, Brasil" → "Campinas". */
export function cidadeDoEndereco(endereco: string | null): string | null {
  if (!endereco) return null;
  for (const parte of endereco.split(",").map((p) => p.trim())) {
    const m = parte.match(/^(.+?)\s+-\s+[A-Z]{2}$/);
    if (m) return m[1].trim();
  }
  return null;
}

/** Reserva quando o Maps não traz categoria: primeira frase do "o que vende", curta. */
function tipoDaFicha(oQueVende: string): string {
  return oQueVende.split(/[.\n;]/)[0].trim().slice(0, 60);
}

// ---------------------------------------------------------------------------
// preencherFicha
// ---------------------------------------------------------------------------

type CampoFicha = "nomeNegocio" | "cidade" | "site" | "google";

export type ResultadoPreencher =
  | { status: "concluida"; execucaoId: string; preenchidos: CampoFicha[] }
  | { status: "sem_ficha" }
  | { status: "erro"; mensagem: string };

export async function preencherFicha(
  accountId: string,
  lugar: Lugar,
  execucaoPaiId?: string,
): Promise<ResultadoPreencher> {
  const exec = await criarExecucao({
    accountId,
    departamento: INSPETOR_RASTRO.departamento,
    chefe: INSPETOR_RASTRO.nome,
    tipo: "CHEFE",
    execucaoPaiId: execucaoPaiId ?? null,
    entrada: { acao: "preencherFicha", placeId: lugar.placeId, fonte: lugar.fonte },
  });

  try {
    await marcarRodando(accountId, exec.id);
    const ficha = await obterFicha(accountId);
    if (!ficha) {
      await falharExecucao(accountId, exec.id, "Negócio sem ficha preenchida.");
      return { status: "sem_ficha" };
    }

    const novos: Partial<Record<CampoFicha, string>> = {};
    const cidade = cidadeDoEndereco(lugar.endereco);
    if (vazio(ficha.nomeNegocio) && lugar.nome) novos.nomeNegocio = lugar.nome;
    if (vazio(ficha.cidade) && cidade) novos.cidade = cidade;
    if (vazio(ficha.site) && lugar.site) novos.site = lugar.site;
    if (vazio(ficha.google) && lugar.linkMaps) novos.google = lugar.linkMaps;

    const preenchidos = Object.keys(novos) as CampoFicha[];
    if (preenchidos.length > 0) {
      await prisma.fichaNegocio.update({
        where: { accountId },
        data: { ...novos, origem: "RASTRO" },
      });
    }

    await concluirSemModelo(accountId, exec.id, { preenchidos });
    return { status: "concluida", execucaoId: exec.id, preenchidos };
  } catch (e) {
    const mensagem = mensagemDeErro(e);
    await falharExecucao(accountId, exec.id, mensagem);
    return { status: "erro", mensagem };
  }
}

// ---------------------------------------------------------------------------
// Comparação em código
// ---------------------------------------------------------------------------

export type NumerosLugar = { nota: number | null; totalAvaliacoes: number | null; temSite: boolean };

export type ComparacaoVizinhos = {
  negocio: NumerosLugar;
  vizinhos: NumerosLugar[];
  mediaNotaVizinhos: number | null;
  mediaAvaliacoesVizinhos: number | null;
  vizinhosComSite: number;
};

function numerosDe(l: Lugar): NumerosLugar {
  return { nota: l.nota, totalAvaliacoes: l.totalAvaliacoes, temSite: !!l.site };
}

function soNumeros(valores: Array<number | null>): number[] {
  return valores.filter((v): v is number => typeof v === "number");
}

export function comparar(negocio: Lugar, vizinhos: Lugar[]): ComparacaoVizinhos {
  const notas = soNumeros(vizinhos.map((v) => v.nota));
  const avaliacoes = soNumeros(vizinhos.map((v) => v.totalAvaliacoes));
  return {
    negocio: numerosDe(negocio),
    vizinhos: vizinhos.map(numerosDe),
    mediaNotaVizinhos: notas.length
      ? Math.round((notas.reduce((a, b) => a + b, 0) / notas.length) * 10) / 10
      : null,
    mediaAvaliacoesVizinhos: avaliacoes.length
      ? Math.round(avaliacoes.reduce((a, b) => a + b, 0) / avaliacoes.length)
      : null,
    vizinhosComSite: vizinhos.filter((v) => !!v.site).length,
  };
}

function nota(v: number | null): string {
  return v === null ? "sem nota" : v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function avaliacoes(v: number | null): string {
  return v === null ? "sem avaliações" : `${v} avaliações`;
}

function linhaLugar(rotulo: string, n: NumerosLugar): string {
  return `${rotulo}: nota ${nota(n.nota)}; ${avaliacoes(n.totalAvaliacoes)}; tem site: ${n.temSite ? "sim" : "não"}`;
}

export function textoDaComparacao(c: ComparacaoVizinhos): string {
  const linhas = [linhaLugar("Seu negócio", c.negocio)];
  c.vizinhos.forEach((v, i) => linhas.push(linhaLugar(`Concorrente vizinho ${i + 1}`, v)));
  linhas.push(`Nota média dos concorrentes: ${nota(c.mediaNotaVizinhos)}`);
  linhas.push(
    `Média de avaliações dos concorrentes: ${c.mediaAvaliacoesVizinhos === null ? "sem dados" : c.mediaAvaliacoesVizinhos}`,
  );
  linhas.push(`Concorrentes com site: ${c.vizinhosComSite} de ${c.vizinhos.length}`);
  return linhas.join("\n");
}

// ---------------------------------------------------------------------------
// Insights
// ---------------------------------------------------------------------------

export type InsightRastro = {
  titulo: string;
  porQuePesa: string;
  oQueFazer: string;
  /** Só no insight de avaliações, quando o lugar veio do Google. */
  linkAvaliacao?: string;
};

const insightsSchema = z.object({
  insights: z
    .array(
      z.object({
        tema: z.enum(["nota", "avaliacoes", "site", "outro"]),
        titulo: z.string().trim().min(1).max(120),
        porQuePesa: z.string().trim().min(1).max(600),
        oQueFazer: z.string().trim().min(1).max(600),
      }),
    )
    .min(1)
    .max(3),
});

const PROMPT_RASTRO = [
  "Você é o Inspetor Rastro, que cuida da presença no Google de um pequeno negócio brasileiro.",
  "Recebe a comparação, já calculada, do negócio com concorrentes vizinhos no Google Maps. Transforme-a em ATÉ 3 insights úteis para o dono.",
  "",
  "Regras:",
  "- Use SÓ os números que estão em <comparacao>. Não calcule número novo, não estime, não arredonde diferente. Se citar um número, copie como está.",
  "- Escolha o que mais pesa para o cliente escolher este negócio no Google. Se o negócio já estiver bem num ponto, não force insight sobre ele.",
  "- tema: \"nota\", \"avaliacoes\", \"site\" ou \"outro\". No máximo um insight por tema.",
  "- Se <link_avaliacao> for \"sim\", o insight de avaliações pode dizer para mandar o link de avaliação aos clientes (o link é colocado depois, não escreva URL).",
  "- titulo: curto e direto. porQuePesa: por que isso importa, em uma ou duas frases. oQueFazer: uma ação concreta para esta semana.",
  "- Não cite nome de concorrente. Português do Brasil, linguagem simples, sem travessão \"—\".",
  "",
  "Responda SÓ com JSON, sem texto antes ou depois, sem cercas de código:",
  '{"insights":[{"tema":"","titulo":"","porQuePesa":"","oQueFazer":""}]}',
].join("\n");

// ---------------------------------------------------------------------------
// compararVizinhos
// ---------------------------------------------------------------------------

export type ResultadoComparacao =
  | {
      status: "concluida";
      execucaoId: string;
      doCache: boolean;
      comparacao: ComparacaoVizinhos;
      insights: InsightRastro[];
    }
  | { status: "nao_encontrado"; execucaoId: string; doCache: boolean }
  | { status: "sem_vizinhos"; execucaoId: string; doCache: boolean }
  | { status: "sem_ficha" }
  | { status: "erro"; mensagem: string };

type SaidaComparacao =
  | { status: "concluida"; comparacao: ComparacaoVizinhos; insights: InsightRastro[] }
  | { status: "nao_encontrado" }
  | { status: "sem_vizinhos" };

async function doCache(accountId: string): Promise<ResultadoComparacao | null> {
  const e = await prisma.execucaoSkill.findFirst({
    where: {
      accountId,
      departamento: INSPETOR_RASTRO.departamento,
      chefe: INSPETOR_RASTRO.nome,
      status: "CONCLUIDA",
      criadaEm: { gte: new Date(Date.now() - CACHE_MS) },
      acao: ACAO_COMPARAR,
    },
    orderBy: { criadaEm: "desc" },
    select: { id: true, saida: true },
  });
  if (!e?.saida) return null;
  try {
    const s = JSON.parse(e.saida) as SaidaComparacao;
    if (s.status === "concluida") return { ...s, execucaoId: e.id, doCache: true };
    if (s.status === "nao_encontrado" || s.status === "sem_vizinhos") {
      return { status: s.status, execucaoId: e.id, doCache: true };
    }
  } catch {
    // saída antiga/corrompida: ignora o cache
  }
  return null;
}

/**
 * Compara o negócio com 3 vizinhos no Google Maps. `tipo` é o que buscar
 * como concorrente (ex.: "clínica de estética"); sem ele, usa a categoria do próprio
 * negócio no Maps e, se ela vier vazia, a primeira frase do "o que vende".
 */
export async function compararVizinhos(
  accountId: string,
  opts: { tipo?: string; ignorarCache?: boolean } = {},
): Promise<ResultadoComparacao> {
  if (!opts.ignorarCache) {
    const cache = await doCache(accountId);
    if (cache) return cache;
  }

  const exec = await criarExecucao({
    accountId,
    departamento: INSPETOR_RASTRO.departamento,
    chefe: INSPETOR_RASTRO.nome,
    tipo: "CHEFE",
    entrada: { acao: ACAO_COMPARAR },
  });

  const ficha = await obterFicha(accountId);
  if (!ficha) {
    await falharExecucao(accountId, exec.id, "Negócio sem ficha preenchida.");
    return { status: "sem_ficha" };
  }

  const entrada: Record<string, string | string[] | null> = { acao: ACAO_COMPARAR };

  try {
    await marcarRodando(accountId, exec.id);

    const negocio = await buscarNegocio(ficha.nomeNegocio, ficha.cidade);
    entrada.fonteNegocio = negocio.fonte;
    entrada.placeIdNegocio = negocio.lugar?.placeId ?? null;
    await gravarEntrada(accountId, exec.id, entrada);

    if (!negocio.lugar) {
      await concluirSemModelo(accountId, exec.id, { status: "nao_encontrado" } satisfies SaidaComparacao);
      return { status: "nao_encontrado", execucaoId: exec.id, doCache: false };
    }

    // Aproveita o lugar achado para completar a ficha (só campos vazios).
    await preencherFicha(accountId, negocio.lugar, exec.id);

    const tipo = opts.tipo?.trim() || negocio.lugar.categoria || tipoDaFicha(ficha.oQueVende);
    entrada.tipo = tipo;

    const vizinhos = await buscarVizinhos(tipo, ficha.cidade, negocio.lugar.placeId, LIMITE_VIZINHOS);
    entrada.fonteVizinhos = vizinhos.fonte;
    entrada.placeIdsVizinhos = vizinhos.lugares.map((l) => l.placeId);
    await gravarEntrada(accountId, exec.id, entrada);

    if (vizinhos.lugares.length === 0) {
      await concluirSemModelo(accountId, exec.id, { status: "sem_vizinhos" } satisfies SaidaComparacao);
      return { status: "sem_vizinhos", execucaoId: exec.id, doCache: false };
    }

    const comparacao = comparar(negocio.lugar, vizinhos.lugares);
    const link = linkAvaliacao(negocio.lugar.placeId, negocio.lugar.fonte);
    const mensagem = [
      `<negocio>\n${ficha.nomeNegocio} (${ficha.cidade}), tipo: ${tipo}\n</negocio>`,
      "",
      "<comparacao>",
      textoDaComparacao(comparacao),
      "</comparacao>",
      "",
      `<link_avaliacao>${link ? "sim" : "não"}</link_avaliacao>`,
    ].join("\n");

    const r = await chamarModelo(accountId, PROMPT_RASTRO, mensagem, {
      maxTokens: MAX_TOKENS_RASTRO,
      timeoutMs: TIMEOUT_RASTRO_MS,
      chefe: "Inspetor Rastro",
    });
    const parsed = insightsSchema.safeParse(extrairJson(r.texto));
    if (!parsed.success) throw new Error(`JSON do Inspetor Rastro fora do formato: ${parsed.error.message}`);
    // "3" (vizinhos) e "7" (dias) podem aparecer no texto sem estar nos dados.
    conferirNumeros(parsed.data.insights, `${mensagem}\n${LIMITE_VIZINHOS} 7`);

    let linkUsado = false;
    const insights: InsightRastro[] = parsed.data.insights.map(({ tema, ...i }) => {
      if (link && tema === "avaliacoes" && !linkUsado) {
        linkUsado = true;
        return { ...i, linkAvaliacao: link };
      }
      return i;
    });

    await concluirExecucao(accountId, exec.id, {
      saida: JSON.stringify({ status: "concluida", comparacao, insights } satisfies SaidaComparacao),
      ...usoDe(r),
    });
    return { status: "concluida", execucaoId: exec.id, doCache: false, comparacao, insights };
  } catch (e) {
    const mensagem = mensagemDeErro(e);
    await falharExecucao(accountId, exec.id, mensagem);
    return { status: "erro", mensagem };
  }
}
