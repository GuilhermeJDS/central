"use client";

/**
 * Visualizador do carrossel no estúdio. Estrutura dominante: o slide grande
 * no meio, setas dos lados, tira de miniaturas embaixo e o painel da peça à
 * direita. Três modos:
 *  - Visualizar: navegar (setas, ← →, miniaturas) e tela cheia.
 *  - Editar: arrastar elementos, duplo clique edita o texto no slide; barra
 *    de baixo com tamanho, cores da marca, desfazer e "Salvar versão".
 *  - Comentar: clique em qualquer ponto deixa um alfinete com comentário,
 *    salvo na versão aberta.
 */
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Columns2,
  Eye,
  Maximize2,
  MessageCircle,
  Minimize2,
  PenLine,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as RPointerEvent,
  type ReactNode,
} from "react";

import { salvarVersaoAcao } from "@/app/central/acoes-estudio";
import {
  BarraEdicao,
  ComentariosDoSlide,
  MiniaturasEdicao,
} from "@/components/central/estudio/visualizador-partes";
import {
  SlideVista,
  useFonteMarca,
  type EdicaoSlide,
  type LadoAlca,
} from "@/components/central/estudio/slide-vista";
import { Comparador } from "@/components/central/estudio/versoes";
import { tamanho, type MarcaCarrossel } from "@/lib/central/carrossel";
import type {
  ComentarioPeca,
  PecaDetalhe,
  VersaoView,
} from "@/lib/central/estudio/pecas";
import {
  estiloTexto,
  normalizarSlide,
  type ElementoSlide,
  type SlideEstudio,
} from "@/lib/central/estudio/slide";

export type Modo = "ver" | "editar" | "comentar";

type Estado = { slides: SlideEstudio[]; marca: MarcaCarrossel };

function carregar(
  v: VersaoView | undefined,
  marcaPadrao: MarcaCarrossel,
): Estado {
  const marca = v?.conteudo?.marca ?? marcaPadrao;
  const slides = (v?.conteudo?.slides ?? []).map((s, i) =>
    normalizarSlide(s, i, marca),
  );
  return { slides, marca };
}

export type ApiVisualizador = {
  peca: PecaDetalhe;
  versao: VersaoView;
  estado: Estado;
  indice: number;
  irPara: (i: number) => void;
  sujo: boolean;
  modo: Modo;
  setModo: (m: Modo) => void;
  comentarios: ComentarioPeca[];
  abrirComentario: (c: ComentarioPeca) => void;
  trocarVersao: (id: string) => void;
  nomeNegocio: string;
  /** Aplica uma mudança com desfazer (imagem gerada, escolhida etc.). */
  mudarSlides: (fn: (s: SlideEstudio[]) => SlideEstudio[]) => void;
  /** Elemento selecionado no modo Editar. */
  selecionado: ElementoSlide | null;
  /** Abre a comparação (a aberta x a principal, ou a anterior). */
  comparar: () => void;
};

export function Visualizador({
  peca,
  nomeNegocio,
  marcaCliente,
  painel,
  topo,
  extraImagem,
}: {
  peca: PecaDetalhe;
  nomeNegocio: string;
  marcaCliente: MarcaCarrossel;
  /** Painel lateral (versões, detalhes, números). */
  painel: (api: ApiVisualizador) => ReactNode;
  /** Ações extras no topo (ex.: Comparar). */
  topo?: (api: ApiVisualizador) => ReactNode;
  /** Botão de imagem da barra de edição (gerar, biblioteca, enviar). */
  extraImagem?: (api: ApiVisualizador) => ReactNode;
}) {
  const router = useRouter();
  const principal = peca.versoes.find((v) => v.principal) ?? peca.versoes[0];
  const [versaoId, setVersaoId] = useState(principal?.id ?? "");
  const versao = peca.versoes.find((v) => v.id === versaoId) ?? principal;
  // Estado e histórico juntos: o desfazer é uma atualização pura.
  const [doc, setDoc] = useState<{ estado: Estado; historico: Estado[] }>(
    () => ({
      estado: carregar(versao, marcaCliente),
      historico: [],
    }),
  );
  const { estado, historico } = doc;
  const setEstado = useCallback((fn: Estado | ((e: Estado) => Estado)) => {
    setDoc((d) => ({
      ...d,
      estado: typeof fn === "function" ? fn(d.estado) : fn,
    }));
  }, []);
  const [sujo, setSujo] = useState(false);
  const [indice, setIndice] = useState(0);
  const [modo, setModo] = useState<Modo>("ver");
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const [comentarios, setComentarios] = useState<ComentarioPeca[]>(
    peca.comentarios,
  );
  const [pinAberto, setPinAberto] = useState<string | null>(null);
  const [pinNovo, setPinNovo] = useState<{ x: number; y: number } | null>(null);
  const [telaCheia, setTelaCheia] = useState(false);
  /** Muda a cada entrada em Comentar: remonta o aviso (a animação recomeça). */
  const [dicaComentar, setDicaComentar] = useState(0);
  const [aviso, setAviso] = useState<string | null>(null);
  const [comparando, setComparando] = useState<[string, string] | null>(null);
  const caixa = useRef<HTMLDivElement>(null);
  const slideRef = useRef<HTMLDivElement>(null);
  const arrasto = useRef<{
    id: string;
    px: number;
    py: number;
    x: number;
    y: number;
    antes: Estado;
    moveu: boolean;
    /** Redimensionando por uma alça (sem ela, movendo). */
    alca?: {
      lado: LadoAlca;
      w: number;
      h: number;
      tam: number;
      texto: boolean;
    };
  } | null>(null);

  useFonteMarca(estado.marca.fonte);

  // A página recarregou (nova versão salva): os comentários seguem o servidor.
  const [comentariosBase, setComentariosBase] = useState(peca.comentarios);
  if (comentariosBase !== peca.comentarios) {
    setComentariosBase(peca.comentarios);
    setComentarios(peca.comentarios);
  }

  const total = estado.slides.length;
  const i = Math.min(indice, Math.max(0, total - 1));
  const slide = estado.slides[i];
  const { w: W, h: H } = tamanho(estado.marca.formato);

  const irPara = useCallback(
    (n: number) => {
      setIndice(Math.max(0, Math.min(total - 1, n)));
      setSelecionado(null);
      setEditando(null);
      setPinNovo(null);
      setPinAberto(null);
    },
    [total],
  );

  const trocarVersao = useCallback(
    (id: string) => {
      if (sujo) {
        setAviso("Salve a versão ou desfaça as mudanças antes de abrir outra.");
        return;
      }
      const v = peca.versoes.find((x) => x.id === id);
      if (!v) return;
      setVersaoId(id);
      setDoc({ estado: carregar(v, marcaCliente), historico: [] });
      setIndice(0);
      setSelecionado(null);
      setPinNovo(null);
      setPinAberto(null);
      setAviso(null);
    },
    [sujo, peca.versoes, marcaCliente],
  );

  // ----------------------------------------------------------------- edição

  const mudar = useCallback((fn: (e: Estado) => Estado) => {
    setDoc((d) => ({
      estado: fn(d.estado),
      historico: [...d.historico.slice(-49), d.estado],
    }));
    setSujo(true);
  }, []);

  const mudarElemento = useCallback(
    (id: string, parcial: Partial<ElementoSlide>) =>
      mudar((e) => ({
        ...e,
        slides: e.slides.map((s, k) =>
          k === i
            ? {
                ...s,
                elementos: (s.elementos ?? []).map((el) =>
                  el.id === id ? { ...el, ...parcial } : el,
                ),
              }
            : s,
        ),
      })),
    [mudar, i],
  );

  function desfazer() {
    setDoc((d) =>
      d.historico.length
        ? {
            estado: d.historico[d.historico.length - 1],
            historico: d.historico.slice(0, -1),
          }
        : d,
    );
    setSelecionado(null);
    setEditando(null);
  }

  function descartar() {
    setDoc({ estado: carregar(versao, marcaCliente), historico: [] });
    setSujo(false);
    setSelecionado(null);
    setEditando(null);
    setAviso(null);
  }

  const edicao: EdicaoSlide | undefined =
    modo === "editar"
      ? {
          selecionado,
          editando,
          onPointerDownElemento: (
            ev: RPointerEvent<HTMLElement>,
            el: ElementoSlide,
          ) => {
            if (editando === el.id) return;
            ev.preventDefault();
            ev.stopPropagation();
            setSelecionado(el.id);
            if (editando) setEditando(null);
            (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
            arrasto.current = {
              id: el.id,
              px: ev.clientX,
              py: ev.clientY,
              x: el.x,
              y: el.y,
              antes: estado,
              moveu: false,
            };
          },
          onPointerDownAlca: (ev, el, lado) => {
            ev.preventDefault();
            ev.stopPropagation();
            (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
            const texto = el.tipo !== "imagem";
            arrasto.current = {
              id: el.id,
              px: ev.clientX,
              py: ev.clientY,
              x: el.x,
              y: el.y,
              antes: estado,
              moveu: false,
              alca: {
                lado,
                w: el.w,
                h: el.h ?? el.w,
                tam: texto ? estiloTexto(el, estado.marca).px : 0,
                texto,
              },
            };
          },
          onDuploClique: (el) => {
            setSelecionado(el.id);
            setEditando(el.id);
          },
          onTextoEditado: (el, texto) => {
            setEditando(null);
            if (texto !== (el.texto ?? "")) mudarElemento(el.id, { texto });
          },
        }
      : undefined;

  function moverArrasto(ev: RPointerEvent<HTMLDivElement>) {
    const a = arrasto.current;
    if (!a || !slideRef.current) return;
    const k = W / slideRef.current.getBoundingClientRect().width;
    const dx = (ev.clientX - a.px) * k;
    const dy = (ev.clientY - a.py) * k;
    if (!a.moveu && Math.hypot(dx, dy) < 3) return;
    a.moveu = true;
    if (a.alca) {
      const { lado, w, h, tam, texto } = a.alca;
      const oeste = lado.includes("w");
      const norte = lado.startsWith("n");
      const larg = Math.max(80, Math.min(W * 2, w + (oeste ? -dx : dx)));
      let parcial: Partial<ElementoSlide>;
      if (lado.length === 1) {
        // Lateral: só a largura (o texto quebra de novo).
        parcial = {
          w: Math.round(larg),
          x: Math.round(oeste ? a.x + (w - larg) : a.x),
        };
      } else {
        // Canto: escala tudo junto, preso ao canto oposto.
        const k = larg / w;
        const nh = h * k;
        parcial = {
          w: Math.round(larg),
          x: Math.round(oeste ? a.x + (w - larg) : a.x),
          ...(texto
            ? { tamanho: Math.round(Math.max(16, Math.min(200, tam * k))) }
            : {
                h: Math.round(nh),
                y: Math.round(norte ? a.y + (h - nh) : a.y),
              }),
        };
      }
      setEstado((e) => ({
        ...e,
        slides: e.slides.map((s, n) =>
          n === i
            ? {
                ...s,
                elementos: (s.elementos ?? []).map((el) =>
                  el.id === a.id ? { ...el, ...parcial } : el,
                ),
              }
            : s,
        ),
      }));
      return;
    }
    const x = Math.round(Math.max(-W * 0.5, Math.min(W * 0.95, a.x + dx)));
    const y = Math.round(Math.max(-H * 0.5, Math.min(H * 0.97, a.y + dy)));
    setEstado((e) => ({
      ...e,
      slides: e.slides.map((s, n) =>
        n === i
          ? {
              ...s,
              elementos: (s.elementos ?? []).map((el) =>
                el.id === a.id ? { ...el, x, y } : el,
              ),
            }
          : s,
      ),
    }));
  }
  function soltarArrasto() {
    const a = arrasto.current;
    arrasto.current = null;
    if (a?.moveu) {
      setDoc((d) => ({
        ...d,
        historico: [...d.historico.slice(-49), a.antes],
      }));
      setSujo(true);
    }
  }

  // ----------------------------------------------------------------- teclado

  useEffect(() => {
    function tecla(ev: KeyboardEvent) {
      const alvo = ev.target as HTMLElement;
      if (alvo.closest("input, textarea, select, [contenteditable]")) return;
      if (
        (ev.metaKey || ev.ctrlKey) &&
        ev.key.toLowerCase() === "z" &&
        modo === "editar"
      ) {
        ev.preventDefault();
        desfazer();
        return;
      }
      if (ev.key === "ArrowRight") irPara(i + 1);
      else if (ev.key === "ArrowLeft") irPara(i - 1);
      else if (
        (ev.key === "Delete" || ev.key === "Backspace") &&
        modo === "editar" &&
        selecionado
      ) {
        ev.preventDefault();
        mudar((e) => ({
          ...e,
          slides: e.slides.map((s, n) =>
            n === i
              ? {
                  ...s,
                  elementos: (s.elementos ?? []).filter(
                    (el) => el.id !== selecionado,
                  ),
                }
              : s,
          ),
        }));
        setSelecionado(null);
      } else if (ev.key === "Escape") {
        setSelecionado(null);
        setPinNovo(null);
        setPinAberto(null);
      }
    }
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  });

  // Fechar a aba com edição aberta.
  useEffect(() => {
    if (!sujo) return;
    const f = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", f);
    return () => window.removeEventListener("beforeunload", f);
  }, [sujo]);

  // ----------------------------------------------------------------- tela cheia

  useEffect(() => {
    const f = () => setTelaCheia(document.fullscreenElement === caixa.current);
    document.addEventListener("fullscreenchange", f);
    return () => document.removeEventListener("fullscreenchange", f);
  }, []);
  function alternarTelaCheia() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else
      void caixa.current
        ?.requestFullscreen?.()
        .catch(() => setAviso("O navegador não deixou abrir em tela cheia."));
  }

  // ----------------------------------------------------------------- comentários

  const daVersao = useMemo(
    () => comentarios.filter((c) => c.versaoId === versao?.id),
    [comentarios, versao?.id],
  );
  const abertos = daVersao.filter((c) => !c.resolvido).length;
  const numeroDe = useMemo(
    () => new Map(daVersao.map((c, n) => [c.id, n + 1])),
    [daVersao],
  );

  function cliqueNoSlide(ev: React.MouseEvent<HTMLDivElement>) {
    if (modo === "editar" && ev.target === ev.currentTarget)
      setSelecionado(null);
    if (modo !== "comentar") return;
    if ((ev.target as HTMLElement).closest(".cx-pin, .cx-pin-caixa")) return;
    const r = ev.currentTarget.getBoundingClientRect();
    setPinAberto(null);
    setPinNovo({
      x: (ev.clientX - r.left) / r.width,
      y: (ev.clientY - r.top) / r.height,
    });
  }

  function abrirComentario(c: ComentarioPeca) {
    setModo("comentar");
    setIndice(c.slide);
    setPinNovo(null);
    setPinAberto(c.id);
  }

  // ----------------------------------------------------------------- salvar versão

  async function salvarVersao(descricao: string): Promise<string | null> {
    const r = await salvarVersaoAcao(peca.id, { descricao, conteudo: estado });
    if (r.erro !== null) return r.erro;
    setSujo(false);
    setDoc((d) => ({ ...d, historico: [] }));
    setVersaoId(r.versaoId);
    router.refresh();
    return null;
  }

  if (!versao || !slide)
    return (
      <p className="cx-dica">
        Esta peça ainda não tem slides. Volte quando a Editora Pauta terminar.
      </p>
    );

  const elSel =
    (slide.elementos ?? []).find((e) => e.id === selecionado) ?? null;
  const api: ApiVisualizador = {
    peca,
    versao,
    estado,
    indice: i,
    irPara,
    sujo,
    modo,
    setModo,
    comentarios: daVersao,
    abrirComentario,
    trocarVersao,
    nomeNegocio,
    mudarSlides: (fn) => mudar((e) => ({ ...e, slides: fn(e.slides) })),
    selecionado: elSel,
    comparar: () => {
      const outra =
        peca.versoes.find((v) => v.principal && v.id !== versao.id) ??
        peca.versoes.find((v) => v.id !== versao.id);
      if (outra)
        setComparando([
          outra.numero < versao.numero ? outra.id : versao.id,
          outra.numero < versao.numero ? versao.id : outra.id,
        ]);
    },
  };

  return (
    <div
      className="cx-vz"
      data-modo={modo}
      data-tela-cheia={telaCheia ? "" : undefined}
      ref={caixa}
    >
      <div className="cx-vz-topo">
        <div className="cx-vz-modos" role="radiogroup" aria-label="Modo">
          {(
            [
              ["ver", "Visualizar", Eye],
              ["editar", "Editar", PenLine],
              ["comentar", "Comentar", MessageCircle],
            ] as const
          ).map(([m, rotulo, Icone]) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={modo === m}
              className="cx-vz-modo"
              onClick={() => {
                if (m === "comentar" && modo !== "comentar")
                  setDicaComentar((n) => n + 1);
                setModo(m);
                setSelecionado(null);
                setEditando(null);
                setPinNovo(null);
              }}
            >
              <Icone size={17} strokeWidth={1.8} aria-hidden="true" />
              {rotulo}
              {m === "comentar" && abertos ? (
                <span
                  className="cx-vz-conta"
                  aria-label={`${abertos} comentários abertos`}
                >
                  {abertos}
                </span>
              ) : null}
            </button>
          ))}
        </div>
        <div className="cx-vz-topo-dir">
          <span className="cx-vz-versao-chip">
            v{versao.numero}
            {versao.principal ? <span> · principal</span> : null}
            {sujo ? <span className="cx-vz-sujo"> · não salva</span> : null}
          </span>
          {peca.versoes.length > 1 ? (
            <button
              type="button"
              className="cx-botao cx-botao--branco cx-vz-comparar"
              onClick={api.comparar}
              aria-pressed={!!comparando}
            >
              <Columns2 size={17} strokeWidth={1.8} aria-hidden="true" />{" "}
              Comparar
            </button>
          ) : null}
          {topo?.(api)}
          <button
            type="button"
            className="cx-icone-botao"
            onClick={alternarTelaCheia}
            aria-label={telaCheia ? "Sair da tela cheia" : "Tela cheia"}
            title={telaCheia ? "Sair da tela cheia" : "Tela cheia"}
          >
            {telaCheia ? (
              <Minimize2 size={18} strokeWidth={1.8} aria-hidden="true" />
            ) : (
              <Maximize2 size={18} strokeWidth={1.8} aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {aviso ? (
        <p role="alert" className="cx-aviso cx-aviso--erro cx-vz-aviso">
          {aviso}
        </p>
      ) : null}

      <div className="cx-vz-grade">
        {comparando ? (
          <div className="cx-vz-centro cx-vz-centro--comparar">
            <Comparador
              versoes={peca.versoes}
              inicial={comparando}
              nomeNegocio={nomeNegocio}
              onFechar={() => setComparando(null)}
            />
          </div>
        ) : (
          <div
            className="cx-vz-centro"
            style={{ ["--proporcao" as string]: `${W / H}` }}
          >
            {modo === "comentar" && dicaComentar ? (
              <p key={dicaComentar} className="cx-vz-dica" role="status">
                <CheckCircle2 size={18} strokeWidth={2} aria-hidden="true" />
                Clique em qualquer ponto do slide para comentar.
              </p>
            ) : null}
            {/* Ambiente: o próprio slide, bem desfocado, tinge o palco. */}
            <div className="cx-vz-ambiente" aria-hidden="true">
              <SlideVista
                slide={slide}
                indice={i}
                total={total}
                marca={estado.marca}
                nomeNegocio={nomeNegocio}
              />
            </div>
            <div className="cx-vz-palco">
              {/* Vizinhos espiando nas laterais: mostram que tem mais e levam até eles. */}
              {[i - 1, i + 1].map((n) =>
                n >= 0 && n < total ? (
                  <button
                    key={n < i ? "ant" : "prox"}
                    type="button"
                    tabIndex={-1}
                    aria-hidden="true"
                    className={`cx-vz-vizinho cx-vz-vizinho--${n < i ? "ant" : "prox"}`}
                    onClick={() => irPara(n)}
                  >
                    <SlideVista
                      slide={estado.slides[n]}
                      indice={n}
                      total={total}
                      marca={estado.marca}
                      nomeNegocio={nomeNegocio}
                    />
                  </button>
                ) : null,
              )}
              <button
                type="button"
                className="cx-vz-seta cx-vz-seta--ant"
                onClick={() => irPara(i - 1)}
                disabled={i === 0}
                aria-label="Slide anterior"
              >
                <ChevronLeft size={22} strokeWidth={1.8} aria-hidden="true" />
              </button>
              <div
                className="cx-vz-slide"
                ref={slideRef}
                style={{ ["--proporcao" as string]: `${W / H}` }}
                onClick={cliqueNoSlide}
                onPointerMove={moverArrasto}
                onPointerUp={soltarArrasto}
                onPointerCancel={soltarArrasto}
              >
                <SlideVista
                  slide={slide}
                  indice={i}
                  total={total}
                  marca={estado.marca}
                  nomeNegocio={nomeNegocio}
                  rotulo={`Slide ${i + 1} de ${total}: ${slide.titulo}`}
                  edicao={edicao}
                />
                {modo === "comentar" ||
                daVersao.some((c) => c.slide === i && !c.resolvido) ? (
                  <ComentariosDoSlide
                    comentarios={daVersao.filter((c) => c.slide === i)}
                    numeroDe={numeroDe}
                    ativo={modo === "comentar"}
                    aberto={pinAberto}
                    setAberto={(id) => {
                      setModo("comentar");
                      setPinNovo(null);
                      setPinAberto(id);
                    }}
                    novo={pinNovo}
                    cancelarNovo={() => setPinNovo(null)}
                    versaoId={versao.id}
                    slide={i}
                    onCriado={(c) => {
                      setComentarios((l) => [...l, c]);
                      setPinNovo(null);
                      setPinAberto(c.id);
                    }}
                    onMudou={(id, parcial) =>
                      setComentarios((l) =>
                        parcial === null
                          ? l.filter((c) => c.id !== id)
                          : l.map((c) =>
                              c.id === id ? { ...c, ...parcial } : c,
                            ),
                      )
                    }
                  />
                ) : null}
              </div>
              <button
                type="button"
                className="cx-vz-seta cx-vz-seta--prox"
                onClick={() => irPara(i + 1)}
                disabled={i >= total - 1}
                aria-label="Próximo slide"
              >
                <ChevronRight size={22} strokeWidth={1.8} aria-hidden="true" />
              </button>
            </div>

            <p className="cx-vz-posicao" aria-live="polite">
              {i + 1} de {total}
              {modo === "comentar" ? (
                <span> · clique no slide para comentar</span>
              ) : null}
              {modo === "editar" && !selecionado ? (
                <span> · arraste os elementos; duplo clique edita o texto</span>
              ) : null}
            </p>

            {modo === "editar" ? (
              <BarraEdicao
                selecionado={elSel}
                podeDesfazer={historico.length > 0}
                sujo={sujo}
                marca={estado.marca}
                formato={{ W, H }}
                onMudarElemento={(parcial) =>
                  elSel && mudarElemento(elSel.id, parcial)
                }
                onAdicionar={(el) => {
                  mudar((e) => ({
                    ...e,
                    slides: e.slides.map((s, n) =>
                      n === i
                        ? { ...s, elementos: [...(s.elementos ?? []), el] }
                        : s,
                    ),
                  }));
                  setSelecionado(el.id);
                }}
                onExcluir={() => {
                  if (!elSel) return;
                  mudar((e) => ({
                    ...e,
                    slides: e.slides.map((s, n) =>
                      n === i
                        ? {
                            ...s,
                            elementos: (s.elementos ?? []).filter(
                              (el) => el.id !== elSel.id,
                            ),
                          }
                        : s,
                    ),
                  }));
                  setSelecionado(null);
                }}
                onDesfazer={desfazer}
                onDescartar={descartar}
                onSalvar={salvarVersao}
                onAviso={setAviso}
                indice={i}
                extraImagem={extraImagem?.(api)}
              />
            ) : null}

            <MiniaturasEdicao
              slides={estado.slides}
              marca={estado.marca}
              nomeNegocio={nomeNegocio}
              atual={i}
              editando={modo === "editar"}
              comentariosPorSlide={daVersao.reduce<Record<number, number>>(
                (m, c) => {
                  if (!c.resolvido) m[c.slide] = (m[c.slide] ?? 0) + 1;
                  return m;
                },
                {},
              )}
              irPara={irPara}
              onMudar={(slides, novoIndice) => {
                mudar((e) => ({ ...e, slides }));
                if (novoIndice !== undefined) setIndice(novoIndice);
              }}
            />
          </div>
        )}

        <aside className="cx-vz-painel" aria-label="Sobre a peça">
          {painel(api)}
        </aside>
      </div>
    </div>
  );
}
