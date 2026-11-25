"use client";

/**
 * Contador de decisões pendentes compartilhado no cliente. A pilha decide sem
 * recarregar a página (para manter o "3 de 7" e o Voltar), então o selo da
 * barra lateral anda junto por aqui: valor do servidor + o que a pilha já
 * decidiu. Quando o servidor manda outro número, a conta recomeça dele.
 */
import { useEffect, useSyncExternalStore } from "react";

type Estado = { base: number | null; delta: number };
let estado: Estado = { base: null, delta: 0 };
const ouvintes = new Set<() => void>();

function emitir(novo: Estado) {
  estado = novo;
  ouvintes.forEach((f) => f());
}

function ouvir(f: () => void) {
  ouvintes.add(f);
  return () => ouvintes.delete(f);
}

/** A pilha decidiu (-1) ou desfez (+1). */
export function mudarPendentes(n: number) {
  emitir({ ...estado, delta: estado.delta + n });
}

/** Pendentes agora: o número do servidor ajustado pelo que já foi decidido aqui. */
export function usePendentes(servidor: number): number {
  const s = useSyncExternalStore(
    ouvir,
    () => estado,
    () => estado,
  );
  useEffect(() => {
    if (estado.base !== servidor) emitir({ base: servidor, delta: 0 });
  }, [servidor]);
  return Math.max(0, servidor + (s.base === servidor ? s.delta : 0));
}
