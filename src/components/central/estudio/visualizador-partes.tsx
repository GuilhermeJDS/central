"use client";

/**
 * Partes do visualizador: barra de edição, alfinetes de comentário e a tira
 * de miniaturas.
 */
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  ImagePlus,
  LoaderCircle,
  Minus,
  MessageSquareQuote,
  Plus,
  RotateCcw,
  Save,
  Stamp,
  Trash2,
  Type,
  Undo2,
  Wallpaper,
} from "lucide-react";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";

import { enviarImagemCarrosselAcao } from "@/app/central/acoes-entregas";
import { apagarComentarioAcao, comentarAcao, resolverComentarioAcao } from "@/app/central/acoes-estudio";
import { SlideVista } from "@/components/central/estudio/slide-vista";
import type { MarcaCarrossel } from "@/lib/central/carrossel";
import type { ComentarioPeca } from "@/lib/central/estudio/pecas";
import {
  corDe,
  MARGEM,
  novoIdElemento,
  TAMANHOS_TEXTO,
  type CorMarca,
  type ElementoSlide,
  type SlideEstudio,
} from "@/lib/central/estudio/slide";

const fmtHora = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const CORES: Array<[CorMarca, string]> = [
  ["texto", "Cor do texto da marca"],
  ["destaque", "Cor de destaque da marca"],
  ["fundo", "Cor de fundo da marca"],
  ["branco", "Branco"],
  ["preto", "Preto"],
];

// ---------------------------------------------------------------------------
// Barra de edição
// ---------------------------------------------------------------------------

function Grupo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="cx-ed-grupo" role="group" aria-label={rotulo}>
      {children}
    </div>
  );
}

export function BarraEdicao({
  selecionado,
  podeDesfazer,
  sujo,
  marca,
  formato,
  onMudarElemento,
  onAdicionar,
  onExcluir,
  onDesfazer,
  onDescartar,
  onSalvar,
  onAviso,
  indice,
  extraImagem,
}: {
  selecionado: ElementoSlide | null;
  podeDesfazer: boolean;
  sujo: boolean;
  marca: MarcaCarrossel;
  formato: { W: number; H: number };
  onMudarElemento: (p: Partial<ElementoSlide>) => void;
  onAdicionar: (el: ElementoSlide) => void;
  onExcluir: () => void;
  onDesfazer: () => void;
  onDescartar: () => void;
  onSalvar: (descricao: string) => Promise<string | null>;
  onAviso: (m: string | null) => void;
  indice: number;
  /** Botão de imagem com gerar/biblioteca (sem ele, só envio do arquivo). */
  extraImagem?: ReactNode;
}) {
  const [alvoCor, setAlvoCor] = useState<"cor" | "fundo">("cor");
  const [salvarAberto, setSalvarAberto] = useState(false);
  const [descricao, setDescricao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [enviando, iniciarEnvio] = useTransition();
  const arquivo = useRef<HTMLInputElement>(null);
  const { W, H } = formato;

  const ehTexto = selecionado && selecionado.tipo !== "imagem";
  const comFundo = selecionado && (selecionado.tipo === "balao" || selecionado.tipo === "selo");
  const tam = selecionado?.tamanho ?? (selecionado?.tipo === "titulo" ? 84 : 40);

  function passoTamanho(dir: 1 | -1) {
    const lista = [...TAMANHOS_TEXTO] as number[];
    const prox = dir > 0 ? lista.find((t) => t > tam) : [...lista].reverse().find((t) => t < tam);
    if (prox) onMudarElemento({ tamanho: prox });
  }

  function novo(tipo: ElementoSlide["tipo"]): ElementoSlide {
    const id = novoIdElemento();
    if (tipo === "balao")
      return { id, tipo, x: MARGEM, y: Math.round(H * 0.42), w: 620, texto: "Escreva a fala aqui", tamanho: 40, cor: "branco", fundo: "destaque" };
    if (tipo === "selo")
      return { id, tipo, x: MARGEM, y: 120, w: 520, texto: "Novidade", tamanho: 30, cor: "branco", fundo: "destaque" };
    return { id, tipo: "texto", x: MARGEM, y: Math.round(H * 0.45), w: W - MARGEM * 2, texto: "Novo texto", tamanho: 48, cor: "texto" };
  }

  function enviarImagem(f: File | undefined) {
    if (!f) return;
    onAviso(null);
    const form = new FormData();
    form.set("imagem", f);
    iniciarEnvio(async () => {
      const r = await enviarImagemCarrosselAcao(form);
      if (r.url) onAdicionar({ id: novoIdElemento(), tipo: "imagem", x: 240, y: Math.round(H * 0.25), w: 600, h: 600, url: r.url });
      else onAviso(r.erro);
    });
  }

  async function salvar() {
    setSalvando(true);
    const erro = await onSalvar(descricao.trim() || `Ajustes no slide ${indice + 1}`);
    setSalvando(false);
    if (erro) onAviso(erro);
    else {
      setSalvarAberto(false);
      setDescricao("");
    }
  }

  return (
    <div className="cx-ed-barra" role="toolbar" aria-label="Editar slide">
      <Grupo rotulo="Adicionar">
        <button type="button" className="cx-ed-botao" onClick={() => onAdicionar(novo("texto"))}>
          <Type size={17} strokeWidth={1.8} aria-hidden="true" /> Texto
        </button>
        <button type="button" className="cx-ed-botao" onClick={() => onAdicionar(novo("balao"))}>
          <MessageSquareQuote size={17} strokeWidth={1.8} aria-hidden="true" /> Balão
        </button>
        <button type="button" className="cx-ed-botao" onClick={() => onAdicionar(novo("selo"))}>
          <Stamp size={17} strokeWidth={1.8} aria-hidden="true" /> Selo
        </button>
        {extraImagem ?? (
          <button type="button" className="cx-ed-botao" onClick={() => arquivo.current?.click()} disabled={enviando}>
            {enviando ? (
              <LoaderCircle size={17} strokeWidth={1.8} className="cx-girando" aria-hidden="true" />
            ) : (
              <ImagePlus size={17} strokeWidth={1.8} aria-hidden="true" />
            )}
            Imagem
          </button>
        )}
        <input
          ref={arquivo}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="cx-so-leitor"
          tabIndex={-1}
          onChange={(e) => {
            enviarImagem(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </Grupo>

      {ehTexto ? (
        <>
          <Grupo rotulo="Tamanho do texto">
            <button type="button" className="cx-ed-icone" onClick={() => passoTamanho(-1)} aria-label="Diminuir texto">
              <Minus size={16} strokeWidth={2} aria-hidden="true" />
            </button>
            <span className="cx-ed-valor" aria-live="polite">
              {tam}
            </span>
            <button type="button" className="cx-ed-icone" onClick={() => passoTamanho(1)} aria-label="Aumentar texto">
              <Plus size={16} strokeWidth={2} aria-hidden="true" />
            </button>
          </Grupo>
          <Grupo rotulo="Cores da marca">
            {comFundo ? (
              <span className="cx-ed-alvo">
                <button type="button" aria-pressed={alvoCor === "cor"} onClick={() => setAlvoCor("cor")}>
                  Letra
                </button>
                <button type="button" aria-pressed={alvoCor === "fundo"} onClick={() => setAlvoCor("fundo")}>
                  Fundo
                </button>
              </span>
            ) : null}
            {CORES.map(([c, rotulo]) => {
              const atual = (comFundo && alvoCor === "fundo" ? selecionado?.fundo ?? "destaque" : selecionado?.cor ?? "texto") === c;
              return (
                <button
                  key={c}
                  type="button"
                  className="cx-ed-cor"
                  style={{ background: corDe(c, marca) }}
                  aria-label={rotulo}
                  aria-pressed={atual}
                  title={rotulo}
                  onClick={() => onMudarElemento(comFundo && alvoCor === "fundo" ? { fundo: c } : { cor: c })}
                />
              );
            })}
          </Grupo>
        </>
      ) : null}

      {selecionado?.tipo === "imagem" ? (
        <Grupo rotulo="Imagem">
          <button
            type="button"
            className="cx-ed-botao"
            aria-pressed={selecionado.w >= W && (selecionado.h ?? 0) >= H}
            onClick={() =>
              onMudarElemento(
                selecionado.w >= W && (selecionado.h ?? 0) >= H
                  ? { x: 240, y: Math.round(H * 0.25), w: 600, h: 600, escurecer: false }
                  : { x: 0, y: 0, w: W, h: H, escurecer: true },
              )
            }
          >
            <Wallpaper size={17} strokeWidth={1.8} aria-hidden="true" /> De fundo
          </button>
          <button
            type="button"
            className="cx-ed-icone"
            onClick={() => onMudarElemento({ w: Math.max(160, Math.round(selecionado.w * 0.85)), h: Math.max(160, Math.round((selecionado.h ?? selecionado.w) * 0.85)) })}
            aria-label="Diminuir imagem"
          >
            <Minus size={16} strokeWidth={2} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="cx-ed-icone"
            onClick={() => onMudarElemento({ w: Math.min(W * 2, Math.round(selecionado.w * 1.15)), h: Math.min(H * 2, Math.round((selecionado.h ?? selecionado.w) * 1.15)) })}
            aria-label="Aumentar imagem"
          >
            <Plus size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        </Grupo>
      ) : null}

      {selecionado ? (
        <Grupo rotulo="Elemento">
          <button type="button" className="cx-ed-icone cx-ed-icone--perigo" onClick={onExcluir} aria-label="Apagar elemento" title="Apagar elemento">
            <Trash2 size={17} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </Grupo>
      ) : null}

      <div className="cx-ed-fim">
        <button type="button" className="cx-ed-icone" onClick={onDesfazer} disabled={!podeDesfazer} aria-label="Desfazer" title="Desfazer (⌘Z)">
          <Undo2 size={17} strokeWidth={1.8} aria-hidden="true" />
        </button>
        {sujo ? (
          <button type="button" className="cx-ed-botao" onClick={onDescartar}>
            <RotateCcw size={16} strokeWidth={1.8} aria-hidden="true" /> Descartar
          </button>
        ) : null}
        <div className="cx-ed-salvar">
          <button
            type="button"
            className="cx-botao cx-botao--azul cx-ed-salvar-botao"
            disabled={!sujo}
            aria-expanded={salvarAberto}
            onClick={() => {
              setSalvarAberto((a) => !a);
              if (!descricao) setDescricao(`Ajustes no slide ${indice + 1}`);
            }}
          >
            <Save size={17} strokeWidth={1.8} aria-hidden="true" /> Salvar versão
          </button>
          {salvarAberto ? (
            <form
              className="cx-ed-salvar-caixa"
              onSubmit={(e) => {
                e.preventDefault();
                void salvar();
              }}
            >
              <label className="cx-campo">
                <span className="cx-campo-rotulo">O que mudou?</span>
                <input
                  className="cx-input"
                  value={descricao}
                  maxLength={160}
                  autoFocus
                  onChange={(e) => setDescricao(e.target.value)}
                  onFocus={(e) => e.currentTarget.select()}
                />
              </label>
              <div className="cx-ed-salvar-acoes">
                <button type="button" className="cx-botao cx-botao--fantasma-escuro" onClick={() => setSalvarAberto(false)}>
                  Cancelar
                </button>
                <button type="submit" className="cx-botao cx-botao--azul" disabled={salvando}>
                  {salvando ? (
                    <LoaderCircle size={16} strokeWidth={1.8} className="cx-girando" aria-hidden="true" />
                  ) : (
                    <Check size={16} strokeWidth={2} aria-hidden="true" />
                  )}
                  Salvar
                </button>
              </div>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Alfinetes
// ---------------------------------------------------------------------------

function CaixaNovo({
  x,
  y,
  versaoId,
  slide,
  onCriado,
  onCancelar,
}: {
  x: number;
  y: number;
  versaoId: string;
  slide: number;
  onCriado: (c: ComentarioPeca) => void;
  onCancelar: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();
  function enviar() {
    if (!texto.trim()) return;
    iniciar(async () => {
      const r = await comentarAcao({ versaoId, slide, x, y, texto });
      if (r.erro !== null) setErro(r.erro);
      else onCriado(r.comentario);
    });
  }
  return (
    <form
      className="cx-pin-caixa"
      data-lado={x > 0.55 ? "esq" : "dir"}
      style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
      onSubmit={(e) => {
        e.preventDefault();
        enviar();
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <label className="cx-so-leitor" htmlFor="cx-pin-novo">
        Comentário
      </label>
      <textarea
        id="cx-pin-novo"
        className="cx-input cx-pin-texto"
        rows={3}
        maxLength={1000}
        placeholder="Escreva o comentário"
        autoFocus
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) enviar();
          if (e.key === "Escape") onCancelar();
        }}
      />
      {erro ? (
        <p role="alert" className="cx-pin-erro">
          {erro}
        </p>
      ) : null}
      <div className="cx-pin-acoes">
        <button type="button" className="cx-botao cx-botao--fantasma-escuro" onClick={onCancelar}>
          Cancelar
        </button>
        <button type="submit" className="cx-botao cx-botao--azul" disabled={enviando || !texto.trim()}>
          {enviando ? "Salvando…" : "Comentar"}
        </button>
      </div>
    </form>
  );
}

export function ComentariosDoSlide({
  comentarios,
  numeroDe,
  ativo,
  aberto,
  setAberto,
  novo,
  cancelarNovo,
  versaoId,
  slide,
  onCriado,
  onMudou,
}: {
  comentarios: ComentarioPeca[];
  numeroDe: Map<string, number>;
  ativo: boolean;
  aberto: string | null;
  setAberto: (id: string | null) => void;
  novo: { x: number; y: number } | null;
  cancelarNovo: () => void;
  versaoId: string;
  slide: number;
  onCriado: (c: ComentarioPeca) => void;
  onMudou: (id: string, parcial: Partial<ComentarioPeca> | null) => void;
}) {
  const [, iniciar] = useTransition();
  return (
    <div className="cx-pins" data-ativo={ativo ? "" : undefined}>
      {comentarios
        .filter((c) => ativo || !c.resolvido)
        .map((c) => {
          const n = numeroDe.get(c.id) ?? 0;
          const estaAberto = aberto === c.id && ativo;
          return (
            <div key={c.id}>
              <button
                type="button"
                className="cx-pin"
                data-resolvido={c.resolvido ? "" : undefined}
                data-aberto={estaAberto ? "" : undefined}
                style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%` }}
                aria-label={`Comentário ${n}${c.resolvido ? " (resolvido)" : ""}`}
                aria-expanded={estaAberto}
                onClick={(e) => {
                  e.stopPropagation();
                  setAberto(estaAberto ? null : c.id);
                }}
              >
                {c.resolvido ? <Check size={14} strokeWidth={2.4} aria-hidden="true" /> : n}
              </button>
              {estaAberto ? (
                <div
                  className="cx-pin-caixa"
                  data-lado={c.x > 0.55 ? "esq" : "dir"}
                  style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%` }}
                  onClick={(e) => e.stopPropagation()}
                  role="dialog"
                  aria-label={`Comentário ${n}`}
                >
                  <p className="cx-pin-quem">
                    <strong>{c.autor}</strong> · {fmtHora.format(new Date(c.em))}
                  </p>
                  <p className="cx-pin-corpo">{c.texto}</p>
                  <div className="cx-pin-acoes">
                    <button
                      type="button"
                      className="cx-botao cx-botao--fantasma-escuro"
                      onClick={() =>
                        iniciar(async () => {
                          const r = await apagarComentarioAcao(c.id);
                          if (!r.erro) {
                            onMudou(c.id, null);
                            setAberto(null);
                          }
                        })
                      }
                    >
                      <Trash2 size={15} strokeWidth={1.8} aria-hidden="true" /> Apagar
                    </button>
                    <button
                      type="button"
                      className="cx-botao cx-botao--suave"
                      onClick={() =>
                        iniciar(async () => {
                          const r = await resolverComentarioAcao(c.id, !c.resolvido);
                          if (!r.erro) onMudou(c.id, { resolvido: !c.resolvido });
                        })
                      }
                    >
                      <Check size={15} strokeWidth={2} aria-hidden="true" /> {c.resolvido ? "Reabrir" : "Resolver"}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      {novo && ativo ? (
        <>
          <span className="cx-pin cx-pin--novo" style={{ left: `${novo.x * 100}%`, top: `${novo.y * 100}%` }} aria-hidden="true">
            <Plus size={14} strokeWidth={2.4} />
          </span>
          <CaixaNovo x={novo.x} y={novo.y} versaoId={versaoId} slide={slide} onCriado={onCriado} onCancelar={cancelarNovo} />
        </>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Miniaturas
// ---------------------------------------------------------------------------

export function MiniaturasEdicao({
  slides,
  marca,
  nomeNegocio,
  atual,
  editando,
  comentariosPorSlide,
  irPara,
  onMudar,
}: {
  slides: SlideEstudio[];
  marca: MarcaCarrossel;
  nomeNegocio: string;
  atual: number;
  editando: boolean;
  comentariosPorSlide: Record<number, number>;
  irPara: (i: number) => void;
  onMudar: (slides: SlideEstudio[], novoIndice?: number) => void;
}) {
  const lista = useRef<HTMLOListElement>(null);
  const arrastando = useRef<number | null>(null);

  // A miniatura atual fica à vista, rolando só a fileira (scrollIntoView
  // também rolava a página e escondia o cabeçalho ao abrir a peça).
  useEffect(() => {
    const l = lista.current;
    const el = l?.children[atual] as HTMLElement | undefined;
    if (!l || !el) return;
    const a = el.getBoundingClientRect();
    const r = l.getBoundingClientRect();
    const dx = a.left < r.left ? a.left - r.left - 8 : a.right > r.right ? a.right - r.right + 8 : 0;
    if (dx) l.scrollBy({ left: dx, behavior: "smooth" });
  }, [atual]);

  function mover(de: number, para: number) {
    if (para < 0 || para >= slides.length || de === para) return;
    const nova = [...slides];
    const [s] = nova.splice(de, 1);
    nova.splice(para, 0, s);
    onMudar(nova, para);
  }

  return (
    <div className="cx-vz-tira">
      <ol ref={lista} className="cx-vz-miniaturas" aria-label="Slides">
        {slides.map((s, i) => (
          <li
            key={s.id}
            draggable={editando}
            onDragStart={() => (arrastando.current = i)}
            onDragOver={(e) => editando && e.preventDefault()}
            onDrop={() => {
              if (arrastando.current !== null) mover(arrastando.current, i);
              arrastando.current = null;
            }}
          >
            <button
              type="button"
              className="cx-vz-mini"
              aria-current={i === atual ? "true" : undefined}
              aria-label={`Slide ${i + 1}${comentariosPorSlide[i] ? `, ${comentariosPorSlide[i]} comentários` : ""}`}
              onClick={() => irPara(i)}
            >
              <SlideVista slide={s} indice={i} total={slides.length} marca={marca} nomeNegocio={nomeNegocio} />
              <span className="cx-vz-mini-num" aria-hidden="true">
                {i + 1}
              </span>
              {comentariosPorSlide[i] ? (
                <span className="cx-vz-mini-coment" aria-hidden="true">
                  {comentariosPorSlide[i]}
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ol>
      {editando ? (
        <div className="cx-vz-tira-acoes" role="group" aria-label="Slide atual">
          <button type="button" className="cx-ed-icone" onClick={() => mover(atual, atual - 1)} disabled={atual === 0} aria-label="Mover slide para a esquerda">
            <ArrowLeft size={17} strokeWidth={1.8} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="cx-ed-icone"
            onClick={() => mover(atual, atual + 1)}
            disabled={atual >= slides.length - 1}
            aria-label="Mover slide para a direita"
          >
            <ArrowRight size={17} strokeWidth={1.8} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="cx-ed-botao"
            disabled={slides.length >= 15}
            onClick={() => {
              const base = slides[atual];
              const id = `s${Date.now().toString(36)}`;
              const copia: SlideEstudio = {
                ...base,
                id,
                elementos: (base.elementos ?? []).map((e) => ({ ...e, id: novoIdElemento() })),
              };
              onMudar([...slides.slice(0, atual + 1), copia, ...slides.slice(atual + 1)], atual + 1);
            }}
          >
            <Copy size={16} strokeWidth={1.8} aria-hidden="true" /> Duplicar
          </button>
          <button
            type="button"
            className="cx-ed-botao"
            disabled={slides.length >= 15}
            onClick={() => {
              const id = `s${Date.now().toString(36)}`;
              const novo: SlideEstudio = {
                id,
                titulo: "Novo slide",
                texto: "",
                imagem: null,
                imagemDica: "",
                elementos: [{ id: novoIdElemento(), tipo: "titulo", x: MARGEM, y: 420, w: 888, texto: "Novo slide", tamanho: 84, cor: "texto" }],
              };
              onMudar([...slides.slice(0, atual + 1), novo, ...slides.slice(atual + 1)], atual + 1);
            }}
          >
            <Plus size={16} strokeWidth={1.8} aria-hidden="true" /> Slide
          </button>
          <button
            type="button"
            className="cx-ed-icone cx-ed-icone--perigo"
            disabled={slides.length <= 1}
            onClick={() => onMudar(slides.filter((_, i) => i !== atual), Math.max(0, atual - 1))}
            aria-label="Apagar este slide"
            title="Apagar este slide"
          >
            <Trash2 size={17} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
