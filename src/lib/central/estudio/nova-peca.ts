/**
 * "Novo" em cada biblioteca do estúdio (módulo puro: vai para a tela).
 * Que peça sai, em que redes e com que opções.
 */
import type { TipoEntrega } from "@/lib/central/entregas-tipos";

export type SecaoNova = "carrosseis" | "videos" | "pautas";

export type ConfigNova = {
  rotulo: string;
  /** Formatos possíveis (o primeiro é o padrão). */
  formatos: { tipo: TipoEntrega; rotulo: string }[];
  redes: string[];
  slides: boolean;
  dicaTema: string;
};

export const SLIDES_MIN = 3;
export const SLIDES_MAX = 12;
export const SLIDES_PADRAO = 7;

export const CONFIG_NOVA: Record<SecaoNova, ConfigNova> = {
  carrosseis: {
    rotulo: "Novo carrossel",
    formatos: [{ tipo: "CARROSSEL", rotulo: "Carrossel" }],
    redes: ["INSTAGRAM", "LINKEDIN", "TIKTOK"],
    slides: true,
    dicaTema: "Ex.: 5 sinais de que a pele precisa de hidratação",
  },
  videos: {
    rotulo: "Novo roteiro",
    formatos: [{ tipo: "ROTEIRO", rotulo: "Roteiro" }],
    redes: ["INSTAGRAM", "YOUTUBE", "TIKTOK"],
    slides: false,
    dicaTema: "Ex.: antes e depois de uma limpeza de pele, em 30 segundos",
  },
  pautas: {
    rotulo: "Nova pauta",
    formatos: [
      { tipo: "POST", rotulo: "Post" },
      { tipo: "THREAD", rotulo: "Thread" },
    ],
    redes: ["INSTAGRAM", "LINKEDIN", "X", "TIKTOK"],
    slides: false,
    dicaTema: "Ex.: por que o retorno a cada 21 dias faz diferença",
  },
};

/** Pauta pronta que pode servir de ponto de partida. */
export type PautaBase = { id: string; titulo: string; resumo: string; rede: string | null };
