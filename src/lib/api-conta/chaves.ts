import "server-only";

import { createHash, randomBytes } from "node:crypto";

import type { ChaveConta } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Chaves do cliente para a API da conta e o MCP. A chave é `cen_` + 32
 * bytes aleatórios; só o SHA-256 fica no banco e ela aparece uma vez, na
 * criação. Cada chave alcança só a conta que a criou.
 */

export const PREFIXO_CHAVE_CONTA = "cen_";
/** Quantas chaves ativas uma conta pode ter ao mesmo tempo. */
export const MAX_CHAVES_ATIVAS = 10;
const CACHE_TTL_MS = 30_000;

type Entrada = { chave: ChaveConta; expiraEm: number };
const cache = new Map<string, Entrada>();

export function hashChaveConta(chave: string): string {
  return createHash("sha256").update(chave, "utf8").digest("hex");
}

export function gerarChaveConta(): { chave: string; prefixo: string; hash: string } {
  const chave = `${PREFIXO_CHAVE_CONTA}${randomBytes(32).toString("base64url")}`;
  return { chave, prefixo: chave.slice(0, PREFIXO_CHAVE_CONTA.length + 6), hash: hashChaveConta(chave) };
}

/** Revogou: a chave para de valer na hora neste processo. */
export function esquecerChaveConta(id: string) {
  for (const [h, e] of cache) if (e.chave.id === id) cache.delete(h);
}

/** Lê `Authorization: Bearer cen_…` e devolve a chave ativa, ou null. */
export async function chaveContaDoCabecalho(authorization: string | null): Promise<ChaveConta | null> {
  const m = authorization?.match(/^Bearer\s+(cen_[A-Za-z0-9_-]{20,100})\s*$/);
  if (!m) return null;
  const hash = hashChaveConta(m[1]!);

  const guardada = cache.get(hash);
  if (guardada && guardada.expiraEm > Date.now()) {
    marcarUso(guardada.chave);
    return guardada.chave;
  }

  const chave = await prisma.chaveConta.findUnique({ where: { hash } });
  if (!chave || chave.revogadaEm) {
    cache.delete(hash);
    return null;
  }
  cache.set(hash, { chave, expiraEm: Date.now() + CACHE_TTL_MS });
  if (cache.size > 500) {
    const agora = Date.now();
    for (const [k, v] of cache) if (v.expiraEm < agora) cache.delete(k);
  }
  marcarUso(chave);
  return chave;
}

function marcarUso(chave: ChaveConta) {
  if (chave.ultimoUsoEm && Date.now() - chave.ultimoUsoEm.getTime() <= 60_000) return;
  chave.ultimoUsoEm = new Date();
  void prisma.chaveConta
    .update({ where: { id: chave.id }, data: { ultimoUsoEm: chave.ultimoUsoEm } })
    .catch(() => {});
}
