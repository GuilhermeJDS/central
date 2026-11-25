/**
 * Departamentos conectados: o que um chefe produz alimenta o próximo.
 *
 *   Inspetor Rastro (concorrentes no Google)
 *     → Editora Pauta (ideias a partir do que os vizinhos fazem/deixam de fazer)
 *       → Negociador Trato (usa o conteúdo aprovado nas mensagens)
 *         → Norte (junta tudo na ação da semana)
 *
 * `insumosPara` devolve o bloco que entra na skill do chefe e as fontes
 * (quem forneceu o quê), gravadas na execução para a tela mostrar
 * "veio do Rastro", "veio da Pauta".
 *
 * SEGURANÇA: accountId sempre do servidor.
 */
import "server-only";

import type { ComparacaoVizinhos, InsightRastro } from "@/lib/chefes/inspetor-rastro";
import { prisma } from "@/lib/prisma";

export type FonteLigacao = { chefe: string; titulo: string; execucaoId: string };

export type Insumos = { bloco: string | null; fontes: FonteLigacao[] };

const DIA_MS = 86_400_000;

/** Quem alimenta quem. */
export const ALIMENTA: Record<string, string> = {
  "Inspetor Rastro": "Editora Pauta",
  "Editora Pauta": "Negociador Trato",
  "Negociador Trato": "Norte",
};

const nota = (v: number | null) =>
  v === null ? "sem nota" : v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

async function doRastro(accountId: string): Promise<Insumos> {
  const e = await prisma.execucaoSkill.findFirst({
    where: {
      accountId,
      chefe: "Inspetor Rastro",
      status: "CONCLUIDA",
      acao: "compararVizinhos",
      concluidaEm: { gte: new Date(Date.now() - 45 * DIA_MS) },
    },
    orderBy: { concluidaEm: "desc" },
    select: { id: true, saida: true },
  });
  if (!e?.saida) return { bloco: null, fontes: [] };
  let s: { status?: string; comparacao?: ComparacaoVizinhos; insights?: InsightRastro[] } | null = null;
  try {
    s = JSON.parse(e.saida);
  } catch {
    return { bloco: null, fontes: [] };
  }
  if (s?.status !== "concluida" || !s.comparacao?.vizinhos.length) return { bloco: null, fontes: [] };
  const c = s.comparacao;
  const linhas = [
    `Concorrentes por perto no Google (${c.vizinhos.length} comparados): nota média ${nota(c.mediaNotaVizinhos)}, ${c.mediaAvaliacoesVizinhos ?? "?"} avaliações em média, ${c.vizinhosComSite} com site.`,
    `O negócio: nota ${nota(c.negocio.nota)}, ${c.negocio.totalAvaliacoes ?? "?"} avaliações, ${c.negocio.temSite ? "tem" : "não tem"} site.`,
    ...(s.insights ?? []).slice(0, 3).map((i) => `- ${i.titulo}: ${i.oQueFazer}`),
    "Use isso para criar conteúdo que mostre por que escolher este negócio e não os vizinhos (sem citar nomes de concorrentes).",
  ];
  return {
    bloco: linhas.join("\n"),
    fontes: [{ chefe: "Inspetor Rastro", titulo: s.insights?.[0]?.titulo ?? "Comparação com os vizinhos", execucaoId: e.id }],
  };
}

/** Peças aprovadas de um chefe (Entregas prontas ou trabalho aprovado), mais novas primeiro. */
async function aprovadosDe(accountId: string, chefe: string, quantos: number): Promise<Insumos> {
  const desde = new Date(Date.now() - 30 * DIA_MS);
  const entregas = await prisma.entregaChefe.findMany({
    where: { accountId, chefe, status: "PRONTA", criadaEm: { gte: desde } },
    orderBy: { criadaEm: "desc" },
    take: quantos,
    select: { titulo: true, tipo: true, texto: true, conteudo: true, execucaoOrigemId: true },
  });
  if (!entregas.length) return { bloco: null, fontes: [] };
  const linhas = entregas.map((e) => {
    const slides = (e.conteudo as { slides?: Array<{ titulo?: string }> } | null)?.slides ?? [];
    const corpo = slides.length ? slides.map((s) => s.titulo).filter(Boolean).join(" / ") : (e.texto ?? "");
    return `- ${e.tipo.toLowerCase()} "${e.titulo}": ${corpo.replace(/\s+/g, " ").slice(0, 500)}`;
  });
  return {
    bloco: linhas.join("\n"),
    fontes: entregas.map((e) => ({ chefe, titulo: e.titulo, execucaoId: e.execucaoOrigemId })),
  };
}

/** O insumo que entra na skill de `chefe`, vindo de quem o alimenta. */
export async function insumosPara(accountId: string, chefe: string): Promise<Insumos> {
  if (chefe === "Editora Pauta") {
    const r = await doRastro(accountId);
    return r.bloco ? { bloco: `<do_inspetor_rastro>\n${r.bloco}\n</do_inspetor_rastro>`, fontes: r.fontes } : r;
  }
  if (chefe === "Negociador Trato") {
    const r = await aprovadosDe(accountId, "Editora Pauta", 2);
    return r.bloco
      ? {
          bloco: `<da_editora_pauta>\nConteúdo que o dono já aprovou nas redes. Quando fizer sentido, use nas mensagens (ex.: "postamos umas dicas sobre…"):\n${r.bloco}\n</da_editora_pauta>`,
          fontes: r.fontes.slice(0, 1),
        }
      : r;
  }
  return { bloco: null, fontes: [] };
}

/** Tudo o que o Norte junta na ação da semana (Rastro → Pauta → Trato). */
export async function insumosDoNorte(accountId: string): Promise<Insumos> {
  const [rastro, pauta, trato] = await Promise.all([
    doRastro(accountId),
    aprovadosDe(accountId, "Editora Pauta", 3),
    aprovadosDe(accountId, "Negociador Trato", 2),
  ]);
  const partes = [
    rastro.bloco ? `Inspetor Rastro (concorrentes):\n${rastro.bloco}` : null,
    pauta.bloco ? `Editora Pauta (conteúdo aprovado):\n${pauta.bloco}` : null,
    trato.bloco ? `Negociador Trato (mensagens aprovadas):\n${trato.bloco}` : null,
  ].filter(Boolean);
  return {
    bloco: partes.length ? partes.join("\n\n") : null,
    fontes: [...rastro.fontes, ...pauta.fontes.slice(0, 1), ...trato.fontes.slice(0, 1)],
  };
}

/** Fontes gravadas na entrada de uma execução (SKILL ou CHEFE do Norte). */
export function fontesDaEntrada(entrada: unknown): FonteLigacao[] {
  const f = entrada && typeof entrada === "object" ? (entrada as { fontes?: unknown }).fontes : null;
  if (!Array.isArray(f)) return [];
  return f
    .filter((x): x is FonteLigacao => !!x && typeof x === "object" && typeof (x as FonteLigacao).chefe === "string")
    .map((x) => ({ chefe: x.chefe, titulo: String(x.titulo ?? ""), execucaoId: String(x.execucaoId ?? "") }));
}
