"use client";

import { useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

import type { Resultado } from "@/acoes/acesso";

/** Formulário com Server Action e o aviso do resultado logo abaixo. */
export function FormAcesso({ acao, children, className }: { acao: (prev: Resultado, f: FormData) => Promise<Resultado>; children: ReactNode; className?: string }) {
  const [r, enviar] = useActionState(acao, null);
  return (
    <form action={enviar} className={className ?? "ac-form"} noValidate>
      {children}
      {r ? (
        <p role={r.ok ? "status" : "alert"} className={`ac-aviso ${r.ok ? "ac-aviso--ok" : "ac-aviso--erro"}`}>
          {r.mensagem}
        </p>
      ) : null}
    </form>
  );
}

export function Enviar({ children, className }: { children: ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className ?? "ac-botao"} disabled={pending} aria-busy={pending}>
      {pending ? "Um instante…" : children}
    </button>
  );
}

export function Campo({ rotulo, dica, children }: { rotulo: string; dica?: string; children: ReactNode }) {
  return (
    <label className="ac-campo">
      <span className="ac-rotulo">{rotulo}</span>
      {children}
      {dica ? <span className="ac-dica">{dica}</span> : null}
    </label>
  );
}
