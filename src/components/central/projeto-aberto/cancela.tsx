"use client";

import { useEffect, useState } from "react";

const CHAVE = "central:pedagio";
const TOTAL = 4;

/** Ainda falta pagar o pedágio? (guardado neste navegador pela página Pedágio) */
export function usePedagioPendente() {
  const [pendente, setPendente] = useState(false);
  useEffect(() => {
    const ler = () => {
      try {
        setPendente((JSON.parse(localStorage.getItem(CHAVE) ?? "[]") as string[]).length < TOTAL);
      } catch {
        setPendente(true);
      }
    };
    ler();
    window.addEventListener("storage", ler);
    window.addEventListener("central:pedagio", ler);
    return () => {
      window.removeEventListener("storage", ler);
      window.removeEventListener("central:pedagio", ler);
    };
  }, []);
  return pendente;
}

/** Cancela de pedágio que pula de tempos em tempos, como uma notificação. */
export function Cancela() {
  return (
    <span className="cx-cancela" title="Pedágio pendente" aria-label="Pedágio pendente">
      <svg viewBox="0 0 24 20" className="cx-cancela-pula" aria-hidden="true">
        <rect x="3" y="7" width="4" height="12" rx="1.5" fill="#3d4450" />
        <rect x="1.5" y="17.5" width="7" height="2.5" rx="1" fill="#3d4450" />
        <g className="cx-cancela-braco">
          <rect x="4" y="8" width="19" height="4" rx="2" fill="#fff" stroke="#c0262d" strokeWidth="0.8" />
          <path d="M8 8h3l-2 4H6zM14 8h3l-2 4h-3zM20 8h2.5v1.5L21 12h-3z" fill="#c0262d" />
        </g>
        <circle cx="5" cy="10" r="1.6" fill="#e3ad35" />
      </svg>
    </span>
  );
}
