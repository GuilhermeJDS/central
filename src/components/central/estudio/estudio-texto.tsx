"use client";

/**
 * Peça de texto aberta no estúdio (roteiro de Reels/vídeo, post, thread,
 * títulos). Mesmo padrão do carrossel: a folha grande no meio com os modos
 * Visualizar / Editar / Comentar e Tela cheia, versões com Comparar e o
 * painel com detalhes, Copiar e o post vinculado.
 */
import { Check, Columns2, Copy, Eye, LoaderCircle, Maximize2, MessageCircle, Minimize2, PenLine, RotateCcw, Save, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { salvarVersaoAcao } from "@/app/central/acoes-estudio";
import { DetalhesPeca } from "@/components/central/estudio/painel-peca";
import { PostVinculado } from "@/components/central/estudio/post-vinculado";
import { ListaVersoes } from "@/components/central/estudio/versoes";
import { ComentariosDoSlide } from "@/components/central/estudio/visualizador-partes";
import { ROTULO_TIPO, type TipoEntrega } from "@/lib/central/entregas-tipos";
import type { ComentarioPeca, PecaDetalhe } from "@/lib/central/estudio/pecas";

type Modo = "ver" | "editar" | "comentar";

/** Divide o texto em blocos: cenas do roteiro, posts da thread, títulos. */
export function blocosDe(texto: string, tipo: TipoEntrega): string[] {
  const t = texto.trim();
  if (!t) return [];
  if (tipo === "THREAD") return t.split(/\n?-{3,}\n?/).map((b) => b.trim()).filter(Boolean);
  if (tipo === "TITULO") return t.split(/\n+/).map((b) => b.trim()).filter(Boolean);
  return t.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
}

/** "GANCHO (0–3 s): texto" → rótulo + texto. */
function rotuloDoBloco(b: string): { rotulo: string | null; corpo: string } {
  const m = /^([A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9 ]{3,40}(?:\([^)]{1,20}\))?):\s*([\s\S]*)$/.exec(b);
  return m ? { rotulo: m[1].trim(), corpo: m[2].trim() } : { rotulo: null, corpo: b };
}

function Folha({ texto, tipo }: { texto: string; tipo: TipoEntrega }) {
  const blocos = blocosDe(texto, tipo);
  if (!blocos.length) return <p className="cx-folha-vazia">Sem texto nesta versão.</p>;
  return (
    <ol className="cx-folha-blocos2" data-tipo={tipo}>
      {blocos.map((b, i) => {
        const { rotulo, corpo } = rotuloDoBloco(b);
        return (
          <li key={i}>
            <span className="cx-folha-n" aria-hidden="true">
              {tipo === "THREAD" ? `${i + 1}/${blocos.length}` : i + 1}
            </span>
            <div>
              {rotulo ? <p className="cx-folha-rotulo">{rotulo}</p> : null}
              <p className="cx-folha-corpo">{corpo}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function CompararTexto({ peca, inicial, onFechar }: { peca: PecaDetalhe; inicial: [string, string]; onFechar: () => void }) {
  const [ids, setIds] = useState(inicial);
  const lados = ids.map((id) => peca.versoes.find((v) => v.id === id));
  const blocos = lados.map((v) => blocosDe(v?.texto ?? "", peca.tipo));
  const total = Math.max(blocos[0].length, blocos[1].length);
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
        {[0, 1].map((lado) => (
          <label key={lado} className="cx-comparar-escolha">
            <span className="cx-so-leitor">{lado === 0 ? "Versão da esquerda" : "Versão da direita"}</span>
            <select
              className="cx-input cx-select"
              value={ids[lado]}
              onChange={(e) => setIds((a) => (lado === 0 ? [e.target.value, a[1]] : [a[0], e.target.value]))}
            >
              {peca.versoes.map((x) => (
                <option key={x.id} value={x.id}>
                  v{x.numero}
                  {x.principal ? " (principal)" : ""} · {x.descricao}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      {/* Linha a linha, os blocos andam juntos; o que mudou fica marcado. */}
      <ol className="cx-comparar-texto">
        {Array.from({ length: total }, (_, i) => {
          const a = blocos[0][i] ?? "";
          const b = blocos[1][i] ?? "";
          return (
            <li key={i} data-mudou={a !== b ? "" : undefined}>
              <p>{a || <span className="cx-pp-meta">—</span>}</p>
              <p>{b || <span className="cx-pp-meta">—</span>}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function EstudioTexto({ peca }: { peca: PecaDetalhe }) {
  const router = useRouter();
  const principal = peca.versoes.find((v) => v.principal) ?? peca.versoes[0];
  const [versaoId, setVersaoId] = useState(principal?.id ?? "");
  const versao = peca.versoes.find((v) => v.id === versaoId) ?? principal;
  const [modo, setModo] = useState<Modo>("ver");
  const [rascunho, setRascunho] = useState(versao?.texto ?? "");
  const [descricao, setDescricao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [comparando, setComparando] = useState<[string, string] | null>(null);
  const [telaCheia, setTelaCheia] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [comentarios, setComentarios] = useState<ComentarioPeca[]>(peca.comentarios);
  const [base, setBase] = useState(peca.comentarios);
  if (base !== peca.comentarios) {
    setBase(peca.comentarios);
    setComentarios(peca.comentarios);
  }
  const [pinNovo, setPinNovo] = useState<{ x: number; y: number } | null>(null);
  const [pinAberto, setPinAberto] = useState<string | null>(null);
  const caixa = useRef<HTMLDivElement>(null);
  const sujo = modo === "editar" && rascunho !== (versao?.texto ?? "");
  const daVersao = useMemo(() => comentarios.filter((c) => c.versaoId === versao?.id), [comentarios, versao?.id]);
  const numeroDe = useMemo(() => new Map(daVersao.map((c, n) => [c.id, n + 1])), [daVersao]);
  const abertos = daVersao.filter((c) => !c.resolvido).length;

  useEffect(() => {
    const f = () => setTelaCheia(document.fullscreenElement === caixa.current);
    document.addEventListener("fullscreenchange", f);
    return () => document.removeEventListener("fullscreenchange", f);
  }, []);
  useEffect(() => {
    if (!sujo) return;
    const f = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", f);
    return () => window.removeEventListener("beforeunload", f);
  }, [sujo]);

  if (!versao) return <p className="cx-dica">Esta peça ainda não tem texto.</p>;

  function trocarVersao(id: string) {
    if (sujo) {
      setAviso("Salve a versão ou descarte as mudanças antes de abrir outra.");
      return;
    }
    const v = peca.versoes.find((x) => x.id === id);
    if (!v) return;
    setVersaoId(id);
    setRascunho(v.texto ?? "");
    setAviso(null);
  }

  async function salvar() {
    setSalvando(true);
    const r = await salvarVersaoAcao(peca.id, { descricao: descricao.trim() || "Texto ajustado", texto: rascunho });
    setSalvando(false);
    if (r.erro !== null) setAviso(r.erro);
    else {
      setVersaoId(r.versaoId);
      setDescricao("");
      setModo("ver");
      router.refresh();
    }
  }

  const apiVersoes = { peca, versao, trocarVersao, sujo };
  const comparar = () => {
    const outra = peca.versoes.find((v) => v.id !== versao.id);
    if (outra) setComparando(outra.numero < versao.numero ? [outra.id, versao.id] : [versao.id, outra.id]);
  };

  return (
    <div className="cx-vz" data-modo={modo} data-tela-cheia={telaCheia ? "" : undefined} ref={caixa}>
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
                if (modo === "editar" && m !== "editar" && sujo) {
                  setAviso("Salve a versão ou descarte as mudanças antes de sair do Editar.");
                  return;
                }
                setModo(m);
                setPinNovo(null);
              }}
            >
              <Icone size={17} strokeWidth={1.8} aria-hidden="true" />
              {rotulo}
              {m === "comentar" && abertos ? <span className="cx-vz-conta">{abertos}</span> : null}
            </button>
          ))}
        </div>
        <div className="cx-vz-topo-dir">
          <span className="cx-vz-versao-chip">
            v{versao.numero}
            {versao.principal ? " · principal" : ""}
            {sujo ? <span className="cx-vz-sujo"> · não salva</span> : null}
          </span>
          {peca.versoes.length > 1 ? (
            <button type="button" className="cx-botao cx-botao--branco cx-vz-comparar" onClick={comparar} aria-pressed={!!comparando}>
              <Columns2 size={17} strokeWidth={1.8} aria-hidden="true" /> Comparar
            </button>
          ) : null}
          <button
            type="button"
            className="cx-icone-botao"
            onClick={() => (document.fullscreenElement ? void document.exitFullscreen() : void caixa.current?.requestFullscreen?.())}
            aria-label={telaCheia ? "Sair da tela cheia" : "Tela cheia"}
          >
            {telaCheia ? <Minimize2 size={18} strokeWidth={1.8} aria-hidden="true" /> : <Maximize2 size={18} strokeWidth={1.8} aria-hidden="true" />}
          </button>
        </div>
      </div>
      {aviso ? (
        <p role="alert" className="cx-aviso cx-aviso--erro cx-vz-aviso">
          {aviso}
        </p>
      ) : null}

      <div className="cx-vz-grade">
        <div className="cx-vz-centro">
          {comparando ? (
            <CompararTexto peca={peca} inicial={comparando} onFechar={() => setComparando(null)} />
          ) : (
            <>
              <div
                className="cx-folha2"
                onClick={(e) => {
                  if (modo !== "comentar" || (e.target as HTMLElement).closest(".cx-pin, .cx-pin-caixa")) return;
                  const r = e.currentTarget.getBoundingClientRect();
                  setPinAberto(null);
                  setPinNovo({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height });
                }}
              >
                <p className="cx-folha2-tipo">{ROTULO_TIPO[peca.tipo]}</p>
                <h2 className="cx-folha2-titulo">{peca.titulo}</h2>
                {modo === "editar" ? (
                  <textarea
                    className="cx-folha2-editor"
                    value={rascunho}
                    aria-label="Texto da peça"
                    onChange={(e) => setRascunho(e.target.value)}
                    rows={Math.max(10, rascunho.split("\n").length + 2)}
                    autoFocus
                  />
                ) : (
                  <Folha texto={versao.texto ?? ""} tipo={peca.tipo} />
                )}
                {modo !== "editar" ? (
                  <ComentariosDoSlide
                    comentarios={daVersao}
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
                    slide={0}
                    onCriado={(c) => {
                      setComentarios((l) => [...l, c]);
                      setPinNovo(null);
                      setPinAberto(c.id);
                    }}
                    onMudou={(id, parcial) =>
                      setComentarios((l) =>
                        parcial === null ? l.filter((c) => c.id !== id) : l.map((c) => (c.id === id ? { ...c, ...parcial } : c)),
                      )
                    }
                  />
                ) : null}
              </div>
              {modo === "comentar" ? <p className="cx-vz-posicao">Clique em qualquer ponto da folha para comentar.</p> : null}
              {modo === "editar" ? (
                <div className="cx-ed-barra" role="toolbar" aria-label="Salvar">
                  <label className="cx-campo cx-texto-desc">
                    <span className="cx-so-leitor">O que mudou</span>
                    <input
                      className="cx-input"
                      value={descricao}
                      maxLength={160}
                      placeholder="O que mudou? (ex.: gancho mais curto)"
                      onChange={(e) => setDescricao(e.target.value)}
                    />
                  </label>
                  <div className="cx-ed-fim">
                    {sujo ? (
                      <button type="button" className="cx-ed-botao" onClick={() => setRascunho(versao.texto ?? "")}>
                        <RotateCcw size={16} strokeWidth={1.8} aria-hidden="true" /> Descartar
                      </button>
                    ) : null}
                    <button type="button" className="cx-botao cx-botao--azul cx-ed-salvar-botao" disabled={!sujo || salvando} onClick={salvar}>
                      {salvando ? <LoaderCircle size={16} className="cx-girando" aria-hidden="true" /> : <Save size={17} strokeWidth={1.8} aria-hidden="true" />}
                      Salvar versão
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>

        <aside className="cx-vz-painel" aria-label="Sobre a peça">
          <div className="cx-pp">
            <DetalhesPeca peca={peca} />
            <section className="cx-pp-secao" aria-label="Copiar">
              <button
                type="button"
                className="cx-botao cx-botao--azul cx-pp-largo"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(versao.texto ?? "");
                    setCopiado(true);
                    setTimeout(() => setCopiado(false), 1800);
                  } catch {
                    setCopiado(false);
                  }
                }}
              >
                {copiado ? <Check size={16} strokeWidth={2} aria-hidden="true" /> : <Copy size={16} strokeWidth={1.8} aria-hidden="true" />}
                {copiado ? "Copiado" : `Copiar ${peca.tipo === "TITULO" ? "os títulos" : "o texto"}`}
              </button>
              <p className="cx-pp-meta">
                {(versao.texto ?? "").length.toLocaleString("pt-BR")} caracteres · {blocosDe(versao.texto ?? "", peca.tipo).length}{" "}
                {peca.tipo === "ROTEIRO" ? "cenas" : peca.tipo === "THREAD" ? "posts" : peca.tipo === "TITULO" ? "títulos" : "parágrafos"}
              </p>
            </section>
            <PostVinculado peca={peca} />
            <ListaVersoes api={apiVersoes} onComparar={comparar} />
          </div>
        </aside>
      </div>
    </div>
  );
}
