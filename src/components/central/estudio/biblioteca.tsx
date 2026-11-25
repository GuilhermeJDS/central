"use client";

/**
 * Biblioteca do estúdio: a grade das peças com a capa real, selo de etapa,
 * selo de versões, filtros com contagem, busca e troca de densidade.
 * Serve para Carrosséis, Reels e Vídeos, Pautas e Publicados.
 */
import { Grid2x2, Grid3x3, Layers, Search, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useSyncExternalStore, type ReactNode } from "react";

import {
  SlideVista,
  useFonteMarca,
} from "@/components/central/estudio/slide-vista";
import { ICONE_TIPO } from "@/components/central/entregas-prontas";
import { EstadoTrabalho, TentarDeNovo } from "@/components/central/trabalho-producao";
import { VigiaProducao } from "@/components/central/vigia-producao";
import { emProducao } from "@/lib/central/entregas-tipos";
import { ROTULO_REDE, ROTULO_TIPO } from "@/lib/central/entregas-tipos";
import { comRede, hrefDaPeca, slugDaRede } from "@/lib/central/estudio/secoes";
import {
  ETAPAS,
  ROTULO_ETAPA,
  type Etapa,
  type PecaView,
} from "@/lib/central/estudio/tipos";

type Densidade = "confortavel" | "compacta";
const CHAVE_DENSIDADE = "cx-estudio-densidade";

// Densidade da grade: preferência deste navegador (localStorage), lida sem efeito.
let densidadeLocal: Densidade | null = null;
const ouvintes = new Set<() => void>();
function lerDensidade(): Densidade {
  if (densidadeLocal) return densidadeLocal;
  try {
    const d = localStorage.getItem(CHAVE_DENSIDADE);
    densidadeLocal = d === "compacta" ? "compacta" : "confortavel";
  } catch {
    densidadeLocal = "confortavel";
  }
  return densidadeLocal;
}
function ouvirDensidade(f: () => void) {
  ouvintes.add(f);
  return () => ouvintes.delete(f);
}

const fmtDia = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "numeric",
});
const fmtMes = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  month: "short",
});
/** "13 nov" */
export function diaCurto(iso: string): string {
  const d = new Date(iso);
  return `${fmtDia.format(d)} ${fmtMes.format(d).replace(".", "")}`;
}

function normal(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function SeloEtapa({ etapa }: { etapa: Etapa }) {
  return (
    <span className="cx-selo-etapa" data-etapa={etapa}>
      <span className="cx-selo-ponto" aria-hidden="true" />
      {ROTULO_ETAPA[etapa]}
    </span>
  );
}

/** Capa de peça sem slides: título grande na cor da rede (ou a miniatura do post). */
export function CapaTexto({ peca }: { peca: PecaView }) {
  const Icone = ICONE_TIPO[peca.tipo];
  if (peca.imagemPost)
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={peca.imagemPost}
        alt=""
        className="cx-capa-img"
        loading="lazy"
      />
    );
  return (
    <div
      className="cx-capa-texto"
      data-rede={slugDaRede(peca.rede) ?? undefined}
    >
      <span className="cx-capa-texto-tipo">
        <Icone size={18} strokeWidth={1.8} aria-hidden="true" />
        {ROTULO_TIPO[peca.tipo]}
      </span>
      <span className="cx-capa-texto-titulo">{peca.titulo}</span>
      {peca.resumo ? (
        <span className="cx-capa-texto-resumo">{peca.resumo}</span>
      ) : null}
    </div>
  );
}

function CartaoPeca({
  peca,
  href,
  nomeNegocio,
}: {
  peca: PecaView;
  href: string;
  nomeNegocio: string;
}) {
  const rede = slugDaRede(peca.rede);
  const quando = peca.publicadaEm ?? peca.programadaPara ?? peca.em;
  const rotuloQuando = peca.publicadaEm
    ? "Publicado"
    : peca.programadaPara
      ? "Sai"
      : "Criado";
  return (
    <li className="cx-peca">
      <Link
        href={href}
        className="cx-peca-link"
        aria-label={`${peca.titulo}: ${ROTULO_ETAPA[peca.etapa]}`}
      >
        {/* Mais de uma versão: as outras aparecem atrás, como uma pilha. */}
        <div
          className="cx-peca-pilha"
          data-pilha={
            peca.versoes > 2 ? "3" : peca.versoes > 1 ? "2" : undefined
          }
        >
          <div
            className="cx-peca-capa"
            data-formato={peca.capa?.marca.formato ?? "4x5"}
          >
            {emProducao(peca.producao) || peca.producao === "ERRO" ? (
              <div className="cx-capa-produzindo" data-status={peca.producao}>
                <EstadoTrabalho trabalho={peca.trabalho} />
              </div>
            ) : peca.capa ? (
              <SlideVista
                slide={peca.capa.slide}
                indice={0}
                total={peca.capa.total}
                marca={peca.capa.marca}
                nomeNegocio={nomeNegocio}
              />
            ) : (
              <CapaTexto peca={peca} />
            )}
            <div className="cx-peca-selos">
              <SeloEtapa etapa={peca.etapa} />
              {peca.versoes > 0 ? (
                <span className="cx-selo-versoes">
                  <Layers size={13} strokeWidth={2} aria-hidden="true" />
                  {peca.versoes}
                  <span className="cx-selo-versoes-rotulo">
                    {" "}
                    {peca.versoes === 1 ? "versão" : "versões"}
                  </span>
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <div className="cx-peca-texto">
          <span className="cx-peca-titulo">{peca.titulo}</span>
          <span className="cx-peca-meta" data-rede={rede ?? undefined}>
            {rede ? (
              <span className="cx-rede-ponto" aria-hidden="true" />
            ) : null}
            {peca.rede
              ? (ROTULO_REDE[peca.rede] ?? peca.rede)
              : ROTULO_TIPO[peca.tipo]}
            <span aria-hidden="true">·</span>
            <span>
              {rotuloQuando} {diaCurto(quando)}
            </span>
          </span>
        </div>
      </Link>
      {peca.producao === "ERRO" ? (
        <div className="cx-peca-tentar">
          <TentarDeNovo id={peca.id} />
        </div>
      ) : null}
    </li>
  );
}

/** Carrega as fontes usadas pelas capas (uma vez por fonte). */
function FontesDasCapas({ pecas }: { pecas: PecaView[] }) {
  const fontes = [
    ...new Set(pecas.flatMap((p) => (p.capa ? [p.capa.marca.fonte] : []))),
  ];
  return (
    <>
      {fontes.map((f) => (
        <Fonte key={f} fonte={f} />
      ))}
    </>
  );
}
function Fonte({
  fonte,
}: {
  fonte: NonNullable<PecaView["capa"]>["marca"]["fonte"];
}) {
  useFonteMarca(fonte);
  return null;
}

export function BibliotecaPecas({
  pecas,
  base,
  rede,
  nomeNegocio,
  vazio,
  rotuloBusca = "Buscar pelo título",
  semEtapas = false,
}: {
  pecas: PecaView[];
  /** Página da peça: `${base}/${id}`; sem base, a página do tipo de cada peça. */
  base?: string;
  rede: string | null;
  nomeNegocio: string;
  /** O que mostrar quando não há nenhuma peça. */
  vazio: ReactNode;
  rotuloBusca?: string;
  /** Publicados: tudo já está na mesma etapa, os filtros somem. */
  semEtapas?: boolean;
}) {
  const [etapa, setEtapa] = useState<Etapa | null>(null);
  const [busca, setBusca] = useState("");
  const densidade = useSyncExternalStore(
    ouvirDensidade,
    lerDensidade,
    () => "confortavel" as Densidade,
  );
  function mudarDensidade(d: Densidade) {
    try {
      localStorage.setItem(CHAVE_DENSIDADE, d);
    } catch {
      /* sem armazenamento: vale só nesta tela */
    }
    densidadeLocal = d;
    ouvintes.forEach((f) => f());
  }

  const contagem = useMemo(() => {
    const c = Object.fromEntries(ETAPAS.map((e) => [e, 0])) as Record<
      Etapa,
      number
    >;
    for (const p of pecas) c[p.etapa]++;
    return c;
  }, [pecas]);

  const termo = normal(busca.trim());
  const visiveis = pecas.filter(
    (p) =>
      (!etapa || p.etapa === etapa) &&
      (!termo || normal(`${p.titulo} ${p.resumo}`).includes(termo)),
  );

  if (!pecas.length) return <div className="cx-biblioteca-vazia">{vazio}</div>;

  return (
    <section
      className="cx-biblioteca"
      data-densidade={densidade}
      aria-label="Biblioteca"
    >
      <FontesDasCapas pecas={pecas} />
      {pecas.some((p) => emProducao(p.producao)) ? (
        <VigiaProducao ids={pecas.filter((p) => emProducao(p.producao)).map((p) => p.id)} />
      ) : null}
      <div className="cx-biblioteca-barra">
        {semEtapas ? (
          <p className="cx-biblioteca-total">
            <strong>{pecas.length}</strong>{" "}
            {pecas.length === 1 ? "peça" : "peças"}
          </p>
        ) : (
          <div
            className="cx-filtros"
            role="group"
            aria-label="Filtrar por etapa"
          >
            <button
              type="button"
              className="cx-filtro"
              aria-pressed={!etapa}
              onClick={() => setEtapa(null)}
            >
              Todas <span className="cx-filtro-conta">{pecas.length}</span>
            </button>
            {ETAPAS.map((e) => (
              <button
                key={e}
                type="button"
                className="cx-filtro"
                data-etapa={e}
                aria-pressed={etapa === e}
                onClick={() => setEtapa(etapa === e ? null : e)}
                disabled={!contagem[e] && etapa !== e}
              >
                {ROTULO_ETAPA[e]}{" "}
                <span className="cx-filtro-conta">{contagem[e]}</span>
              </button>
            ))}
          </div>
        )}
        <div className="cx-biblioteca-ferramentas">
          <label className="cx-busca">
            <Search size={18} strokeWidth={1.8} aria-hidden="true" />
            <span className="cx-so-leitor">{rotuloBusca}</span>
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder={rotuloBusca}
              autoComplete="off"
            />
          </label>
          <div
            className="cx-densidade"
            role="group"
            aria-label="Tamanho da grade"
          >
            <button
              type="button"
              aria-pressed={densidade === "confortavel"}
              onClick={() => mudarDensidade("confortavel")}
              title="Capas grandes"
            >
              <Grid2x2 size={18} strokeWidth={1.8} aria-hidden="true" />
              <span className="cx-so-leitor">Capas grandes</span>
            </button>
            <button
              type="button"
              aria-pressed={densidade === "compacta"}
              onClick={() => mudarDensidade("compacta")}
              title="Capas pequenas"
            >
              <Grid3x3 size={18} strokeWidth={1.8} aria-hidden="true" />
              <span className="cx-so-leitor">Capas pequenas</span>
            </button>
          </div>
        </div>
      </div>

      {visiveis.length ? (
        <ul className="cx-pecas">
          {visiveis.map((p) => (
            <CartaoPeca
              key={p.id}
              peca={p}
              href={
                base ? comRede(`${base}/${p.id}`, rede) : hrefDaPeca(p, rede)
              }
              nomeNegocio={nomeNegocio}
            />
          ))}
        </ul>
      ) : (
        <div className="cx-biblioteca-nada" role="status">
          <p>
            Nada {etapa ? `em “${ROTULO_ETAPA[etapa]}”` : ""}
            {termo ? ` com “${busca.trim()}”` : ""}.
          </p>
          <button
            type="button"
            className="cx-botao cx-botao--suave"
            onClick={() => {
              setEtapa(null);
              setBusca("");
            }}
          >
            <X size={16} strokeWidth={1.8} aria-hidden="true" /> Limpar filtros
          </button>
        </div>
      )}
    </section>
  );
}
