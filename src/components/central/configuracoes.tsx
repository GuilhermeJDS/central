"use client";

import { ChevronDown } from "lucide-react";
import { useActionState, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

import type { ResultadoConfig } from "@/app/central/acoes-configuracoes";

/** Linha que abre para editar (o "Expansivel" do Garimpo). */
export function Expansivel({ icone, titulo, resumo, acao = "Editar", children }: { icone: ReactNode; titulo: string; resumo: string; acao?: string; children: ReactNode }) {
  return (
    <details className="cx-exp">
      <summary>
        <span className="cx-exp-icone" aria-hidden="true">
          {icone}
        </span>
        <span className="cx-exp-texto">
          <strong>{titulo}</strong>
          <span>{resumo}</span>
        </span>
        <span className="cx-exp-acao">
          {acao} <ChevronDown size={15} aria-hidden="true" />
        </span>
      </summary>
      <div className="cx-exp-corpo">{children}</div>
    </details>
  );
}

function Enviar({ children }: { children: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="cx-botao cx-botao--azul" disabled={pending}>
      {pending ? "Salvando…" : children}
    </button>
  );
}

/** Formulário com Server Action e o aviso embaixo; `limpar` zera os campos quando dá certo. */
export function FormConfig({ acao, botao, limpar, children }: { acao: (p: ResultadoConfig, f: FormData) => Promise<ResultadoConfig>; botao: string; limpar?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLFormElement>(null);
  const [r, enviar] = useActionState(async (p: ResultadoConfig, f: FormData) => {
    const res = await acao(p, f);
    if (res?.ok && limpar) ref.current?.reset();
    return res;
  }, null);
  return (
    <form ref={ref} action={enviar} className="cx-cfg-form">
      {children}
      <div className="cx-integracao-rodape">
        <Enviar>{botao}</Enviar>
        {r ? (
          <p role={r.ok ? "status" : "alert"} className={`cx-aviso ${r.ok ? "cx-aviso--ok" : "cx-aviso--erro"}`}>
            {r.mensagem}
          </p>
        ) : null}
      </div>
    </form>
  );
}

export function CampoCfg({ rotulo, dica, ...props }: { rotulo: string; dica?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="cx-campo">
      <span className="cx-campo-rotulo">{rotulo}</span>
      <input {...props} />
      {dica ? <span className="cx-dica">{dica}</span> : null}
    </label>
  );
}

export function Remover({ acao, nome }: { acao: () => Promise<void>; nome: string }) {
  const [certeza, setCerteza] = useState(false);
  return certeza ? (
    <form action={acao} className="cx-botoes">
      <button type="submit" className="cx-botao cx-botao--suave cx-cfg-perigo">
        Remover {nome}
      </button>
      <button type="button" className="cx-botao cx-botao--fantasma-escuro" onClick={() => setCerteza(false)}>
        Cancelar
      </button>
    </form>
  ) : (
    <button type="button" className="cx-botao cx-botao--fantasma-escuro" onClick={() => setCerteza(true)}>
      Remover
    </button>
  );
}
