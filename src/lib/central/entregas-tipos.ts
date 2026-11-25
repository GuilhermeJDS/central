/**
 * Tipos das entregas da Central (módulo puro: vai para a tela também).
 */
import { semIdDeSkill } from "@/lib/central/nome-acao";

export type TipoEntrega = "CARROSSEL" | "ROTEIRO" | "POST" | "THREAD" | "TITULO" | "THUMBNAIL" | "TEXTO";

export type StatusEntrega = "NA_FILA" | "PRODUZINDO" | "PRONTA" | "ERRO";

/** Etapas do trabalho de produção, em ordem (a tela mostra o progresso). */
export const ETAPAS_PRODUCAO = ["LENDO", "ESCREVENDO", "MONTANDO", "SALVANDO"] as const;
export type EtapaProducao = (typeof ETAPAS_PRODUCAO)[number];

export const ROTULO_ETAPA_PRODUCAO: Record<EtapaProducao, string> = {
  LENDO: "Lendo o pedido",
  ESCREVENDO: "Escrevendo a peça",
  MONTANDO: "Montando",
  SALVANDO: "Salvando a versão",
};

export const ROTULO_STATUS_TRABALHO: Record<StatusEntrega, string> = {
  NA_FILA: "Na fila",
  PRODUZINDO: "Produzindo",
  PRONTA: "Pronto",
  ERRO: "Erro",
};

/** O trabalho de produção da peça, como a tela vê. */
export type TrabalhoView = {
  status: StatusEntrega;
  etapa: EtapaProducao | null;
  /** ISO do início (fila). */
  inicio: string | null;
  erro: string | null;
};

export function emProducao(s: StatusEntrega): boolean {
  return s === "NA_FILA" || s === "PRODUZINDO";
}

export function trabalhoDe(e: {
  status: string;
  producaoEtapa: string | null;
  producaoInicio: Date | null;
  erro: string | null;
}): TrabalhoView {
  const etapa = (ETAPAS_PRODUCAO as readonly string[]).includes(e.producaoEtapa ?? "")
    ? (e.producaoEtapa as EtapaProducao)
    : null;
  return { status: e.status as StatusEntrega, etapa, inicio: e.producaoInicio?.toISOString() ?? null, erro: e.erro ? semIdDeSkill(e.erro) : null };
}

export const ROTULO_TIPO: Record<TipoEntrega, string> = {
  CARROSSEL: "Carrossel",
  ROTEIRO: "Roteiro",
  POST: "Post",
  THREAD: "Thread",
  TITULO: "Títulos",
  THUMBNAIL: "Thumbnail",
  TEXTO: "Texto pronto",
};

export const ROTULO_REDE: Record<string, string> = {
  INSTAGRAM: "Instagram",
  YOUTUBE: "YouTube",
  X: "X",
  LINKEDIN: "LinkedIn",
  TIKTOK: "TikTok",
};

export type SlideCarrossel = {
  id: string;
  titulo: string;
  texto: string;
  /** URL da imagem escolhida (upload); null = só a sugestão. */
  imagem: string | null;
  /** O que a foto deve mostrar (sugestão do chefe). */
  imagemDica: string;
};

/** Ligação entre departamentos: o insumo que veio de outro chefe. */
export type FonteEntrega = { chefe: string; titulo: string };

export type EntregaChefeView = {
  id: string;
  tipo: TipoEntrega;
  rede: string | null;
  chefe: string;
  titulo: string;
  status: StatusEntrega;
  erro: string | null;
  trabalho: TrabalhoView;
  /** Começo do texto (ou nº de slides do carrossel). */
  resumo: string;
  /** Texto inteiro (não vem no carrossel): o "Ver tudo" abre na própria página. */
  texto?: string;
  em: string;
  fontes: FonteEntrega[];
  /** A execução aprovada que originou a peça (para o "Próximo passo"). */
  origemId?: string;
  cadeia?: Array<{ chefe: string; rotulo: string; quem: string }>;
  proxima?: { chefe: string; rotulo: string } | null;
};
