/** Ajudas das páginas do estúdio (servidor). */
import "server-only";

import { redirect } from "next/navigation";

import { BASE_ESTUDIO, comRede, redeDoFiltro, secaoServeRede } from "@/lib/central/estudio/secoes";

export type BuscaEstudio = Promise<{ rede?: string; [k: string]: string | string[] | undefined }>;

/**
 * Lê o filtro de rede. Com `secao`, uma página que não existe naquela rede
 * (carrossel no YouTube, Insights no TikTok) manda para as Pautas da rede.
 */
export async function filtroDaBusca(searchParams: BuscaEstudio, secao?: string) {
  const sp = await searchParams;
  const filtro = redeDoFiltro(sp.rede);
  if (secao && filtro && !secaoServeRede(secao, filtro.slug)) redirect(comRede(`${BASE_ESTUDIO}/pautas`, filtro.slug));
  return { sp, filtro };
}

/** "Redes · Carrosséis · Instagram" */
export function secaoCom(nome: string, filtro: { nome: string } | null): string {
  return filtro ? `Redes · ${nome} · ${filtro.nome}` : `Redes · ${nome}`;
}
