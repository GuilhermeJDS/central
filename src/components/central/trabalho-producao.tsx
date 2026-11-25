"use client";

/**
 * O trabalho de produção de uma peça: na fila → produzindo (etapa por etapa)
 * → pronto, ou erro com o motivo e "Tentar de novo".
 */
import { AlertCircle, Clock, LoaderCircle, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { reproduzirEntregaAcao } from "@/app/central/acoes-entregas";
import { useTrava } from "@/components/central/trava";
import {
  ETAPAS_PRODUCAO,
  ROTULO_ETAPA_PRODUCAO,
  ROTULO_STATUS_TRABALHO,
  type TrabalhoView,
} from "@/lib/central/entregas-tipos";

function useSegundos(inicio: string | null, ativo: boolean): number | null {
  const [agora, setAgora] = useState<number | null>(null);
  useEffect(() => {
    if (!ativo) return;
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [ativo]);
  if (!inicio || agora === null) return null;
  return Math.max(0, Math.round((agora - new Date(inicio).getTime()) / 1000));
}

function fmtTempo(s: number): string {
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")} s`;
}

/** Estado visual do trabalho (sem botões: pode ficar dentro de um link). */
export function EstadoTrabalho({ trabalho, compacto }: { trabalho: TrabalhoView; compacto?: boolean }) {
  const ativo = trabalho.status === "NA_FILA" || trabalho.status === "PRODUZINDO";
  const segundos = useSegundos(trabalho.inicio, ativo);
  if (trabalho.status === "ERRO")
    return (
      <div className="cx-trabalho" data-status="ERRO" role="status">
        <span className="cx-trabalho-status">
          <AlertCircle size={18} strokeWidth={1.8} aria-hidden="true" /> Não saiu
        </span>
        {trabalho.erro ? <span className="cx-trabalho-motivo">{trabalho.erro}</span> : null}
      </div>
    );
  if (!ativo) return null;
  const atual = trabalho.etapa ? ETAPAS_PRODUCAO.indexOf(trabalho.etapa) : -1;
  return (
    <div className="cx-trabalho" data-status={trabalho.status} data-compacto={compacto ? "" : undefined} role="status">
      <span className="cx-trabalho-status">
        {trabalho.status === "NA_FILA" ? (
          <Clock size={18} strokeWidth={1.8} aria-hidden="true" />
        ) : (
          <LoaderCircle size={18} strokeWidth={1.8} className="cx-girando" aria-hidden="true" />
        )}
        {ROTULO_STATUS_TRABALHO[trabalho.status]}
        {segundos !== null ? <span className="cx-trabalho-tempo">{fmtTempo(segundos)}</span> : null}
      </span>
      <ol className="cx-trabalho-etapas" aria-label="Etapas">
        {ETAPAS_PRODUCAO.map((e, i) => (
          <li
            key={e}
            data-feita={i < atual ? "" : undefined}
            data-atual={i === atual ? "" : undefined}
            aria-current={i === atual ? "step" : undefined}
          >
            <span className="cx-so-leitor">
              {ROTULO_ETAPA_PRODUCAO[e]}
              {i < atual ? " (feita)" : i === atual ? " (agora)" : ""}
            </span>
          </li>
        ))}
      </ol>
      <span className="cx-trabalho-etapa">
        {trabalho.etapa ? ROTULO_ETAPA_PRODUCAO[trabalho.etapa] : "Esperando a vez"}
        {trabalho.etapa ? ` · ${atual + 1} de ${ETAPAS_PRODUCAO.length}` : ""}
      </span>
    </div>
  );
}

/** "Tentar de novo" para um trabalho com erro. */
export function TentarDeNovo({ id, classe = "cx-botao cx-botao--suave" }: { id: string; classe?: string }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const { bloquear } = useTrava();
  return (
    <span className="cx-tentar">
      <button
        type="button"
        className={classe}
        disabled={pendente}
        onClick={() =>
          !bloquear() &&
          iniciar(async () => {
            setErro(null);
            const r = await reproduzirEntregaAcao(id);
            if (r.erro) setErro(r.erro);
            router.refresh();
          })
        }
      >
        <RotateCcw size={16} strokeWidth={1.8} aria-hidden="true" />
        {pendente ? "Mandando…" : "Tentar de novo"}
      </button>
      {erro ? (
        <span className="cx-aviso cx-aviso--erro" role="alert">
          {erro}
        </span>
      ) : null}
    </span>
  );
}
