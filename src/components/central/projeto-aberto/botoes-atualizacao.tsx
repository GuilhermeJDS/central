"use client";

import { Download, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

import {
  atualizarCentralAcao,
  instalarSkillAcao,
  logAtualizacaoAcao,
  marcarVistoAcao,
  removerSkillAcao,
  verificarAgoraAcao,
  type ResultadoAt,
} from "@/app/central/acoes-atualizacoes";

function Aviso({ r }: { r: ResultadoAt | null }) {
  if (!r) return null;
  return (
    <p role={r.ok ? "status" : "alert"} className={`cx-aviso ${r.ok ? "cx-aviso--ok" : "cx-aviso--erro"}`}>
      {r.mensagem}
    </p>
  );
}

/** Ao abrir a tela, tudo o que está nela conta como visto (zera o contador do menu). */
export function MarcarVisto() {
  useEffect(() => {
    void marcarVistoAcao();
  }, []);
  return null;
}

export function VerificarAgora() {
  const [r, setR] = useState<ResultadoAt | null>(null);
  const [p, iniciar] = useTransition();
  return (
    <div className="cx-botoes">
      <button type="button" className="cx-botao cx-botao--branco" disabled={p} onClick={() => iniciar(async () => setR(await verificarAgoraAcao()))}>
        <RefreshCw size={17} className={p ? "cx-girando" : undefined} aria-hidden="true" /> {p ? "Conferindo…" : "Verificar agora"}
      </button>
      <Aviso r={r} />
    </div>
  );
}

export function AtualizarCentral() {
  const [r, setR] = useState<ResultadoAt | null>(null);
  const [log, setLog] = useState("");
  const [p, iniciar] = useTransition();
  useEffect(() => {
    if (!r?.ok) return;
    const t = setInterval(async () => setLog(await logAtualizacaoAcao()), 2500);
    return () => clearInterval(t);
  }, [r]);
  return (
    <div className="cx-at-secao">
      <div className="cx-botoes">
        <button type="button" className="cx-botao cx-botao--azul" disabled={p || r?.ok} onClick={() => iniciar(async () => setR(await atualizarCentralAcao()))}>
          <Download size={17} aria-hidden="true" /> {p ? "Começando…" : "Atualizar agora"}
        </button>
      </div>
      <Aviso r={r} />
      {log ? <pre className="cx-at-log">{log}</pre> : null}
    </div>
  );
}

export function BotaoSkill({ slug, instalada }: { slug: string; instalada: boolean }) {
  const [r, setR] = useState<ResultadoAt | null>(null);
  const [p, iniciar] = useTransition();
  return (
    <div className="cx-botoes">
      {instalada ? (
        <button type="button" className="cx-botao cx-botao--suave" disabled={p} onClick={() => iniciar(async () => setR(await removerSkillAcao(slug)))}>
          <Trash2 size={16} aria-hidden="true" /> Remover
        </button>
      ) : (
        <button type="button" className="cx-botao cx-botao--azul" disabled={p} onClick={() => iniciar(async () => setR(await instalarSkillAcao(slug)))}>
          <Download size={16} aria-hidden="true" /> {p ? "Instalando…" : "Instalar"}
        </button>
      )}
      <Aviso r={r} />
    </div>
  );
}
