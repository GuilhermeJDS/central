"use client";

import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type PanInfo,
  type Variants,
} from "motion/react";
import { ArrowLeft, ArrowUpRight, Check, Copy, CornerUpLeft, Maximize2, PenLine, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";

import { decidirAcao, desfazerDecisaoAcao } from "@/app/central/acoes-decisoes";
import { Corrente, VeioDe } from "@/components/central/veio-de";
import { ChipChefe, MarcaChefe, aoChefe } from "@/components/central/chefe";
import { Resultado } from "@/components/central/resultado";
import type { DecisaoView, EstadoDecisao } from "@/components/central/tipos";
import { useTrava } from "@/components/central/trava";
import { mudarPendentes, usePendentes } from "@/components/central/contador-decisoes";

/**
 * Decisões em pilha (DESIGN.md 6.2: pilha de cartas). Uma carta por vez:
 * arrastar para a direita aprova, para a esquerda passa, "Quase?" abre o
 * ajuste, "Voltar" desfaz a última. Teclado: ← passa, → aprova, Z desfaz.
 * Gesto: posição 1:1 com o dedo; ao soltar, mola com a velocidade do gesto.
 */

type Feita = {
  d: DecisaoView;
  estado: Exclude<EstadoDecisao, "pendente">;
  lado: -1 | 1 | 0;
};
type Vista = "pilha" | "aprovada" | "passada";

const LIMITE_PX = 120;

/** Saída: para o lado do gesto (mola) ou para cima no ajuste; só some com movimento reduzido. */
const SAIDA: Variants = {
  sumir: { opacity: 0, transition: { duration: 0.15 } },
  sair: (dir: number) =>
    dir === 0
      ? {
          y: -60,
          opacity: 0,
          transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
        }
      : {
          x: dir * 720,
          rotate: dir * 16,
          opacity: 0,
          transition: { type: "spring", stiffness: 260, damping: 32 },
        },
};
const LIMITE_VEL = 600;
const fmtQuando = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "numeric",
  month: "short",
});

function Carta({
  d,
  topo,
  profundidade,
  lado,
  ajustando,
  ocupado,
  aoSoltar,
  aoCancelarAjuste,
  aoEnviarAjuste,
  aoAbrir,
}: {
  d: DecisaoView;
  topo: boolean;
  profundidade: number;
  lado: number;
  ajustando: boolean;
  ocupado: boolean;
  aoSoltar: (lado: -1 | 1) => boolean;
  aoCancelarAjuste: () => void;
  aoEnviarAjuste: (texto: string) => void;
  aoAbrir: () => void;
}) {
  const reduzir = useReducedMotion();
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-320, 0, 320], [-10, 0, 10]);
  const opSim = useTransform(x, [24, LIMITE_PX], [0, 1]);
  const opNao = useTransform(x, [-LIMITE_PX, -24], [1, 0]);
  const [texto, setTexto] = useState("");

  function soltar(_: unknown, info: PanInfo) {
    const passou =
      Math.abs(info.offset.x) > LIMITE_PX ||
      Math.abs(info.velocity.x) > LIMITE_VEL;
    const dir = (info.offset.x + info.velocity.x * 0.1 > 0 ? 1 : -1) as -1 | 1;
    if (passou && aoSoltar(dir)) return;
    // Não passou do limite (ou a trava segurou): volta rápido, com mola.
    animate(x, 0, {
      type: "spring",
      stiffness: 600,
      damping: 38,
      velocity: info.velocity.x,
    });
  }

  return (
    <motion.article
      className="cx-carta"
      data-topo={topo ? "true" : "false"}
      aria-hidden={topo ? undefined : true}
      style={topo ? { x, rotate, zIndex: 10 } : { zIndex: 10 - profundidade }}
      drag={topo && !ajustando && !ocupado ? "x" : false}
      dragSnapToOrigin={false}
      dragMomentum={false}
      onDragEnd={soltar}
      onTap={(e) => {
        if (!topo || ajustando) return;
        // Botões e o formulário de ajuste têm a própria ação.
        if (e.target instanceof Element && e.target.closest("button, a, textarea, form")) return;
        aoAbrir();
      }}
      custom={lado}
      initial={
        reduzir
          ? { opacity: 0 }
          : lado
            ? { x: lado * 640, rotate: lado * 14, opacity: 0 }
            : {
                scale: 1 - (profundidade + 1) * 0.04,
                y: (profundidade + 1) * 14,
                opacity: 0,
              }
      }
      animate={{
        scale: 1 - profundidade * 0.04,
        y: profundidade * 14,
        opacity: profundidade > 2 ? 0 : 1,
        ...(topo && lado ? { x: 0, rotate: 0 } : {}),
      }}
      variants={SAIDA}
      exit={reduzir ? "sumir" : "sair"}
      transition={{ type: "spring", stiffness: 380, damping: 34 }}
    >
      {topo ? (
        <>
          <motion.span
            className="cx-carta-selo cx-carta-selo--sim"
            style={{ opacity: opSim }}
            aria-hidden="true"
          >
            Aprovar
          </motion.span>
          <motion.span
            className="cx-carta-selo cx-carta-selo--nao"
            style={{ opacity: opNao }}
            aria-hidden="true"
          >
            Passar
          </motion.span>
        </>
      ) : null}

      <header className="cx-carta-topo">
        <MarcaChefe nome={d.chefe} tamanho={44} />
        <div className="cx-carta-quem">
          <span className="cx-carta-chefe">{d.chefe}</span>
          <span className="cx-carta-meta">
            {d.departamento ? `${d.departamento} · ` : ""}
            <time dateTime={d.em}>{fmtQuando.format(new Date(d.em))}</time>
          </span>
        </div>
      </header>

      <h2 className="cx-carta-titulo">{d.titulo}</h2>
      {d.porQue ? <p className="cx-carta-porque">{d.porQue}</p> : null}
      {d.fontes?.length ? <VeioDe fontes={d.fontes} /> : null}
      {d.cadeia?.length ? <Corrente cadeia={d.cadeia} /> : null}

      {d.conteudo ? (
        <div
          className="cx-carta-conteudo"
          onPointerDownCapture={(e) => ajustando && e.stopPropagation()}
        >
          <Resultado texto={d.conteudo} compacto />
        </div>
      ) : null}

      {topo && !ajustando ? (
        <button type="button" className="cx-carta-ler" onClick={aoAbrir}>
          <Maximize2 size={16} strokeWidth={1.8} aria-hidden="true" />
          Ver tudo
        </button>
      ) : null}

      {topo && ajustando ? (
        <form
          className="cx-carta-ajuste"
          onSubmit={(e) => {
            e.preventDefault();
            aoEnviarAjuste(texto);
          }}
        >
          <label className="cx-campo-rotulo" htmlFor={`ajuste-${d.id}`}>
            O que mudar?
          </label>
          <textarea
            id={`ajuste-${d.id}`}
            className="cx-input"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") aoCancelarAjuste();
            }}
            maxLength={2000}
            rows={3}
            autoFocus
            placeholder="Ex.: mais curto, sem falar de preço."
          />
          <div className="cx-botoes">
            <button
              type="submit"
              className="cx-botao cx-botao--azul"
              disabled={ocupado || texto.trim().length < 3}
            >
              Pedir ajuste {aoChefe(d.chefe)}
            </button>
            <button
              type="button"
              className="cx-botao cx-botao--fantasma-escuro"
              onClick={aoCancelarAjuste}
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : null}
    </motion.article>
  );
}

/** Subtítulo da página que anda junto com a pilha (mesmo contador da barra lateral). */
export function SubtituloDecisoes({ pendentes }: { pendentes: number }) {
  const n = usePendentes(pendentes);
  return (
    <>
      {n
        ? `${n} ${n === 1 ? "trabalho pronto esperando" : "trabalhos prontos esperando"} o seu sim.`
        : "Tudo decidido por enquanto."}
    </>
  );
}

export function PilhaDecisoes({
  itens,
  exemplo,
}: {
  itens: DecisaoView[];
  exemplo: boolean;
}) {
  const trava = useTrava();
  const [fila] = useState(() => itens.filter((d) => d.estado === "pendente"));
  const [antigas] = useState(() =>
    itens.filter((d) => d.estado !== "pendente"),
  );
  const [feitas, setFeitas] = useState<Feita[]>([]);
  const [lado, setLado] = useState<-1 | 0 | 1>(0);
  const [ajustando, setAjustando] = useState(false);
  const [vista, setVista] = useState<Vista>("pilha");
  const [aviso, setAvisoTexto] = useState<string | null>(null);
  // Aviso de sucesso (produção agendada) não pinta de vermelho.
  const [avisoOk, setAvisoOk] = useState(false);
  const [avisoLink, setAvisoLink] = useState<{ rotulo: string; href: string } | null>(null);
  const setAviso = (t: string | null, ok = false, link: { rotulo: string; href: string } | null = null) => {
    setAvisoTexto(t);
    setAvisoOk(ok);
    setAvisoLink(link);
  };
  const [lendo, setLendo] = useState(false);
  // O aviso "Foi para … · Abrir" some sozinho depois de uns segundos.
  useEffect(() => {
    if (!avisoLink) return;
    const t = setTimeout(() => {
      setAvisoTexto(null);
      setAvisoLink(null);
    }, 7000);
    return () => clearTimeout(t);
  }, [avisoLink]);
  const [ocupado, iniciar] = useTransition();

  const pos = feitas.length;
  const restantes = fila.slice(pos);
  const atual = restantes[0] ?? null;
  const ultima = feitas[feitas.length - 1] ?? null;
  const podeVoltar = !!ultima && ultima.estado !== "ajuste" && !ocupado;

  function decidir(
    estado: Feita["estado"],
    dir: -1 | 0 | 1,
    ajuste?: string,
  ): boolean {
    if (!atual || ocupado) return false;
    if (estado === "ajuste" ? trava.bloquear() : trava.travado) {
      if (estado !== "ajuste") trava.abrir();
      return false;
    }
    const d = atual;
    setAviso(exemplo ? "Exemplo: nada foi enviado." : null);
    setAjustando(false);
    setLendo(false);
    if (!exemplo) mudarPendentes(-1);
    setLado(dir);
    setFeitas((f) => [...f, { d, estado, lado: dir }]);
    if (!exemplo) {
      const decisao =
        estado === "aprovada"
          ? "APROVADA"
          : estado === "passada"
            ? "PASSADA"
            : "AJUSTAR";
      iniciar(async () => {
        const r = await decidirAcao(d.id, decisao, ajuste);
        if (r.destino) {
          setAviso(`Foi para ${r.destino.rotulo}`, true, {
            rotulo: "Abrir",
            href: r.destino.href,
          });
        } else if (r.producao) {
          setAviso(
            `Aprovado. ${r.producao.tipo} em produção: fica pronto em ${r.producao.departamento || "o departamento"} › Entregas.`,
            true,
          );
        }
        if (r.erro) {
          mudarPendentes(1);
          setAviso(r.erro);
          setLado(dir === 0 ? 1 : dir);
          setFeitas((f) => f.filter((x) => x.d.id !== d.id));
        }
      });
    }
    return true;
  }

  function voltar() {
    if (!podeVoltar || !ultima) return;
    setAjustando(false);
    setLado(ultima.lado === 0 ? 1 : ultima.lado);
    setFeitas((f) => f.slice(0, -1));
    setAviso(null);
    if (!exemplo) {
      mudarPendentes(1);
      iniciar(async () => {
        const r = await desfazerDecisaoAcao(ultima.d.id);
        if (r.erro) {
          mudarPendentes(-1);
          setAviso(r.erro);
          setFeitas((f) => [...f, ultima]);
        }
      });
    }
  }

  // Os atalhos leem sempre a versão atual de decidir/voltar.
  const atalhos = useRef({ decidir, voltar });
  useEffect(() => {
    atalhos.current = { decidir, voltar };
  });

  // Teclado: ← passa, → aprova, Z desfaz (fora de campos de texto).
  useEffect(() => {
    if (vista !== "pilha") return;
    function tecla(e: KeyboardEvent) {
      const alvo = e.target instanceof Element ? e.target : null;
      if (
        alvo?.closest("input, textarea, select, [contenteditable]") ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey
      )
        return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        atalhos.current.decidir("aprovada", 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        atalhos.current.decidir("passada", -1);
      } else if (e.key === "z" || e.key === "Z") {
        e.preventDefault();
        atalhos.current.voltar();
      } else if (e.key === "Escape") {
        setLendo(false);
      }
    }
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [vista]);

  const decididas = (estado: "aprovada" | "passada") => [
    ...[...feitas]
      .reverse()
      .filter((f) => f.estado === estado)
      .map((f) => f.d),
    ...antigas.filter((d) => d.estado === estado),
  ];
  const nAprovadas = decididas("aprovada").length;
  const nPassadas = decididas("passada").length;
  const textoAnuncio = atual
    ? `Decisão ${pos + 1} de ${fila.length}: ${atual.titulo}`
    : "Tudo decidido.";

  return (
    <div className="cx-decisoes">
      <div className="cx-decisoes-barra">
        <p className="cx-contagem" aria-hidden="true">
          {fila.length ? (
            <>
              <strong>{Math.min(pos + 1, fila.length)}</strong> de {fila.length}
            </>
          ) : (
            "Nada pendente"
          )}
        </p>
        <div
          className="cx-decisoes-filtros"
          role="group"
          aria-label="Ver decididas"
        >
          <button
            type="button"
            aria-pressed={vista === "aprovada"}
            onClick={() =>
              setVista(vista === "aprovada" ? "pilha" : "aprovada")
            }
          >
            Aprovadas <span>{nAprovadas}</span>
          </button>
          <button
            type="button"
            aria-pressed={vista === "passada"}
            onClick={() => setVista(vista === "passada" ? "pilha" : "passada")}
          >
            Passadas <span>{nPassadas}</span>
          </button>
        </div>
      </div>
      <p className="cx-so-leitor" aria-live="polite">
        {vista === "pilha" ? textoAnuncio : ""}
      </p>

      {vista === "pilha" ? (
        <>
          {lendo && atual ? (
            <Leitura d={atual} aoVoltar={() => setLendo(false)} aoAprovar={() => decidir("aprovada", 1)} ocupado={ocupado} />
          ) : null}
          <div className="cx-pilha-cartas" hidden={lendo && !!atual}>
            <AnimatePresence custom={lado} initial={false}>
              {restantes.slice(0, 3).map((d, i) => (
                <Carta
                  key={d.id}
                  d={d}
                  topo={i === 0}
                  profundidade={i}
                  lado={i === 0 ? lado : 0}
                  ajustando={ajustando}
                  ocupado={ocupado}
                  aoSoltar={(dir) =>
                    decidir(dir === 1 ? "aprovada" : "passada", dir)
                  }
                  aoCancelarAjuste={() => setAjustando(false)}
                  aoEnviarAjuste={(t) => decidir("ajuste", 0, t)}
                  aoAbrir={() => setLendo(true)}
                />
              ))}
            </AnimatePresence>
            {!atual ? (
              <div className="cx-pilha-vazia">
                <span className="cx-pilha-vazia-icone" aria-hidden="true">
                  <Check size={28} strokeWidth={1.8} />
                </span>
                <p className="cx-pilha-vazia-titulo">Tudo decidido.</p>
                <p className="cx-dica">
                  Quando um chefe terminar um trabalho, ele entra nesta pilha.
                </p>
              </div>
            ) : null}
          </div>

          <div className="cx-pilha-controles">
            <button
              type="button"
              className="cx-controle cx-controle--pequeno"
              onClick={voltar}
              disabled={!podeVoltar}
            >
              <CornerUpLeft size={20} strokeWidth={1.8} aria-hidden="true" />
              <span>Voltar</span>
            </button>
            <button
              type="button"
              className="cx-controle cx-controle--nao"
              onClick={() => decidir("passada", -1)}
              disabled={!atual || ocupado || ajustando}
            >
              <X size={28} strokeWidth={2} aria-hidden="true" />
              <span>Passar</span>
            </button>
            <button
              type="button"
              className="cx-controle cx-controle--quase"
              onClick={() =>
                trava.bloquear() ? undefined : setAjustando((a) => !a)
              }
              disabled={!atual || ocupado}
              aria-expanded={ajustando}
            >
              <PenLine size={22} strokeWidth={1.8} aria-hidden="true" />
              <span>Quase?</span>
            </button>
            <button
              type="button"
              className="cx-controle cx-controle--sim"
              onClick={() => decidir("aprovada", 1)}
              disabled={!atual || ocupado || ajustando}
            >
              <Check size={28} strokeWidth={2} aria-hidden="true" />
              <span>Aprovar</span>
            </button>
          </div>
          <p className="cx-pilha-atalhos" aria-hidden="true">
            <kbd>←</kbd> passa <kbd>→</kbd> aprova <kbd>Z</kbd> desfaz
          </p>
          <p
            className={`cx-pilha-aviso${aviso && !exemplo && !avisoOk ? " cx-erro" : ""}${avisoLink ? " cx-pilha-aviso--destino" : ""}`}
            role="status"
          >
            {avisoLink ? <Check size={16} strokeWidth={2.2} aria-hidden="true" /> : null}
            {aviso}
            {avisoLink ? (
              <>
                <span aria-hidden="true"> · </span>
                <Link href={avisoLink.href} className="cx-pilha-aviso-link">
                  {avisoLink.rotulo}
                  <ArrowUpRight size={15} strokeWidth={2} aria-hidden="true" />
                </Link>
              </>
            ) : null}
          </p>
        </>
      ) : (
        <ListaDecididas
          titulo={vista === "aprovada" ? "Aprovadas" : "Passadas"}
          itens={decididas(vista)}
          aoFechar={() => setVista("pilha")}
        />
      )}
    </div>
  );
}

/** Leitura completa da carta do topo: painel grande, rolagem própria. */
function Leitura({
  d,
  aoVoltar,
  aoAprovar,
  ocupado,
}: {
  d: DecisaoView;
  aoVoltar: () => void;
  aoAprovar: () => void;
  ocupado: boolean;
}) {
  const titulo = useRef<HTMLHeadingElement>(null);
  const [copiado, setCopiado] = useState(false);
  async function copiar() {
    try {
      await navigator.clipboard.writeText((d.conteudo || d.titulo).replace(/\*\*|__|`/g, ""));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      setCopiado(false);
    }
  }
  useEffect(() => {
    titulo.current?.focus();
  }, []);
  return (
    <section className="cx-leitura" aria-labelledby={`leitura-${d.id}`}>
      <div className="cx-leitura-barra">
        <button type="button" className="cx-botao cx-botao--suave" onClick={aoVoltar}>
          <ArrowLeft size={18} strokeWidth={1.8} aria-hidden="true" />
          Voltar para a pilha
        </button>
      </div>
      <div className="cx-leitura-rolagem">
        <header className="cx-carta-topo">
          <MarcaChefe nome={d.chefe} tamanho={44} />
          <div className="cx-carta-quem">
            <span className="cx-carta-chefe">{d.chefe}</span>
            <span className="cx-carta-meta">
              {d.departamento ? `${d.departamento} · ` : ""}
              <time dateTime={d.em}>{fmtQuando.format(new Date(d.em))}</time>
            </span>
          </div>
        </header>
        <h2 id={`leitura-${d.id}`} className="cx-leitura-titulo" ref={titulo} tabIndex={-1}>
          {d.titulo}
        </h2>
        {d.porQue ? <p className="cx-carta-porque">{d.porQue}</p> : null}
        {d.fontes?.length ? <VeioDe fontes={d.fontes} /> : null}
        {d.cadeia?.length ? <Corrente cadeia={d.cadeia} /> : null}
        {d.conteudo ? <Resultado texto={d.conteudo} /> : null}
      </div>
      <div className="cx-leitura-rodape">
        <button type="button" className="cx-botao cx-botao--azul" onClick={aoAprovar} disabled={ocupado}>
          <Check size={17} strokeWidth={2} aria-hidden="true" />
          Aprovar
        </button>
        <button type="button" className="cx-botao cx-botao--suave" onClick={copiar} aria-live="polite">
          {copiado ? <Check size={17} strokeWidth={2} aria-hidden="true" /> : <Copy size={17} strokeWidth={1.8} aria-hidden="true" />}
          {copiado ? "Copiado" : "Copiar"}
        </button>
        <button type="button" className="cx-botao cx-botao--fantasma-escuro" onClick={aoVoltar}>
          Fechar
        </button>
      </div>
    </section>
  );
}

function ListaDecididas({
  titulo,
  itens,
  aoFechar,
}: {
  titulo: string;
  itens: DecisaoView[];
  aoFechar: () => void;
}) {
  return (
    <section className="cx-decididas" aria-label={titulo}>
      <div className="cx-decididas-topo">
        <h2 className="cx-secao-titulo">{titulo}</h2>
        <button
          type="button"
          className="cx-botao cx-botao--suave"
          onClick={aoFechar}
        >
          Voltar à pilha
        </button>
      </div>
      {itens.length ? (
        <ul className="cx-decididas-lista">
          {itens.map((d) => (
            <li key={d.id}>
              <ChipChefe nome={d.chefe} />
              <span className="cx-decididas-titulo">{d.titulo}</span>
              <time dateTime={d.em}>{fmtQuando.format(new Date(d.em))}</time>
            </li>
          ))}
        </ul>
      ) : (
        <p className="cx-dica">Nenhuma ainda.</p>
      )}
    </section>
  );
}
