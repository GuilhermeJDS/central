"use client";

/**
 * Botão "Novo carrossel / roteiro / pauta" + diálogo. Tema livre ou uma
 * pauta pronta como ponto de partida, rede, formato e nº de slides. Gera
 * direto para "Em revisão" (sem passar pelas Decisões): o card aparece na
 * grade com o progresso do trabalho.
 */
import { Minus, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";

import { novaPecaAcao } from "@/app/central/acoes-nova-peca";
import { useTrava } from "@/components/central/trava";
import { ROTULO_REDE } from "@/lib/central/entregas-tipos";
import {
  CONFIG_NOVA,
  SLIDES_MAX,
  SLIDES_MIN,
  SLIDES_PADRAO,
  type PautaBase,
  type SecaoNova,
} from "@/lib/central/estudio/nova-peca";

export function NovaPeca({
  secao,
  redeInicial,
  pautas,
  ativo = true,
}: {
  secao: SecaoNova;
  /** Rede do filtro (ex.: "INSTAGRAM"). */
  redeInicial?: string | null;
  pautas: PautaBase[];
  ativo?: boolean;
}) {
  const cfg = CONFIG_NOVA[secao];
  const id = useId();
  const router = useRouter();
  const dialogo = useRef<HTMLDialogElement>(null);
  const [partida, setPartida] = useState<"tema" | "pauta">("tema");
  const [tema, setTema] = useState("");
  const [pautaId, setPautaId] = useState<string | null>(null);
  const [formato, setFormato] = useState(cfg.formatos[0].tipo);
  const [rede, setRede] = useState(redeInicial && cfg.redes.includes(redeInicial) ? redeInicial : cfg.redes[0]);
  const [slides, setSlides] = useState(SLIDES_PADRAO);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const { bloquear } = useTrava();

  function abrir() {
    if (bloquear() || !ativo) return;
    setErro(null);
    dialogo.current?.showModal();
  }
  function fechar() {
    dialogo.current?.close();
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    iniciar(async () => {
      const r = await novaPecaAcao({
        secao,
        formato,
        rede,
        tema,
        pautaId: partida === "pauta" ? pautaId : null,
        slides: cfg.slides ? slides : null,
      });
      if (r.erro) {
        setErro(r.erro);
        return;
      }
      setTema("");
      setPautaId(null);
      fechar();
      router.refresh();
    });
  }

  const pautasDaRede = pautas;
  const podeEnviar = partida === "pauta" ? !!pautaId : tema.trim().length >= 4;
  const threadInvalida = formato === "THREAD" && rede !== "X" && rede !== "LINKEDIN";

  return (
    <>
      <button type="button" className="cx-botao cx-botao--azul cx-nova-abrir" onClick={abrir}>
        <Plus size={18} strokeWidth={2} aria-hidden="true" />
        {cfg.rotulo}
      </button>

      <dialog
        ref={dialogo}
        className="cx-nova"
        aria-labelledby={`${id}-t`}
        onClick={(e) => {
          if (e.target === e.currentTarget) fechar();
        }}
      >
        <form className="cx-nova-corpo" onSubmit={enviar}>
          <header className="cx-nova-cabeca">
            <h2 id={`${id}-t`} className="cx-nova-titulo">
              {cfg.rotulo}
              <span className="cx-ponto">.</span>
            </h2>
            <button type="button" className="cx-nova-fechar" onClick={fechar} aria-label="Fechar">
              <X size={20} strokeWidth={1.8} aria-hidden="true" />
            </button>
          </header>
          <p className="cx-nova-sub">Sai direto para “Em revisão”, sem passar pelas Decisões.</p>

          <fieldset className="cx-nova-campo">
            <legend className="cx-campo-rotulo">Ponto de partida</legend>
            <div className="cx-nova-segmento" role="radiogroup">
              {(
                [
                  ["tema", "Tema livre"],
                  ["pauta", `De uma pauta${pautasDaRede.length ? ` (${pautasDaRede.length})` : ""}`],
                ] as const
              ).map(([v, rotulo]) => (
                <label key={v} className="cx-nova-seg">
                  <input
                    type="radio"
                    name={`${id}-partida`}
                    value={v}
                    checked={partida === v}
                    disabled={v === "pauta" && !pautasDaRede.length}
                    onChange={() => setPartida(v)}
                  />
                  <span>{rotulo}</span>
                </label>
              ))}
            </div>
            {!pautasDaRede.length ? (
              <p className="cx-nova-dica">Ainda não há pauta pronta. Aprove uma em Pautas para usar como base.</p>
            ) : null}
          </fieldset>

          {partida === "pauta" ? (
            <fieldset className="cx-nova-campo">
              <legend className="cx-campo-rotulo">Qual pauta</legend>
              <ul className="cx-nova-pautas">
                {pautasDaRede.map((p) => (
                  <li key={p.id}>
                    <label className="cx-nova-pauta">
                      <input
                        type="radio"
                        name={`${id}-pauta`}
                        value={p.id}
                        checked={pautaId === p.id}
                        onChange={() => setPautaId(p.id)}
                      />
                      <span className="cx-nova-pauta-texto">
                        <span className="cx-nova-pauta-titulo">{p.titulo}</span>
                        {p.resumo ? <span className="cx-nova-pauta-resumo">{p.resumo}</span> : null}
                      </span>
                      {p.rede ? <span className="cx-chip">{ROTULO_REDE[p.rede] ?? p.rede}</span> : null}
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
          ) : null}

          <div className="cx-nova-campo">
            <label className="cx-campo-rotulo" htmlFor={`${id}-tema`}>
              {partida === "pauta" ? "O que ajustar (opcional)" : "Tema"}
            </label>
            <textarea
              id={`${id}-tema`}
              className="cx-input cx-nova-tema"
              value={tema}
              onChange={(e) => setTema(e.target.value)}
              placeholder={partida === "pauta" ? "Ex.: mais curto, com chamada para agendar" : cfg.dicaTema}
              maxLength={600}
              rows={3}
              required={partida === "tema"}
            />
          </div>

          {cfg.formatos.length > 1 ? (
            <fieldset className="cx-nova-campo">
              <legend className="cx-campo-rotulo">Formato</legend>
              <div className="cx-opcoes">
                {cfg.formatos.map((f) => (
                  <label key={f.tipo} className="cx-opcao">
                    <input
                      type="radio"
                      name={`${id}-formato`}
                      checked={formato === f.tipo}
                      onChange={() => setFormato(f.tipo)}
                    />
                    <span>{f.rotulo}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}

          <fieldset className="cx-nova-campo">
            <legend className="cx-campo-rotulo">Rede</legend>
            <div className="cx-opcoes">
              {cfg.redes.map((r) => (
                <label key={r} className="cx-opcao">
                  <input type="radio" name={`${id}-rede`} checked={rede === r} onChange={() => setRede(r)} />
                  <span>{ROTULO_REDE[r] ?? r}</span>
                </label>
              ))}
            </div>
            {threadInvalida ? <p className="cx-nova-dica">Thread é para o X ou o LinkedIn.</p> : null}
          </fieldset>

          {cfg.slides ? (
            <div className="cx-nova-campo">
              <span className="cx-campo-rotulo" id={`${id}-slides`}>
                Número de slides
              </span>
              <div className="cx-nova-passo" role="group" aria-labelledby={`${id}-slides`}>
                <button
                  type="button"
                  className="cx-nova-passo-botao"
                  onClick={() => setSlides((n) => Math.max(SLIDES_MIN, n - 1))}
                  disabled={slides <= SLIDES_MIN}
                  aria-label="Menos um slide"
                >
                  <Minus size={18} aria-hidden="true" />
                </button>
                <output className="cx-nova-passo-valor" aria-live="polite">
                  {slides}
                </output>
                <button
                  type="button"
                  className="cx-nova-passo-botao"
                  onClick={() => setSlides((n) => Math.min(SLIDES_MAX, n + 1))}
                  disabled={slides >= SLIDES_MAX}
                  aria-label="Mais um slide"
                >
                  <Plus size={18} aria-hidden="true" />
                </button>
                <span className="cx-nova-dica">
                  de {SLIDES_MIN} a {SLIDES_MAX}
                </span>
              </div>
            </div>
          ) : null}

          {erro ? (
            <p className="cx-aviso cx-aviso--erro" role="alert">
              {erro}
            </p>
          ) : null}

          <footer className="cx-nova-rodape">
            <button type="button" className="cx-botao cx-botao--fantasma-escuro" onClick={fechar}>
              Cancelar
            </button>
            <button
              type="submit"
              className="cx-botao cx-botao--azul"
              disabled={pendente || !podeEnviar || threadInvalida}
            >
              {pendente ? "Mandando…" : `Gerar ${cfg.formatos.find((f) => f.tipo === formato)?.rotulo.toLowerCase()}`}
            </button>
          </footer>
        </form>
      </dialog>
    </>
  );
}
