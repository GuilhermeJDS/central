"use client";

import { MapPin, Search, Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { acharNegocioAcao, usarLugarAcao } from "@/acoes/onboarding";
import { Mascote } from "@/components/central/mascote";
import type { Lugar } from "@/lib/rastro/busca";

/** O Inspetor Rastro acha a empresa no Google Maps e preenche a ficha. */
export function AcharNoMaps({ nomeInicial }: { nomeInicial: string }) {
  const router = useRouter();
  const [nome, setNome] = useState(nomeInicial);
  const [cidade, setCidade] = useState("");
  const [lugar, setLugar] = useState<Lugar | null | undefined>(undefined);
  const [erro, setErro] = useState<string | null>(null);
  const [buscando, iniciar] = useTransition();
  const [usando, iniciarUso] = useTransition();

  function buscar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setLugar(undefined);
    iniciar(async () => {
      const r = await acharNegocioAcao(nome, cidade);
      if (!r.ok) setErro(r.mensagem);
      else setLugar(r.lugar);
    });
  }

  return (
    <section className="cx-painel cx-achar" data-chefe="rastro">
      <div className="cx-achar-topo">
        <Mascote id="rastro" tamanho={64} estado={buscando ? "working" : lugar ? "done" : "idle"} humor={lugar ? "happy" : "neutral"} />
        <div>
          <p className="cx-integracao-nome">Deixa que o Inspetor Rastro acha</p>
          <p className="cx-dica">Ele procura a sua empresa no Google Maps e já preenche nome, endereço, site e categoria.</p>
        </div>
      </div>
      <form onSubmit={buscar} className="cx-achar-form">
        <label className="cx-campo">
          <span className="cx-campo-rotulo">Nome da empresa</span>
          <input value={nome} onChange={(e) => setNome(e.target.value)} required />
        </label>
        <label className="cx-campo">
          <span className="cx-campo-rotulo">Cidade</span>
          <input value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Ex.: Campinas" required />
        </label>
        <button type="submit" className="cx-botao cx-botao--azul" disabled={buscando} aria-busy={buscando}>
          <Search size={17} aria-hidden="true" /> {buscando ? "Procurando no Maps…" : "Achar no Maps"}
        </button>
      </form>
      {erro ? (
        <p role="alert" className="cx-aviso cx-aviso--erro">
          {erro}
        </p>
      ) : null}
      {lugar === null ? <p className="cx-aviso">Não achei no Maps com esse nome. Confira a grafia ou preencha a ficha abaixo à mão.</p> : null}
      {lugar ? (
        <div className="cx-achar-lugar">
          <div>
            <p className="cx-achar-nome">{lugar.nome}</p>
            <p className="cx-dica">
              <MapPin size={14} aria-hidden="true" /> {lugar.endereco ?? "sem endereço"}
              {lugar.nota ? (
                <>
                  {" · "}
                  <Star size={14} aria-hidden="true" /> {lugar.nota.toLocaleString("pt-BR")} ({lugar.totalAvaliacoes ?? 0} avaliações)
                </>
              ) : null}
              {lugar.categoria ? ` · ${lugar.categoria}` : ""}
            </p>
          </div>
          <button
            type="button"
            className="cx-botao cx-botao--azul"
            disabled={usando}
            onClick={() =>
              iniciarUso(async () => {
                await usarLugarAcao(lugar, cidade);
                router.refresh();
              })
            }
          >
            {usando ? "Preenchendo…" : "É essa, preencher a ficha"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
