"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

/** Botão "Copiar" com confirmação curta (o texto vai sem as marcas de markdown). */
export function CopiarTexto({ texto, rotulo = "Copiar mensagem" }: { texto: string; rotulo?: string }) {
  const [ok, setOk] = useState(false);
  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto.replace(/\*\*|__|`/g, ""));
      setOk(true);
      setTimeout(() => setOk(false), 1800);
    } catch {
      setOk(false);
    }
  }
  return (
    <button type="button" className="cx-botao cx-botao--suave cx-copiar" onClick={copiar} aria-live="polite">
      {ok ? <Check size={17} strokeWidth={2} aria-hidden="true" /> : <Copy size={17} strokeWidth={1.8} aria-hidden="true" />}
      {ok ? "Copiado" : rotulo}
    </button>
  );
}
