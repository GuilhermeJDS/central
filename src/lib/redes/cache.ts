/**
 * Cache das leituras das redes: 6 horas, na memória do servidor, por conta +
 * rede + leitura + parâmetro. Guarda só os dados normalizados (nunca token).
 */
import "server-only";

export const CACHE_REDES_MS = 6 * 60 * 60 * 1000;
const MAX_ITENS = 500;

const itens = new Map<string, { ate: number; valor: unknown }>();

export function lerCache<T>(chave: string): T | undefined {
  const i = itens.get(chave);
  if (!i) return undefined;
  if (i.ate < Date.now()) {
    itens.delete(chave);
    return undefined;
  }
  return i.valor as T;
}

export function gravarCache(chave: string, valor: unknown, ttlMs = CACHE_REDES_MS): void {
  if (itens.size >= MAX_ITENS) {
    const maisAntiga = itens.keys().next().value;
    if (maisAntiga !== undefined) itens.delete(maisAntiga);
  }
  itens.set(chave, { ate: Date.now() + ttlMs, valor });
}

/** Ao trocar ou apagar a conexão, some tudo daquela conta + rede. */
export function limparCache(prefixo: string): void {
  for (const k of itens.keys()) if (k.startsWith(prefixo)) itens.delete(k);
}
