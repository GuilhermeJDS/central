"use client";

import { Printer } from "lucide-react";

/** Imprime ou salva em PDF (o CSS de impressão esconde a barra lateral). */
export function BotaoImprimir() {
  return (
    <button type="button" className="cx-botao cx-botao--azul" onClick={() => window.print()}>
      <Printer size={17} strokeWidth={2.2} aria-hidden="true" /> Imprimir ou salvar PDF
    </button>
  );
}
