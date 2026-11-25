/**
 * Tipos do estúdio de Redes (módulo puro: vai para a tela).
 */
import type { MarcaCarrossel } from "@/lib/central/carrossel";
import type { StatusEntrega, TipoEntrega, TrabalhoView } from "@/lib/central/entregas-tipos";
import type { SlideEstudio } from "@/lib/central/estudio/slide";

export type Etapa = "EM_REVISAO" | "APROVADO" | "PROGRAMADO" | "PUBLICADO";
export const ETAPAS: readonly Etapa[] = ["EM_REVISAO", "APROVADO", "PROGRAMADO", "PUBLICADO"];
export const ROTULO_ETAPA: Record<Etapa, string> = {
  EM_REVISAO: "Em revisão",
  APROVADO: "Aprovado",
  PROGRAMADO: "Programado",
  PUBLICADO: "Publicado",
};

export function etapaDe(v: string | null | undefined): Etapa {
  return (ETAPAS as readonly string[]).includes(v ?? "") ? (v as Etapa) : "EM_REVISAO";
}

/** Tipos de peça de cada biblioteca. */
export const TIPOS_CARROSSEL: TipoEntrega[] = ["CARROSSEL"];
export const TIPOS_VIDEO: TipoEntrega[] = ["ROTEIRO", "TITULO", "THUMBNAIL"];
export const TIPOS_PAUTA: TipoEntrega[] = ["POST", "THREAD", "TEXTO"];

export type CapaPeca = { slide: SlideEstudio; total: number; marca: MarcaCarrossel };

export type PecaView = {
  id: string;
  tipo: TipoEntrega;
  rede: string | null;
  titulo: string;
  etapa: Etapa;
  producao: StatusEntrega;
  trabalho: TrabalhoView;
  versoes: number;
  em: string;
  programadaPara: string | null;
  publicadaEm: string | null;
  /** Carrossel: o primeiro slide da versão principal. */
  capa: CapaPeca | null;
  /** Peças de texto: o começo do texto. */
  resumo: string;
  /** Miniatura do post vinculado (vídeos, publicados). */
  imagemPost: string | null;
  vinculado: boolean;
};

/** Post da rede vinculado à peça (gravado na entrega). */
export type VinculoPost = {
  rede: string;
  id: string;
  link: string | null;
  data: string | null;
  texto: string;
  capa: string | null;
};
