/**
 * Estúdio de Redes: as páginas (agrupadas) e o filtro de rede, que fica na
 * URL (?rede=) e vale para todas as páginas. Módulo puro.
 */
import type { TipoEntrega } from "@/lib/central/entregas-tipos";
import { TIPOS_CARROSSEL, TIPOS_VIDEO } from "@/lib/central/estudio/tipos";
import { AREAS_REDES, type SlugRede } from "@/lib/central/redes-areas";
import { ehRedeConectavel } from "@/lib/redes/catalogo";

export type SecaoEstudio = { href: string; rotulo: string; /** Nome completo (leitor de tela e título). */ nome?: string };
export type GrupoEstudio = { rotulo: string | null; secoes: SecaoEstudio[] };

export const BASE_ESTUDIO = "/central/redes";

export const GRUPOS_ESTUDIO: readonly GrupoEstudio[] = [
  { rotulo: null, secoes: [{ href: BASE_ESTUDIO, rotulo: "Cronograma" }] },
  {
    rotulo: "Criação",
    secoes: [
      { href: `${BASE_ESTUDIO}/pautas`, rotulo: "Pautas" },
      { href: `${BASE_ESTUDIO}/carrosseis`, rotulo: "Carrosséis" },
      { href: `${BASE_ESTUDIO}/videos`, rotulo: "Reels e Vídeos" },
      { href: `${BASE_ESTUDIO}/referencias`, rotulo: "Referências" },
    ],
  },
  {
    rotulo: "Desempenho",
    secoes: [
      { href: `${BASE_ESTUDIO}/insights`, rotulo: "Insights" },
      { href: `${BASE_ESTUDIO}/publicados`, rotulo: "Publicados" },
    ],
  },
  {
    rotulo: "Marca",
    secoes: [
      { href: `${BASE_ESTUDIO}/marca`, rotulo: "Identidade" },
      { href: `${BASE_ESTUDIO}/marca/imagens`, rotulo: "Imagens", nome: "Biblioteca de imagens" },
      { href: `${BASE_ESTUDIO}/marca/capas`, rotulo: "Capas" },
    ],
  },
];

export const REDES_FILTRO = AREAS_REDES.map((a) => ({ slug: a.slug, nome: a.nome, rede: a.rede }));

/**
 * Que rede tem cada página. Sai das ações de cada rede (redes-areas): se
 * nenhuma ação da rede gera aquele formato, a página não existe nela
 * (YouTube e X não têm carrossel; X não tem vídeo; TikTok não conecta,
 * então não tem Insights). Ganhou ação nova, a página aparece sozinha.
 */
function redesQueGeram(tipos: readonly TipoEntrega[]): Set<SlugRede> {
  return new Set(AREAS_REDES.filter((a) => a.acoes.some((x) => x.formato && tipos.includes(x.formato))).map((a) => a.slug));
}
const REDES_CARROSSEL = redesQueGeram(TIPOS_CARROSSEL);
const REDES_VIDEO = redesQueGeram(TIPOS_VIDEO);
const REDES_POR_SECAO: Record<string, Set<SlugRede>> = {
  [`${BASE_ESTUDIO}/carrosseis`]: REDES_CARROSSEL,
  [`${BASE_ESTUDIO}/videos`]: REDES_VIDEO,
  [`${BASE_ESTUDIO}/marca/capas`]: new Set([...REDES_CARROSSEL, ...REDES_VIDEO]),
  [`${BASE_ESTUDIO}/insights`]: new Set(AREAS_REDES.filter((a) => ehRedeConectavel(a.rede)).map((a) => a.slug)),
};

/** A página existe nesta rede? (sem rede = todas: sempre) */
export function secaoServeRede(href: string, slug: SlugRede | null | undefined): boolean {
  if (!slug) return true;
  return REDES_POR_SECAO[href]?.has(slug) ?? true;
}

/** Nome da página na rede escolhida (Reels no Instagram, Vídeos e Shorts no YouTube). */
const ROTULO_VIDEOS: Partial<Record<SlugRede, string>> = { instagram: "Reels", youtube: "Vídeos e Shorts", tiktok: "Vídeos" };
export function rotuloSecao(s: SecaoEstudio, slug: SlugRede | null | undefined): string {
  if (s.href === `${BASE_ESTUDIO}/videos` && slug) return ROTULO_VIDEOS[slug] ?? s.rotulo;
  if (s.href === `${BASE_ESTUDIO}/carrosseis` && slug === "linkedin") return "Carrosséis em PDF";
  return s.rotulo;
}

/** Slug da URL → valor gravado (INSTAGRAM…). null = todas. */
export function redeDoFiltro(slug: string | string[] | undefined): { slug: SlugRede; rede: string; nome: string } | null {
  const s = Array.isArray(slug) ? slug[0] : slug;
  return REDES_FILTRO.find((r) => r.slug === s) ?? null;
}

export function slugDaRede(rede: string | null | undefined): SlugRede | null {
  return REDES_FILTRO.find((r) => r.rede === rede)?.slug ?? null;
}

/** Link mantendo o filtro de rede. */
export function comRede(href: string, rede: string | null | undefined): string {
  if (!rede) return href;
  return `${href}${href.includes("?") ? "&" : "?"}rede=${rede}`;
}

/** A seção ativa: a mais específica que casa com o caminho. */
export function secaoAtiva(caminho: string): string | null {
  const todas = GRUPOS_ESTUDIO.flatMap((g) => g.secoes.map((s) => s.href)).sort((a, b) => b.length - a.length);
  return todas.find((h) => (h === BASE_ESTUDIO ? caminho === h : caminho === h || caminho.startsWith(`${h}/`))) ?? null;
}

/** Página da peça no estúdio, pelo tipo. */
export function hrefDaPeca(p: { id: string; tipo: TipoEntrega }, rede: string | null): string {
  const base = TIPOS_CARROSSEL.includes(p.tipo)
    ? `${BASE_ESTUDIO}/carrosseis`
    : TIPOS_VIDEO.includes(p.tipo)
      ? `${BASE_ESTUDIO}/videos`
      : `${BASE_ESTUDIO}/pautas`;
  return comRede(`${base}/${p.id}`, rede);
}
