"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { salvarNumerosAcao, type ResultadoNumeros } from "@/app/central/acoes-numeros";

export type NumerosMesView = {
  mes: string;
  receita: string;
  atendimentos: number;
  cancelados: number;
  faltas: number;
  clientesAtivos: number;
  clientesNovos: number;
  clientesSumidos: number;
};

const CAMPOS: Array<{ id: keyof NumerosMesView; rotulo: string; dica?: string }> = [
  { id: "receita", rotulo: "Faturamento (R$)", dica: "Tudo o que entrou no mês." },
  { id: "atendimentos", rotulo: "Vendas ou atendimentos" },
  { id: "cancelados", rotulo: "Cancelados" },
  { id: "faltas", rotulo: "Faltas", dica: "Marcou e não veio. 0 se não se aplica." },
  { id: "clientesAtivos", rotulo: "Clientes que compraram" },
  { id: "clientesNovos", rotulo: "Clientes novos" },
  { id: "clientesSumidos", rotulo: "Clientes sumidos", dica: "Sem voltar há mais de 60 dias." },
];

function Salvar() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="cx-botao cx-botao--azul" disabled={pending}>
      {pending ? "Salvando…" : "Salvar os números"}
    </button>
  );
}

/** Formulário dos números do mês (Operação). Quem tem agente manda pela API. */
export function NumerosMes({ inicial }: { inicial: NumerosMesView }) {
  const [r, enviar] = useActionState<ResultadoNumeros, FormData>(salvarNumerosAcao, null);
  return (
    <form action={enviar} className="cx-painel cx-integracao" data-chefe="rotina">
      <div>
        <p className="cx-integracao-nome">Números do mês</p>
        <p className="cx-dica">O Gerente Rotina lê daqui. Leva um minuto; o seu agente também pode mandar pela API (escopo Números).</p>
      </div>
      <div className="cx-numeros-mes">
        <label className="cx-campo">
          <span className="cx-campo-rotulo">Mês</span>
          <input type="month" name="mes" defaultValue={inicial.mes} required />
        </label>
        {CAMPOS.map((c) => (
          <label key={c.id} className="cx-campo">
            <span className="cx-campo-rotulo">{c.rotulo}</span>
            <input name={c.id} inputMode={c.id === "receita" ? "decimal" : "numeric"} defaultValue={String(inicial[c.id] ?? "")} />
            {c.dica ? <span className="cx-dica">{c.dica}</span> : null}
          </label>
        ))}
      </div>
      <div className="cx-integracao-rodape">
        <Salvar />
        {r ? <p role={r.ok ? "status" : "alert"} className={`cx-aviso ${r.ok ? "cx-aviso--ok" : "cx-aviso--erro"}`}>{r.mensagem}</p> : null}
      </div>
    </form>
  );
}
