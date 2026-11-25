"use client";

import { Moon, Sun } from "lucide-react";
import { useState, useTransition } from "react";

import { salvarTemaCentral } from "@/app/central/acoes-tema";

type Tema = "claro" | "escuro";

/** Alterna o tema da Central na hora (data-tema na raiz) e salva no usuário. */
export function TemaBotao({ inicial }: { inicial: Tema }) {
  const [tema, setTema] = useState<Tema>(inicial);
  const [, iniciar] = useTransition();
  const proximo: Tema = tema === "escuro" ? "claro" : "escuro";

  function aplicar(t: Tema) {
    document.querySelector<HTMLElement>(".central.cx")?.setAttribute("data-tema", t);
  }

  return (
    <button
      type="button"
      className="cx-tema-botao"
      aria-label={proximo === "escuro" ? "Usar tema escuro" : "Usar tema claro"}
      title={proximo === "escuro" ? "Tema escuro" : "Tema claro"}
      onClick={() => {
        setTema(proximo);
        aplicar(proximo);
        iniciar(async () => {
          const r = await salvarTemaCentral(proximo).catch(() => ({ ok: false }));
          if (!r.ok) {
            setTema(tema);
            aplicar(tema);
          }
        });
      }}
    >
      {tema === "escuro" ? <Sun size={18} strokeWidth={1.8} aria-hidden="true" /> : <Moon size={18} strokeWidth={1.8} aria-hidden="true" />}
    </button>
  );
}
