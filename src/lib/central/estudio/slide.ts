/**
 * Slide do estúdio: elementos soltos (título, texto, balão, selo, imagem)
 * com posição no quadro de 1080 de largura. O mesmo modelo desenha a capa na
 * biblioteca, o slide no visualizador (DOM) e o PNG/PDF (canvas).
 * Módulo puro: roda no navegador e no servidor.
 *
 * Slides antigos (só título/texto/imagem + layout) viram elementos com
 * `elementosDe`, na mesma arrumação que o editor antigo desenhava.
 */
import { FONTES, tamanho, type MarcaCarrossel, type SlideEditor } from "@/lib/central/carrossel";

export type CorMarca = "fundo" | "texto" | "destaque" | "branco" | "preto";
export type TipoElemento = "titulo" | "texto" | "balao" | "selo" | "imagem";

export type ElementoSlide = {
  id: string;
  tipo: TipoElemento;
  /** Posição e largura no quadro (1080 de largura). */
  x: number;
  y: number;
  w: number;
  /** Só imagem: altura. */
  h?: number;
  texto?: string;
  /** Tamanho da letra (px no quadro). */
  tamanho?: number;
  cor?: CorMarca;
  /** Balão e selo: cor do fundo. */
  fundo?: CorMarca;
  /** Só imagem. */
  url?: string;
  /** Imagem de fundo: escurece embaixo para o texto ler. */
  escurecer?: boolean;
};

export type SlideEstudio = SlideEditor & { elementos?: ElementoSlide[] };
export type ConteudoEstudio = { slides: SlideEstudio[]; marca: MarcaCarrossel };

export const LARGURA_QUADRO = 1080;
export const MARGEM = 96;

export const TAMANHOS_TEXTO = [28, 34, 40, 48, 56, 64, 76, 88, 104, 120] as const;

let seq = 0;
export const novoIdElemento = () => `e${Date.now().toString(36)}${(seq++).toString(36)}`;

export function corDe(c: CorMarca | undefined, marca: MarcaCarrossel): string {
  switch (c) {
    case "fundo":
      return marca.fundo;
    case "destaque":
      return marca.destaque;
    case "branco":
      return "#FFFFFF";
    case "preto":
      return "#111111";
    default:
      return marca.texto;
  }
}

/** Altura estimada de um bloco de texto (para empilhar sem sobrepor). */
export function linhasEstimadas(texto: string, w: number, px: number, largura = 0.56): number {
  const porLinha = Math.max(6, Math.floor(w / (px * largura)));
  // Quebra por palavra: conta como o navegador faria, sem cortar no meio.
  return texto.split("\n").reduce((n, par) => {
    let linhas = 1;
    let atual = 0;
    for (const p of par.split(/\s+/).filter(Boolean)) {
      const t = p.length + (atual ? 1 : 0);
      if (atual + t > porLinha && atual) {
        linhas++;
        atual = p.length;
      } else atual += t;
    }
    return n + linhas;
  }, 0);
}

export function alturaEstimada(texto: string, w: number, px: number, entrelinha: number, largura = 0.56): number {
  return Math.round(linhasEstimadas(texto, w, px, largura) * px * entrelinha);
}

/** Maior tamanho (até `max`) em que o título cabe em `maxLinhas` e a maior palavra cabe inteira. */
export function tamanhoQueCabe(texto: string, w: number, max: number, maxLinhas: number, largura = 0.6): number {
  const maior = Math.max(1, ...texto.split(/\s+/).map((p) => p.length));
  for (let px = max; px > 44; px -= 4) {
    if (maior * px * largura <= w && linhasEstimadas(texto, w, px, largura) <= maxLinhas) return px;
  }
  return 44;
}

/** Elementos do slide (os salvos ou os montados a partir do slide antigo). */
export function elementosDe(s: SlideEstudio, indice: number, marca: MarcaCarrossel): ElementoSlide[] {
  if (s.elementos?.length) return s.elementos;
  const { w: W, h: H } = tamanho(marca.formato);
  const larg = W - MARGEM * 2;
  const capa = indice === 0;
  const layout = !s.imagem ? "texto" : (s.layout ?? (capa ? "fundo" : "metade"));
  const els: ElementoSlide[] = [];
  const tTit = tamanhoQueCabe(s.titulo || " ", larg, layout === "metade" ? 72 : capa ? 104 : 84, layout === "metade" ? 3 : 4);
  const tTxt = layout === "metade" ? 36 : 40;
  const hTit = alturaEstimada(s.titulo || " ", larg, tTit, 1.08, 0.6);
  const hTxt = s.texto.trim() ? alturaEstimada(s.texto, larg, tTxt, 1.4, 0.5) : 0;
  const bloco = 60 + hTit + (hTxt ? 32 + hTxt : 0);

  let y: number;
  if (layout === "fundo") {
    els.push({ id: `${s.id}-img`, tipo: "imagem", x: 0, y: 0, w: W, h: H, url: s.imagem!, escurecer: true });
    y = H - MARGEM - 64 - bloco;
  } else if (layout === "metade") {
    els.push({ id: `${s.id}-img`, tipo: "imagem", x: 0, y: 0, w: W, h: Math.round(H * 0.5), url: s.imagem! });
    y = Math.round(H * 0.5) + 56;
  } else {
    y = Math.max(MARGEM, Math.round((H - bloco) / 2) - 24);
  }
  const corTit: CorMarca = layout === "fundo" ? "branco" : "texto";
  els.push({ id: `${s.id}-tit`, tipo: "titulo", x: MARGEM, y: y + 60, w: larg, texto: s.titulo, tamanho: tTit, cor: corTit });
  if (s.texto.trim())
    els.push({
      id: `${s.id}-txt`,
      tipo: "texto",
      x: MARGEM,
      y: y + 60 + hTit + 32,
      w: larg,
      texto: s.texto,
      tamanho: tTxt,
      cor: corTit,
    });
  return els;
}

/** Slide com os elementos explícitos e título/texto sincronizados (para resumos). */
export function normalizarSlide(s: SlideEstudio, indice: number, marca: MarcaCarrossel): SlideEstudio {
  const elementos = elementosDe(s, indice, marca);
  const tit = elementos.find((e) => e.tipo === "titulo");
  const txt = elementos.find((e) => e.tipo === "texto");
  const img = elementos.find((e) => e.tipo === "imagem");
  return {
    ...s,
    titulo: tit?.texto ?? s.titulo,
    texto: txt?.texto ?? s.texto,
    imagem: img?.url ?? null,
    elementos,
  };
}

export function familiaTitulo(marca: MarcaCarrossel) {
  const f = FONTES[marca.fonte] ?? FONTES.bricolage;
  return { familia: f.titulo.familia, peso: f.titulo.peso };
}

export function familiaTexto(marca: MarcaCarrossel) {
  const f = FONTES[marca.fonte] ?? FONTES.bricolage;
  return { familia: f.texto.familia, peso: f.texto.peso };
}

/** Fonte, peso e entrelinha de cada tipo de elemento. */
export function estiloTexto(e: ElementoSlide, marca: MarcaCarrossel) {
  const tit = e.tipo === "titulo" || e.tipo === "selo";
  const f = tit ? familiaTitulo(marca) : familiaTexto(marca);
  const px = e.tamanho ?? (e.tipo === "titulo" ? 84 : e.tipo === "selo" ? 30 : 40);
  const entrelinha = e.tipo === "titulo" ? 1.08 : e.tipo === "selo" ? 1.1 : 1.4;
  const peso = e.tipo === "balao" ? Math.max(f.peso, 500) : f.peso;
  return { familia: f.familia, peso, px, entrelinha };
}
