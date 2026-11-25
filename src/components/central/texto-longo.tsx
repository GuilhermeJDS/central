"use client";

/**
 * Texto longo dentro de um card (entrega, decisão, contrato, proposta,
 * resultado de skill): mostra o título e 3–4 linhas com degradê; "Ver tudo"
 * abre o texto inteiro num painel lateral na própria página, com Copiar,
 * Aprovar (quando há o que aprovar) e Fechar. Nunca sai da página.
 *
 * Painel = <dialog> modal: foco preso, Esc fecha, o resto da página fica inerte.
 */
import { Check, Copy, Maximize2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useLayoutEffect, useRef, useState, useTransition, type ReactNode } from "react";

import { decidirAcao } from "@/app/central/acoes-decisoes";
import { RetratoChefe, idDoRetrato } from "@/components/central/chefe";
import { Resultado } from "@/components/central/resultado";

type Props = {
  titulo: string;
  texto: string;
  /** Quem fez: retrato e nome no topo do painel. */
  chefe?: string;
  /** Linha pequena acima do título (tipo, data, estado). */
  meta?: ReactNode;
  /** Execução PENDENTE que o "Aprovar" decide; sem ela, não há Aprovar. */
  aprovarId?: string | null;
  /** Exemplo (sem conta): Aprovar só marca na tela. */
  exemplo?: boolean;
  /** Linhas visíveis no card. */
  linhas?: 3 | 4 | 6;
  /** Botões extras do card (ao lado de "Ver tudo"). */
  acoes?: ReactNode;
  /** Título como h3 (padrão) ou h2. */
  nivel?: 2 | 3;
  /** Só o botão "Ver tudo" (o card já mostra o resumo do seu jeito). */
  soBotao?: boolean;
  /** Texto do botão (padrão "Ver tudo"). */
  rotuloVer?: string;
  className?: string;
};

const semMarcas = (t: string) => t.replace(/\*\*|__|`/g, "");

export function TextoLongo({
  titulo,
  texto,
  chefe,
  meta,
  aprovarId,
  exemplo = false,
  linhas = 4,
  acoes,
  nivel = 3,
  soBotao = false,
  rotuloVer = "Ver tudo",
  className,
}: Props) {
  const router = useRouter();
  const painel = useRef<HTMLDialogElement>(null);
  const previa = useRef<HTMLDivElement>(null);
  const idTitulo = useId();
  const [medido, setCortado] = useState(true);
  const cortado = soBotao || medido;
  const [aberto, setAberto] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [aprovado, setAprovado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aprovando, iniciar] = useTransition();
  const Titulo = nivel === 2 ? "h2" : "h3";

  // Só mostra o degradê e o "Ver tudo" quando o texto passa do corte.
  useLayoutEffect(() => {
    const el = previa.current;
    if (!el) return;
    const medir = () => setCortado(el.scrollHeight > el.clientHeight + 2);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [texto]);

  useEffect(() => {
    const d = painel.current;
    if (!d) return;
    if (aberto && !d.open) d.showModal();
    if (!aberto && d.open) d.close();
  }, [aberto]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(semMarcas(texto));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      setErro("Não deu para copiar. Selecione o texto e copie.");
    }
  }

  function aprovar() {
    if (!aprovarId) return;
    setErro(null);
    if (exemplo) {
      setAprovado(true);
      return;
    }
    iniciar(async () => {
      const r = await decidirAcao(aprovarId, "APROVADA");
      if (r.erro) {
        setErro(r.erro);
        return;
      }
      setAprovado(true);
      router.refresh();
    });
  }

  const botaoCopiar = (
    <button type="button" className="cx-botao cx-botao--suave" onClick={copiar} aria-live="polite">
      {copiado ? <Check size={17} strokeWidth={2} aria-hidden="true" /> : <Copy size={17} strokeWidth={1.8} aria-hidden="true" />}
      {copiado ? "Copiado" : "Copiar"}
    </button>
  );
  const botaoAprovar = aprovarId ? (
    <button type="button" className="cx-botao cx-botao--azul" onClick={aprovar} disabled={aprovado || aprovando}>
      <Check size={17} strokeWidth={2} aria-hidden="true" />
      {aprovado ? "Aprovado" : aprovando ? "Aprovando…" : "Aprovar"}
    </button>
  ) : null;

  return (
    <article className={className ? `cx-tx ${className}` : "cx-tx"} data-chefe={chefe ? idDoRetrato(chefe) : undefined}>
      {soBotao ? null : (
        <>
          {meta ? <p className="cx-tx-meta">{meta}</p> : null}
          <Titulo className="cx-tx-titulo">{titulo}</Titulo>
          <div ref={previa} className="cx-tx-previa" data-linhas={linhas} data-cortado={cortado ? "true" : "false"}>
            <Resultado texto={texto} compacto />
          </div>
        </>
      )}
      <div className="cx-tx-acoes">
        {cortado ? (
          <button type="button" className="cx-botao cx-botao--suave" onClick={() => setAberto(true)} aria-haspopup="dialog">
            <Maximize2 size={16} strokeWidth={1.8} aria-hidden="true" />
            {rotuloVer}
          </button>
        ) : null}
        {botaoAprovar}
        {acoes ??
          (soBotao ? null : (
            <button
              type="button"
              className="cx-botao cx-botao--suave cx-tx-copiar"
              onClick={copiar}
              aria-label={copiado ? "Copiado" : `Copiar: ${titulo}`}
              title={copiado ? "Copiado" : "Copiar"}
            >
              {copiado ? <Check size={17} strokeWidth={2} aria-hidden="true" /> : <Copy size={17} strokeWidth={1.8} aria-hidden="true" />}
            </button>
          ))}
      </div>
      {erro && !aberto ? (
        <p className="cx-aviso cx-aviso--erro" role="status">
          {erro}
        </p>
      ) : null}

      <dialog
        ref={painel}
        className="cx-ver-painel"
        aria-labelledby={idTitulo}
        onClose={() => setAberto(false)}
        onClick={(e) => {
          // Clique no fundo escurecido (fora da folha) fecha.
          if (e.target === e.currentTarget) setAberto(false);
        }}
      >
        {aberto ? (
          <div className="cx-ver-folha">
            <header className="cx-ver-topo">
              {chefe ? (
                <span className="cx-ver-quem">
                  <span className="cx-ver-retrato" aria-hidden="true">
                    <RetratoChefe nome={chefe} tamanho={52} />
                  </span>
                  <span className="cx-ver-chefe">{chefe}</span>
                </span>
              ) : (
                <span />
              )}
              <button type="button" className="cx-ver-fechar" onClick={() => setAberto(false)} aria-label="Fechar">
                <X size={20} strokeWidth={1.8} aria-hidden="true" />
              </button>
            </header>
            <div className="cx-ver-rolagem">
              {meta ? <p className="cx-tx-meta">{meta}</p> : null}
              <h2 id={idTitulo} className="cx-ver-titulo">
                {titulo}
              </h2>
              <Resultado texto={texto} />
            </div>
            <footer className="cx-ver-rodape">
              {erro ? (
                <p className="cx-aviso cx-aviso--erro" role="status">
                  {erro}
                </p>
              ) : null}
              <div className="cx-ver-botoes">
                {botaoAprovar}
                {botaoCopiar}
                <button type="button" className="cx-botao cx-botao--fantasma-escuro" onClick={() => setAberto(false)}>
                  Fechar
                </button>
              </div>
            </footer>
          </div>
        ) : null}
      </dialog>
    </article>
  );
}
