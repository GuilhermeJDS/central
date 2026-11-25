"use client";

/**
 * Versões da peça: a lista (v3, v2, v1 com o que mudou), a principal, gerar
 * de novo e a comparação lado a lado com os slides andando juntos.
 */
import { ChevronLeft, ChevronRight, Columns2, LoaderCircle, RefreshCw, Sparkles, Star, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { reproduzirEntregaAcao } from "@/app/central/acoes-entregas";
import { tornarPrincipalAcao } from "@/app/central/acoes-estudio";
import { SlideVista } from "@/components/central/estudio/slide-vista";
import { EstadoTrabalho } from "@/components/central/trabalho-producao";
import { emProducao } from "@/lib/central/entregas-tipos";
import type { ApiVisualizador } from "@/components/central/estudio/visualizador";
import type { VersaoView } from "@/lib/central/estudio/pecas";
import { normalizarSlide, type SlideEstudio } from "@/lib/central/estudio/slide";

const fmtQuando = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function ListaVersoes({
  api,
  onComparar,
}: {
  api: Pick<ApiVisualizador, "peca" | "versao" | "trocarVersao" | "sujo">;
  onComparar?: () => void;
}) {
  const { peca, versao } = api;
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [gerando, setGerando] = useState(emProducao(peca.producao));
  const contagem = (id: string) => peca.comentarios.filter((c) => c.versaoId === id && !c.resolvido).length;

  // Enquanto a Editora Pauta gera, a tela confere a cada 4 s.
  useEffect(() => {
    if (!gerando) return;
    const t = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(t);
  }, [gerando, router]);
  const [producaoBase, setProducaoBase] = useState(peca.producao);
  if (producaoBase !== peca.producao) {
    setProducaoBase(peca.producao);
    setGerando(emProducao(peca.producao));
  }

  return (
    <section className="cx-pp-secao" aria-labelledby="cx-pp-versoes">
      <div className="cx-pp-cabeca">
        <h2 id="cx-pp-versoes" className="cx-pp-titulo">
          Versões <span className="cx-pp-titulo-conta">{peca.versoes.length}</span>
        </h2>
        {onComparar && peca.versoes.length > 1 ? (
          <button type="button" className="cx-pp-link" onClick={onComparar}>
            <Columns2 size={16} strokeWidth={1.8} aria-hidden="true" /> Comparar
          </button>
        ) : null}
      </div>
      <ol className="cx-versoes">
        {peca.versoes.map((v) => {
          const aberta = v.id === versao.id;
          const n = contagem(v.id);
          return (
            <li key={v.id} className="cx-versao" data-aberta={aberta ? "" : undefined}>
              <button
                type="button"
                className="cx-versao-abrir"
                onClick={() => api.trocarVersao(v.id)}
                aria-current={aberta ? "true" : undefined}
                aria-label={`Abrir v${v.numero}: ${v.descricao}`}
              >
                <span className="cx-versao-num">v{v.numero}</span>
                <span className="cx-versao-texto">
                  <span className="cx-versao-desc">{v.descricao}</span>
                  <span className="cx-pp-meta">
                    <span className="cx-versao-origem">
                      {v.origem === "GERACAO" ? <Sparkles size={13} strokeWidth={1.8} aria-hidden="true" /> : null}
                      {v.origem === "GERACAO" ? "Gerada" : "Editada"}
                    </span>
                    · {fmtQuando.format(new Date(v.em))}
                    {n ? ` · ${n} ${n === 1 ? "comentário" : "comentários"}` : ""}
                  </span>
                </span>
              </button>
              {v.principal ? (
                <span className="cx-versao-principal" title="Versão principal">
                  <Star size={14} strokeWidth={2} aria-hidden="true" fill="currentColor" /> Principal
                </span>
              ) : (
                <button
                  type="button"
                  className="cx-versao-tornar"
                  disabled={pendente}
                  onClick={() =>
                    iniciar(async () => {
                      setErro(null);
                      const r = await tornarPrincipalAcao(peca.id, v.id);
                      if (r.erro !== null) setErro(r.erro);
                      else router.refresh();
                    })
                  }
                >
                  Tornar principal
                </button>
              )}
            </li>
          );
        })}
      </ol>
      {peca.producao !== "PRONTA" ? <EstadoTrabalho trabalho={peca.trabalho} compacto /> : null}
      <button
        type="button"
        className="cx-botao cx-botao--suave cx-pp-largo"
        disabled={gerando || pendente || api.sujo}
        onClick={() =>
          iniciar(async () => {
            setErro(null);
            const r = await reproduzirEntregaAcao(peca.id);
            if (r.erro) setErro(r.erro);
            else {
              setGerando(true);
              router.refresh();
            }
          })
        }
      >
        {gerando ? (
          <>
            <LoaderCircle size={16} strokeWidth={1.8} className="cx-girando" aria-hidden="true" /> Gerando a v{(peca.versoes[0]?.numero ?? 0) + 1}…
          </>
        ) : (
          <>
            <RefreshCw size={16} strokeWidth={1.8} aria-hidden="true" />{" "}
            {peca.producao === "ERRO" ? "Tentar de novo" : "Gerar nova versão"}
          </>
        )}
      </button>
      {erro ? (
        <p role="alert" className="cx-aviso cx-aviso--erro">
          {erro}
        </p>
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Comparar
// ---------------------------------------------------------------------------

/** O que aparece no slide, sem depender da ordem das chaves. */
function assinatura(s: SlideEstudio | undefined): string {
  if (!s) return "";
  return JSON.stringify(
    (s.elementos ?? []).map((e) =>
      Object.keys(e)
        .filter((k) => k !== "id" && e[k as keyof typeof e] !== undefined)
        .sort()
        .map((k) => [k, e[k as keyof typeof e]]),
    ),
  );
}

function slidesDa(v: VersaoView | undefined) {
  if (!v?.conteudo) return [];
  const marca = v.conteudo.marca;
  return v.conteudo.slides.map((s, i) => normalizarSlide(s, i, marca));
}

export function Comparador({
  versoes,
  inicial,
  nomeNegocio,
  onFechar,
}: {
  versoes: VersaoView[];
  inicial: [string, string];
  nomeNegocio: string;
  onFechar: () => void;
}) {
  const [ids, setIds] = useState<[string, string]>(inicial);
  const [indice, setIndice] = useState(0);
  const lados = ids.map((id) => versoes.find((v) => v.id === id));
  const slides = lados.map(slidesDa);
  const total = Math.max(slides[0].length, slides[1].length, 1);
  const i = Math.min(indice, total - 1);
  const mudou = (n: number) => assinatura(slides[0][n]) !== assinatura(slides[1][n]);

  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      if ((e.target as HTMLElement).closest("input, textarea, select")) return;
      if (e.key === "ArrowRight") setIndice((n) => Math.min(total - 1, n + 1));
      if (e.key === "ArrowLeft") setIndice((n) => Math.max(0, n - 1));
      if (e.key === "Escape") onFechar();
    }
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [total, onFechar]);

  return (
    <section className="cx-comparar" aria-label="Comparar versões">
      <div className="cx-comparar-topo">
        <p className="cx-comparar-titulo">
          <Columns2 size={18} strokeWidth={1.8} aria-hidden="true" /> Comparando
        </p>
        <button type="button" className="cx-botao cx-botao--suave" onClick={onFechar}>
          <X size={16} strokeWidth={1.8} aria-hidden="true" /> Fechar
        </button>
      </div>
      <div className="cx-comparar-lados">
        {lados.map((v, lado) => {
          const s = slides[lado][i];
          return (
            <div key={lado} className="cx-comparar-lado">
              <label className="cx-comparar-escolha">
                <span className="cx-so-leitor">{lado === 0 ? "Versão da esquerda" : "Versão da direita"}</span>
                <select
                  className="cx-input cx-select"
                  value={ids[lado]}
                  onChange={(e) => setIds((atual) => (lado === 0 ? [e.target.value, atual[1]] : [atual[0], e.target.value]))}
                >
                  {versoes.map((x) => (
                    <option key={x.id} value={x.id}>
                      v{x.numero}
                      {x.principal ? " (principal)" : ""} · {x.descricao}
                    </option>
                  ))}
                </select>
              </label>
              <div className="cx-comparar-slide">
                {s && v?.conteudo ? (
                  <SlideVista
                    slide={s}
                    indice={i}
                    total={slides[lado].length}
                    marca={v.conteudo.marca}
                    nomeNegocio={nomeNegocio}
                    rotulo={`v${v.numero}, slide ${i + 1}`}
                  />
                ) : (
                  <p className="cx-comparar-sem">Esta versão não tem o slide {i + 1}.</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="cx-comparar-nav">
        <button type="button" className="cx-vz-seta" onClick={() => setIndice(Math.max(0, i - 1))} disabled={i === 0} aria-label="Slide anterior">
          <ChevronLeft size={22} strokeWidth={1.8} aria-hidden="true" />
        </button>
        <ol className="cx-comparar-pontos" aria-label="Slides">
          {Array.from({ length: total }, (_, n) => (
            <li key={n}>
              <button
                type="button"
                aria-current={n === i ? "true" : undefined}
                data-mudou={mudou(n) ? "" : undefined}
                onClick={() => setIndice(n)}
                aria-label={`Slide ${n + 1}${mudou(n) ? ", mudou entre as versões" : ", igual nas duas"}`}
              >
                {n + 1}
              </button>
            </li>
          ))}
        </ol>
        <button
          type="button"
          className="cx-vz-seta"
          onClick={() => setIndice(Math.min(total - 1, i + 1))}
          disabled={i >= total - 1}
          aria-label="Próximo slide"
        >
          <ChevronRight size={22} strokeWidth={1.8} aria-hidden="true" />
        </button>
      </div>
      <p className="cx-vz-posicao">
        Slide {i + 1} de {total} · {mudou(i) ? "mudou entre as versões" : "igual nas duas"}
      </p>
    </section>
  );
}
