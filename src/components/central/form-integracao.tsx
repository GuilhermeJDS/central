"use client";

import { ExternalLink } from "lucide-react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { salvarIntegracaoAcao, type ResultadoIntegracao } from "@/acoes/conexoes";
import type { GrupoId, Provedor } from "@/lib/catalogo-integracoes";
import type { ResumoCampo } from "@/lib/config";

function Salvar() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="cx-botao cx-botao--azul" disabled={pending} aria-busy={pending}>
      {pending ? "Testando…" : "Salvar e testar"}
    </button>
  );
}

/** Formulário de uma conexão do catálogo (lib/catalogo-integracoes). Secretos nunca voltam para a tela. */
export function FormIntegracao({ grupo, provedor, resumo }: { grupo: GrupoId; provedor: Provedor; resumo?: Record<string, ResumoCampo> }) {
  const [r, enviar] = useActionState<ResultadoIntegracao, FormData>(salvarIntegracaoAcao.bind(null, grupo, provedor.id), null);
  return (
    <form action={enviar} className="cx-painel cx-integracao">
      <div className="cx-integracao-topo">
        <div>
          <p className="cx-integracao-nome">{provedor.nome}</p>
          <p className="cx-dica">{provedor.resumo}</p>
        </div>
        {provedor.ondePegar ? (
          <a href={provedor.ondePegar.link} target="_blank" rel="noreferrer" className="cx-botao cx-botao--suave">
            {provedor.ondePegar.texto} <ExternalLink size={15} aria-hidden="true" />
          </a>
        ) : null}
      </div>
      {provedor.campos.map((c) => {
        const atual = resumo?.[c.id];
        if (c.tipo === "booleano")
          return (
            <label key={c.id} className="cx-integracao-check">
              <input type="checkbox" name={c.id} defaultChecked={atual?.mostra === "true"} />
              <span>
                {c.rotulo}
                {c.dica ? <span className="cx-dica">{c.dica}</span> : null}
              </span>
            </label>
          );
        return (
          <label key={c.id} className="cx-campo">
            <span className="cx-campo-rotulo">
              {c.rotulo}
              {c.opcional ? <span className="cx-dica"> (opcional)</span> : null}
            </span>
            <input
              name={c.id}
              type={c.secreto ? "password" : c.tipo === "email" ? "email" : c.tipo === "url" ? "url" : "text"}
              defaultValue={c.secreto ? "" : (atual?.mostra ?? "")}
              placeholder={c.secreto && atual?.preenchido ? `${atual.mostra} (guardada; deixe vazio para manter)` : c.exemplo}
              autoComplete="off"
              spellCheck={false}
            />
            {c.dica ? <span className="cx-dica">{c.dica}</span> : null}
          </label>
        );
      })}
      <div className="cx-integracao-rodape">
        <Salvar />
        {r ? (
          <p role={r.ok ? "status" : "alert"} className={`cx-aviso ${r.ok ? "cx-aviso--ok" : "cx-aviso--erro"}`}>
            {r.mensagem}
          </p>
        ) : null}
      </div>
    </form>
  );
}
