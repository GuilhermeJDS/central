import "server-only";

import type { TipoListaNegra } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Lista Negra de copy (tabela lista_negra), editada no /admin/lista-negra e
 * pela API. Toda geração (chefes e skills) recebe as regras ativas no bloco
 * de restrições do prompt; o Revisor marca os itens ativos junto com o
 * slop.json; e a saída passa por `limparCopy` (travessão nunca sai).
 *
 * Cache leve em memória: 60 s, ou até o admin/API salvar (invalidarCacheListaNegra).
 */

export type ItemListaNegraAtivo = {
  id: string;
  termo: string;
  tipo: TipoListaNegra;
  substituicaoSugerida: string | null;
  motivo: string | null;
};

export type RegraListaNegra = ItemListaNegraAtivo & { regex: RegExp | null };

const TTL_MS = 60_000;
let cache: { itens: RegraListaNegra[]; expiraEm: number } | null = null;
let carregando: Promise<RegraListaNegra[]> | null = null;

export function invalidarCacheListaNegra() {
  cache = null;
  carregando = null;
}

function escaparRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Regex de um item. PALAVRA/FRASE: texto inteiro, sem diferenciar maiúsculas. REGRA_COPY: sem regex. */
export function regexDoItem(tipo: TipoListaNegra, termo: string): RegExp | null {
  if (tipo === "REGRA_COPY") return null;
  if (tipo === "REGEX") {
    try {
      return new RegExp(termo, "giu");
    } catch {
      return null;
    }
  }
  const corpo = escaparRegex(termo.trim()).replace(/\s+/g, "\\s+");
  return new RegExp(`(?<![\\p{L}\\p{N}])${corpo}(?![\\p{L}\\p{N}])`, "giu");
}

/** Valida um REGEX antes de salvar. */
export function regexValida(termo: string): boolean {
  try {
    new RegExp(termo, "giu");
    return true;
  } catch {
    return false;
  }
}

export async function regrasListaNegra(): Promise<RegraListaNegra[]> {
  if (cache && cache.expiraEm > Date.now()) return cache.itens;
  carregando ??= prisma.itemListaNegra
    .findMany({
      where: { ativo: true },
      orderBy: { criadoEm: "asc" },
      select: { id: true, termo: true, tipo: true, substituicaoSugerida: true, motivo: true },
    })
    .then((itens) => {
      const regras = itens.map((i) => ({ ...i, regex: regexDoItem(i.tipo, i.termo) }));
      cache = { itens: regras, expiraEm: Date.now() + TTL_MS };
      carregando = null;
      return regras;
    })
    .catch((e) => {
      carregando = null;
      console.warn("[lista-negra] não consegui ler:", e instanceof Error ? e.message : e);
      return [] as RegraListaNegra[];
    });
  return carregando;
}

// ---------------------------------------------------------------------------
// Travessão: regra permanente
// ---------------------------------------------------------------------------

/** Troca travessão (—) por vírgula, sem deixar espaço duplo nem vírgula antes de pontuação. */
export function semTravessao(texto: string): string {
  if (!texto.includes("—")) return texto;
  return texto
    .replace(/^[ \t]*—[ \t]*/gm, "")
    .replace(/[ \t]*—[ \t]*(?=[.,;:!?)\n]|$)/gm, "")
    .replace(/[ \t]*—[ \t]*/g, ", ")
    .replace(/,\s*,/g, ",");
}

// ---------------------------------------------------------------------------
// Bloco de restrições dos prompts
// ---------------------------------------------------------------------------

const REGRA_TRAVESSAO = "Nunca use travessão (—) em nenhum texto. Use vírgula, ponto ou dois-pontos.";

/** Restrições para o fim do system prompt: travessão + itens ativos da Lista Negra. */
export async function blocoRestricoesListaNegra(): Promise<string> {
  const itens = await regrasListaNegra();
  const linhas = [`- ${REGRA_TRAVESSAO}`];
  const proibidos = itens.filter((i) => i.tipo === "PALAVRA" || i.tipo === "FRASE");
  for (const i of proibidos.slice(0, 300)) {
    const troca = i.substituicaoSugerida ? ` (use "${i.substituicaoSugerida}")` : "";
    const motivo = i.motivo ? `: ${i.motivo}` : "";
    linhas.push(`- Não use "${i.termo}"${troca}${motivo}.`);
  }
  for (const i of itens.filter((x) => x.tipo === "REGEX").slice(0, 60)) {
    linhas.push(`- Não escreva nada que case com /${i.termo}/${i.motivo ? ` (${i.motivo})` : ""}.`);
  }
  for (const i of itens.filter((x) => x.tipo === "REGRA_COPY").slice(0, 80)) {
    linhas.push(`- ${i.termo}${i.motivo ? ` (${i.motivo})` : ""}`);
  }
  return ["<restricoes_lista_negra>", "Regras de texto da Korely, valem para toda resposta:", ...linhas, "</restricoes_lista_negra>"].join("\n");
}

/** Junta o bloco ao system prompt (uma vez só). */
export async function comRestricoes(sistema: string): Promise<string> {
  if (sistema.includes("<restricoes_lista_negra>")) return sistema;
  return `${sistema.trimEnd()}\n\n${await blocoRestricoesListaNegra()}`;
}

// ---------------------------------------------------------------------------
// Checagem e limpeza da saída
// ---------------------------------------------------------------------------

export type AchadoListaNegra = { id: string; termo: string; tipo: TipoListaNegra; trecho: string; substituicao: string | null; motivo: string | null };

/** Itens ativos (com regex) que aparecem no texto. */
export async function achadosListaNegra(texto: string): Promise<AchadoListaNegra[]> {
  const achados: AchadoListaNegra[] = [];
  for (const r of await regrasListaNegra()) {
    if (!r.regex) continue;
    r.regex.lastIndex = 0;
    for (const m of texto.matchAll(r.regex)) {
      if (!m[0]) continue;
      achados.push({ id: r.id, termo: r.termo, tipo: r.tipo, trecho: m[0], substituicao: r.substituicaoSugerida, motivo: r.motivo });
      if (achados.length > 200) return achados;
    }
  }
  return achados;
}

/**
 * Limpeza sem modelo: tira o travessão e troca o que tem substituição sugerida.
 * O que não tem substituição continua no texto e volta em `pendentes` (o
 * Revisor reescreve; a API devolve como aviso).
 */
export async function limparCopy(texto: string): Promise<{ texto: string; trocas: number; pendentes: AchadoListaNegra[] }> {
  let saida = semTravessao(texto);
  let trocas = saida === texto ? 0 : 1;
  for (const r of await regrasListaNegra()) {
    if (!r.regex || r.substituicaoSugerida === null) continue;
    r.regex.lastIndex = 0;
    const novo = saida.replace(r.regex, (m) => casarCaixa(m, r.substituicaoSugerida!));
    if (novo !== saida) {
      trocas++;
      saida = novo;
    }
  }
  const pendentes = (await achadosListaNegra(saida)).filter((a) => a.substituicao === null);
  return { texto: saida, trocas, pendentes };
}

/** "Incrível" → "Ótimo" quando a troca é "ótimo": mantém a maiúscula do começo. */
function casarCaixa(original: string, troca: string): string {
  if (!troca) return troca;
  const primeira = original.charAt(0);
  if (primeira && primeira === primeira.toUpperCase() && primeira !== primeira.toLowerCase()) {
    return troca.charAt(0).toUpperCase() + troca.slice(1);
  }
  return troca;
}
