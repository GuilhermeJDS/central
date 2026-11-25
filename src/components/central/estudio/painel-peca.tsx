"use client";

/**
 * Painel lateral da peça aberta no estúdio: etapa, título, descrição e data;
 * legenda com contagem e Copiar; exportar PNG/PDF; o post vinculado com os
 * números; versões; e, no modo Comentar, a lista dos comentários.
 */
import { Check, Copy, Download, FileDown, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { mudarEtapaAcao, salvarDetalhesAcao } from "@/app/central/acoes-estudio";
import { PostVinculado } from "@/components/central/estudio/post-vinculado";
import { ListaVersoes } from "@/components/central/estudio/versoes";
import type { ApiVisualizador } from "@/components/central/estudio/visualizador";
import { exportarPdf, exportarPng } from "@/lib/central/estudio/desenho";
import { MandarBuffer } from "@/components/central/estudio/mandar-buffer";
import type { PecaDetalhe } from "@/lib/central/estudio/pecas";
import { ETAPAS, ROTULO_ETAPA, type Etapa } from "@/lib/central/estudio/tipos";

const fmtData = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "numeric", month: "long" });

/** Limite de caracteres da legenda em cada rede. */
export const LIMITE_LEGENDA: Record<string, number> = {
  INSTAGRAM: 2200,
  TIKTOK: 2200,
  LINKEDIN: 3000,
  X: 280,
  YOUTUBE: 5000,
};

export function DetalhesPeca({ peca }: { peca: PecaDetalhe }) {
  const router = useRouter();
  const [titulo, setTitulo] = useState(peca.titulo);
  const [descricao, setDescricao] = useState(peca.descricao);
  const [etapa, setEtapa] = useState<Etapa>(peca.etapa);
  const [erro, setErro] = useState<string | null>(null);
  const [, iniciar] = useTransition();

  function salvar(dados: { titulo?: string; descricao?: string }) {
    iniciar(async () => {
      const r = await salvarDetalhesAcao(peca.id, dados);
      setErro(r.erro);
      if (!r.erro) router.refresh();
    });
  }

  const data = peca.publicadaEm
    ? `Publicado em ${fmtData.format(new Date(peca.publicadaEm))}`
    : peca.programadaPara
      ? `Sai em ${fmtData.format(new Date(peca.programadaPara))}`
      : `Criado em ${fmtData.format(new Date(peca.em))}`;

  return (
    <section className="cx-pp-secao" aria-label="Detalhes">
      <div className="cx-pp-etapas" role="radiogroup" aria-label="Etapa">
        {ETAPAS.map((e) => (
          <button
            key={e}
            type="button"
            role="radio"
            aria-checked={etapa === e}
            data-etapa={e}
            className="cx-pp-etapa"
            onClick={() => {
              if (e === etapa) return;
              setEtapa(e);
              iniciar(async () => {
                const r = await mudarEtapaAcao(peca.id, e);
                if (r.erro !== null) {
                  setErro(r.erro);
                  setEtapa(peca.etapa);
                } else router.refresh();
              });
            }}
          >
            <span className="cx-selo-ponto" aria-hidden="true" />
            {ROTULO_ETAPA[e]}
          </button>
        ))}
      </div>
      <label className="cx-campo cx-pp-campo">
        <span className="cx-campo-rotulo">Título</span>
        <input
          className="cx-input cx-pp-titulo-input"
          value={titulo}
          maxLength={160}
          onChange={(e) => setTitulo(e.target.value)}
          onBlur={() => titulo.trim() && titulo !== peca.titulo && salvar({ titulo })}
        />
      </label>
      <label className="cx-campo cx-pp-campo">
        <span className="cx-campo-rotulo">Descrição</span>
        <textarea
          className="cx-input"
          rows={2}
          maxLength={400}
          value={descricao}
          placeholder="Para que serve esta peça, em uma linha"
          onChange={(e) => setDescricao(e.target.value)}
          onBlur={() => descricao !== peca.descricao && salvar({ descricao })}
        />
      </label>
      <p className="cx-pp-meta">{data}</p>
      {erro ? (
        <p role="alert" className="cx-aviso cx-aviso--erro">
          {erro}
        </p>
      ) : null}
    </section>
  );
}

export function LegendaPeca({
  peca,
  rotulo = "Legenda",
  editavel = true,
}: {
  peca: PecaDetalhe;
  rotulo?: string;
  editavel?: boolean;
}) {
  const [legenda, setLegenda] = useState(peca.texto);
  const [copiado, setCopiado] = useState(false);
  const [salvo, setSalvo] = useState<"ok" | "salvando" | "erro">("ok");
  const limite = (peca.rede && LIMITE_LEGENDA[peca.rede]) || 2200;
  const passou = legenda.length > limite;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(legenda);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      setCopiado(false);
    }
  }

  return (
    <section className="cx-pp-secao" aria-labelledby="cx-pp-legenda">
      <div className="cx-pp-cabeca">
        <h2 id="cx-pp-legenda" className="cx-pp-titulo">
          {rotulo}
        </h2>
        <span className="cx-pp-contagem" data-passou={passou ? "" : undefined} aria-live="polite">
          {legenda.length.toLocaleString("pt-BR")} / {limite.toLocaleString("pt-BR")}
        </span>
      </div>
      <textarea
        aria-labelledby="cx-pp-legenda"
        className="cx-input cx-pp-legenda"
        rows={6}
        maxLength={4000}
        value={legenda}
        readOnly={!editavel}
        onChange={(e) => setLegenda(e.target.value)}
        onBlur={async () => {
          if (!editavel || legenda === peca.texto) return;
          setSalvo("salvando");
          const r = await salvarDetalhesAcao(peca.id, { legenda });
          setSalvo(r.erro ? "erro" : "ok");
        }}
      />
      <div className="cx-pp-linha">
        <button type="button" className="cx-botao cx-botao--suave" onClick={copiar} disabled={!legenda}>
          {copiado ? <Check size={16} strokeWidth={2} aria-hidden="true" /> : <Copy size={16} strokeWidth={1.8} aria-hidden="true" />}
          {copiado ? "Copiada" : "Copiar"}
        </button>
        <span className="cx-pp-meta" role="status">
          {salvo === "salvando" ? "Salvando…" : salvo === "erro" ? "Não salvou" : passou ? `Passa ${legenda.length - limite} do limite` : ""}
        </span>
      </div>
    </section>
  );
}

function Exportar({ api }: { api: ApiVisualizador }) {
  const [fazendo, setFazendo] = useState<string | null>(null);
  const { estado, indice, peca, nomeNegocio } = api;
  async function rodar(qual: string, f: () => Promise<void>) {
    setFazendo(qual);
    try {
      await f();
    } finally {
      setFazendo(null);
    }
  }
  return (
    <section className="cx-pp-secao" aria-labelledby="cx-pp-exportar">
      <h2 id="cx-pp-exportar" className="cx-pp-titulo">
        Exportar
      </h2>
      <div className="cx-pp-exportar">
        <button
          type="button"
          className="cx-botao cx-botao--suave"
          disabled={!!fazendo}
          onClick={() => rodar("png", () => exportarPng(estado.slides, [indice], estado.marca, nomeNegocio, peca.titulo))}
        >
          {fazendo === "png" ? <LoaderCircle size={16} className="cx-girando" aria-hidden="true" /> : <Download size={16} strokeWidth={1.8} aria-hidden="true" />}
          PNG do slide {indice + 1}
        </button>
        <button
          type="button"
          className="cx-botao cx-botao--suave"
          disabled={!!fazendo}
          onClick={() =>
            rodar("todos", () =>
              exportarPng(
                estado.slides,
                estado.slides.map((_, i) => i),
                estado.marca,
                nomeNegocio,
                peca.titulo,
              ),
            )
          }
        >
          {fazendo === "todos" ? <LoaderCircle size={16} className="cx-girando" aria-hidden="true" /> : <Download size={16} strokeWidth={1.8} aria-hidden="true" />}
          PNG de todos ({estado.slides.length})
        </button>
        <button
          type="button"
          className="cx-botao cx-botao--azul cx-pp-largo"
          disabled={!!fazendo}
          onClick={() => rodar("pdf", () => exportarPdf(estado.slides, estado.marca, nomeNegocio, peca.titulo))}
        >
          {fazendo === "pdf" ? <LoaderCircle size={16} className="cx-girando" aria-hidden="true" /> : <FileDown size={16} strokeWidth={1.8} aria-hidden="true" />}
          Baixar PDF
        </button>
      </div>
      {api.sujo ? <p className="cx-pp-meta">Sai do jeito que está na tela, mesmo sem salvar a versão.</p> : null}
    </section>
  );
}

function ComentariosLista({ api }: { api: ApiVisualizador }) {
  const { comentarios, versao } = api;
  return (
    <section className="cx-pp-secao" aria-labelledby="cx-pp-coment">
      <h2 id="cx-pp-coment" className="cx-pp-titulo">
        Comentários da v{versao.numero}
      </h2>
      {comentarios.length ? (
        <ol className="cx-pp-comentarios">
          {comentarios.map((c, n) => (
            <li key={c.id} data-resolvido={c.resolvido ? "" : undefined}>
              <button type="button" onClick={() => api.abrirComentario(c)}>
                <span className="cx-pp-coment-num">{n + 1}</span>
                <span className="cx-pp-coment-texto">
                  <span>{c.texto}</span>
                  <span className="cx-pp-meta">
                    {c.autor} · slide {c.slide + 1}
                    {c.resolvido ? " · resolvido" : ""}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="cx-pp-meta">Clique em qualquer ponto do slide para deixar um comentário.</p>
      )}
    </section>
  );
}

export function PainelPeca({ api }: { api: ApiVisualizador }) {
  const { peca } = api;
  return (
    <div className="cx-pp">
      {api.modo === "comentar" ? <ComentariosLista api={api} /> : null}
      <DetalhesPeca peca={peca} />
      <LegendaPeca peca={peca} />
      <Exportar api={api} />
      <MandarBuffer
        entregaId={api.peca.id}
        slides={api.estado.slides}
        marca={api.estado.marca}
        nomeNegocio={api.nomeNegocio}
        aprovada={api.peca.etapa !== "EM_REVISAO"}
        buffer={api.peca.buffer}
      />
      <PostVinculado peca={peca} />
      <ListaVersoes api={api} onComparar={api.comparar} />
    </div>
  );
}
