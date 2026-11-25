"use client";

/**
 * Desenho de um slide do estúdio em DOM. Tudo em unidades do quadro
 * (--u = 1/1080 da largura do contêiner), então o mesmo slide serve de capa
 * pequena na biblioteca e de slide grande no visualizador, sem JavaScript de
 * escala. A edição (arrastar, duplo clique) entra pelos callbacks.
 */
import {
  useEffect,
  useState,
  type CSSProperties,
  type PointerEvent as RPointerEvent,
  type ReactNode,
} from "react";

import {
  carregarFonte,
  tamanho,
  type MarcaCarrossel,
} from "@/lib/central/carrossel";
import {
  corDe,
  elementosDe,
  familiaTexto,
  estiloTexto,
  type ElementoSlide,
  type SlideEstudio,
} from "@/lib/central/estudio/slide";

const u = (v: number) => `calc(${v} * var(--u))`;

/** Carrega a fonte da marca (título + texto) uma vez; o DOM usa a mesma família do canvas. */
export function useFonteMarca(fonte: MarcaCarrossel["fonte"]): boolean {
  const [pronta, setPronta] = useState(false);
  useEffect(() => {
    let vivo = true;
    carregarFonte(fonte).then(() => vivo && setPronta(true));
    return () => {
      vivo = false;
    };
  }, [fonte]);
  return pronta;
}

export type LadoAlca = "nw" | "ne" | "sw" | "se" | "w" | "e";
const ALCAS: readonly LadoAlca[] = ["nw", "ne", "sw", "se", "w", "e"];

/** As bolinhas do elemento selecionado. */
function Alcas({ el, edicao }: { el: ElementoSlide; edicao: EdicaoSlide }) {
  // Selo tem largura automática: só os cantos (escala).
  const lados =
    el.tipo === "selo" ? ALCAS.filter((l) => l.length === 2) : ALCAS;
  return (
    <>
      {lados.map((l) => (
        <span
          key={l}
          className="cx-sl-alca"
          data-lado={l}
          aria-hidden="true"
          onPointerDown={(e) => edicao.onPointerDownAlca(e, el, l)}
          onDoubleClick={(e) => e.stopPropagation()}
        />
      ))}
    </>
  );
}

export type EdicaoSlide = {
  selecionado: string | null;
  editando: string | null;
  onPointerDownElemento: (
    e: RPointerEvent<HTMLElement>,
    el: ElementoSlide,
  ) => void;
  /** Alça de redimensionar (cantos escalam; laterais mudam a largura). */
  onPointerDownAlca: (
    e: RPointerEvent<HTMLElement>,
    el: ElementoSlide,
    lado: LadoAlca,
  ) => void;
  onDuploClique: (el: ElementoSlide) => void;
  onTextoEditado: (el: ElementoSlide, texto: string) => void;
};

function estiloElemento(
  el: ElementoSlide,
  marca: MarcaCarrossel,
): CSSProperties {
  const base: CSSProperties = { left: u(el.x), top: u(el.y), width: u(el.w) };
  if (el.tipo === "imagem") return { ...base, height: u(el.h ?? el.w) };
  const t = estiloTexto(el, marca);
  return {
    ...base,
    fontFamily: `"${t.familia}", system-ui, sans-serif`,
    fontWeight: t.peso,
    fontSize: u(t.px),
    lineHeight: t.entrelinha,
    color: corDe(el.cor, marca),
    ...(el.tipo === "balao" || el.tipo === "selo"
      ? { background: corDe(el.fundo ?? "destaque", marca) }
      : {}),
    ...(el.tipo === "selo" ? { width: "auto", maxWidth: u(el.w) } : {}),
  };
}

function TextoEditavel({
  el,
  edicao,
}: {
  el: ElementoSlide;
  edicao: EdicaoSlide;
}) {
  return (
    <span
      className="cx-sl-texto-editavel"
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      aria-label="Texto do elemento"
      ref={(n) => {
        if (n && document.activeElement !== n) {
          n.focus();
          const r = document.createRange();
          r.selectNodeContents(n);
          r.collapse(false);
          const sel = window.getSelection();
          sel?.removeAllRanges();
          sel?.addRange(r);
        }
      }}
      onBlur={(e) =>
        edicao.onTextoEditado(
          el,
          e.currentTarget.innerText.replace(/\n{3,}/g, "\n\n").trimEnd(),
        )
      }
      onKeyDown={(e) => {
        if (e.key === "Escape") (e.currentTarget as HTMLElement).blur();
        e.stopPropagation();
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {el.texto}
    </span>
  );
}

export function SlideVista({
  slide,
  indice,
  total,
  marca,
  nomeNegocio,
  className,
  rotulo,
  edicao,
  children,
}: {
  slide: SlideEstudio;
  indice: number;
  total: number;
  marca: MarcaCarrossel;
  nomeNegocio: string;
  className?: string;
  /** Texto para leitor de tela (sem ele, o slide é decorativo). */
  rotulo?: string;
  edicao?: EdicaoSlide;
  /** Camadas por cima (alfinetes de comentário). */
  children?: ReactNode;
}) {
  const { w, h } = tamanho(marca.formato);
  const elementos = elementosDe(slide, indice, marca);
  const fundoEscuro = elementos.some(
    (e) =>
      e.tipo === "imagem" &&
      e.escurecer &&
      e.w >= w * 0.9 &&
      (e.h ?? 0) >= h * 0.9,
  );
  const corRodape = fundoEscuro
    ? "rgba(255,255,255,0.8)"
    : corDe("texto", marca);

  return (
    <div
      className={`cx-sl${className ? ` ${className}` : ""}`}
      style={{
        aspectRatio: `${w} / ${h}`,
        background: marca.fundo,
        fontFamily: `"${familiaTexto(marca).familia}", system-ui, sans-serif`,
      }}
      role={rotulo ? "img" : undefined}
      aria-label={rotulo}
      aria-hidden={rotulo ? undefined : true}
      data-editando={edicao ? "" : undefined}
    >
      {elementos.map((el) => {
        const sel = edicao?.selecionado === el.id;
        const comuns = {
          className: `cx-sl-el cx-sl-${el.tipo}`,
          style: estiloElemento(el, marca),
          "data-selecionado": sel ? "" : undefined,
          "data-id": el.id,
          onPointerDown: edicao
            ? (e: RPointerEvent<HTMLElement>) =>
                edicao.onPointerDownElemento(e, el)
            : undefined,
          onDoubleClick:
            edicao && el.tipo !== "imagem"
              ? () => edicao.onDuploClique(el)
              : undefined,
        };
        if (el.tipo === "imagem") {
          return (
            <div key={el.id} {...comuns}>
              {el.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={el.url} alt="" draggable={false} />
              ) : null}
              {el.escurecer ? <span className="cx-sl-escuro" /> : null}
              {sel && edicao ? <Alcas el={el} edicao={edicao} /> : null}
            </div>
          );
        }
        const editando = edicao?.editando === el.id;
        return (
          <div key={el.id} {...comuns}>
            {el.tipo === "titulo" ? (
              <span
                className="cx-sl-traco"
                style={{
                  background: marca.destaque,
                  width: u(72),
                  height: u(10),
                  top: u(-60),
                }}
              />
            ) : null}
            {editando && edicao ? (
              <TextoEditavel el={el} edicao={edicao} />
            ) : (
              el.texto
            )}
            {sel && edicao && !editando ? (
              <Alcas el={el} edicao={edicao} />
            ) : null}
          </div>
        );
      })}
      <div
        className="cx-sl-rodape"
        style={{
          color: corRodape,
          left: u(96),
          right: u(96),
          bottom: u(40),
          fontSize: u(28),
        }}
      >
        <span>{nomeNegocio.slice(0, 40)}</span>
        <span>
          {indice === 0 && total > 1 ? "Arraste →" : `${indice + 1}/${total}`}
        </span>
      </div>
      {children}
    </div>
  );
}
