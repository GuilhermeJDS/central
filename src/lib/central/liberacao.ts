/**
 * Liberação dos chefes. Na versão aberta não existe plano: tudo é liberado.
 * A única trava é a chave de IA da própria pessoa (Conexões → Chave de IA).
 */
import "server-only";

import { temChaveConectada } from "@/lib/ia/credencial";

export async function centralLiberada(_accountId: string): Promise<boolean> {
  return true;
}

/** Sem teto de gasto: quem paga a IA é a chave da própria pessoa. */
export async function limiteMensalChefesUsd(_accountId: string): Promise<number | null> {
  return null;
}

export async function podeGerarChefes(accountId: string, _opts?: { liberado: boolean }): Promise<boolean> {
  return temChaveConectada(accountId);
}

export type PlanoChefes = { id: string; nome: string; descricao: string; preco: number; precoOriginal: number };

export async function planosQueLiberamChefes(): Promise<PlanoChefes[]> {
  return [];
}
