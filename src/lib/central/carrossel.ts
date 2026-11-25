/**
 * Carrossel da Central: modelo, fontes da marca, desenho de cada slide em
 * canvas e PDF. Módulo puro (roda no navegador): a prévia do editor e a
 * exportação usam o MESMO desenho, então o PNG/PDF sai igual à tela.
 */
import type { SlideCarrossel } from "@/lib/central/entregas-tipos";

export type LayoutSlide = "fundo" | "metade" | "texto";
export type FormatoCarrossel = "4x5" | "1x1";

export type MarcaCarrossel = {
  fundo: string;
  texto: string;
  destaque: string;
  fonte: IdFonte;
  formato: FormatoCarrossel;
};

export type SlideEditor = SlideCarrossel & { layout?: LayoutSlide };

export type ConteudoCarrossel = { slides: SlideEditor[]; marca: MarcaCarrossel };

// ---------------------------------------------------------------------------
// Fontes (arquivos locais em public/fonts)
// ---------------------------------------------------------------------------

type Arquivo = { pasta: string; peso: number };

export const FONTES = {
  bricolage: {
    nome: "Bricolage",
    titulo: { familia: "Cx Bricolage", pasta: "bricolage-grotesque", peso: 800 },
    texto: { familia: "Cx Bricolage", pasta: "bricolage-grotesque", peso: 400 },
  },
  playfair: {
    nome: "Playfair",
    titulo: { familia: "Cx Playfair", pasta: "playfair-display", peso: 700 },
    texto: { familia: "Cx Work", pasta: "work-sans", peso: 400 },
  },
  oswald: {
    nome: "Oswald",
    titulo: { familia: "Cx Oswald", pasta: "oswald", peso: 700 },
    texto: { familia: "Cx Work", pasta: "work-sans", peso: 400 },
  },
  dmserif: {
    nome: "DM Serif",
    titulo: { familia: "Cx DM Serif", pasta: "dm-serif-display", peso: 400 },
    texto: { familia: "Cx Work", pasta: "work-sans", peso: 400 },
  },
  fraunces: {
    nome: "Fraunces",
    titulo: { familia: "Cx Fraunces", pasta: "fraunces", peso: 600 },
    texto: { familia: "Cx Work", pasta: "work-sans", peso: 400 },
  },
  poppins: {
    nome: "Poppins",
    titulo: { familia: "Cx Poppins", pasta: "poppins", peso: 600 },
    texto: { familia: "Cx Poppins", pasta: "poppins", peso: 400 },
  },
} as const satisfies Record<string, { nome: string; titulo: Arquivo & { familia: string }; texto: Arquivo & { familia: string } }>;

export type IdFonte = keyof typeof FONTES;
export const IDS_FONTE = Object.keys(FONTES) as IdFonte[];

const fontesCarregadas = new Map<string, Promise<void>>();

/** Carrega a fonte da marca (título + texto) para o canvas poder usar. */
export function carregarFonte(id: IdFonte): Promise<void> {
  const f = FONTES[id];
  const tarefas = [f.titulo, f.texto].map((a) => {
    const chave = `${a.familia}-${a.peso}`;
    let p = fontesCarregadas.get(chave);
    if (!p) {
      const face = new FontFace(a.familia, `url(/fonts/${a.pasta}/${a.peso}-normal.woff2)`, { weight: String(a.peso) });
      p = face
        .load()
        .then((ff) => {
          document.fonts.add(ff);
        })
        .catch(() => undefined);
      fontesCarregadas.set(chave, p);
    }
    return p;
  });
  return Promise.all(tarefas).then(() => undefined);
}

// ---------------------------------------------------------------------------
// Medidas
// ---------------------------------------------------------------------------

export function tamanho(formato: FormatoCarrossel): { w: number; h: number } {
  return formato === "1x1" ? { w: 1080, h: 1080 } : { w: 1080, h: 1350 };
}

export function layoutDe(s: SlideEditor, indice: number): LayoutSlide {
  if (s.layout === "texto") return "texto";
  if (!s.imagem) return "texto";
  return s.layout ?? (indice === 0 ? "fundo" : "metade");
}

function quebrar(ctx: CanvasRenderingContext2D, texto: string, largura: number): string[] {
  const linhas: string[] = [];
  for (const paragrafo of texto.split(/\n/)) {
    const palavras = paragrafo.split(/\s+/).filter(Boolean);
    let linha = "";
    for (const p of palavras) {
      const teste = linha ? `${linha} ${p}` : p;
      if (ctx.measureText(teste).width <= largura || !linha) linha = teste;
      else {
        linhas.push(linha);
        linha = p;
      }
    }
    linhas.push(linha);
  }
  return linhas.filter((l, i, a) => l || (i > 0 && i < a.length - 1));
}

/** Maior tamanho (até `max`) em que o texto cabe em `maxLinhas`. */
function ajustar(
  ctx: CanvasRenderingContext2D,
  texto: string,
  largura: number,
  fonte: (px: number) => string,
  max: number,
  min: number,
  maxLinhas: number,
): { px: number; linhas: string[] } {
  for (let px = max; px >= min; px -= 4) {
    ctx.font = fonte(px);
    const linhas = quebrar(ctx, texto, largura);
    if (linhas.length <= maxLinhas) return { px, linhas };
  }
  ctx.font = fonte(min);
  return { px: min, linhas: quebrar(ctx, texto, largura).slice(0, maxLinhas) };
}

function cobrir(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const r = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const iw = img.naturalWidth * r;
  const ih = img.naturalHeight * r;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
  ctx.restore();
}

function comAlfa(hex: string, alfa: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alfa})`;
}

// ---------------------------------------------------------------------------
// Desenho
// ---------------------------------------------------------------------------

export type ContextoDesenho = {
  marca: MarcaCarrossel;
  total: number;
  nomeNegocio: string;
  /** Imagens já carregadas (url → elemento). Sem a imagem, o slide sai só com texto. */
  imagens: Map<string, HTMLImageElement>;
};

/** Desenha um slide no canvas (tamanho real: 1080 × 1350 ou 1080 × 1080). */
export function desenharSlide(canvas: HTMLCanvasElement, s: SlideEditor, indice: number, c: ContextoDesenho): void {
  const { w, h } = tamanho(c.marca.formato);
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const f = FONTES[c.marca.fonte] ?? FONTES.bricolage;
  const pad = 96;
  const larguraTexto = w - pad * 2;
  const img = s.imagem ? c.imagens.get(s.imagem) : undefined;
  let layout = layoutDe(s, indice);
  if (layout !== "texto" && !img) layout = "texto";

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = c.marca.fundo;
  ctx.fillRect(0, 0, w, h);
  ctx.textBaseline = "alphabetic";

  const fonteTitulo = (px: number) => `${f.titulo.peso} ${px}px "${f.titulo.familia}", system-ui, sans-serif`;
  const fonteTexto = (px: number) => `${f.texto.peso} ${px}px "${f.texto.familia}", system-ui, sans-serif`;
  const corTinta = layout === "fundo" ? "#ffffff" : c.marca.texto;

  // Área do texto e imagem
  let topo = pad;
  let base = h - pad - 56;
  if (layout === "fundo" && img) {
    cobrir(ctx, img, 0, 0, w, h);
    const g = ctx.createLinearGradient(0, h * 0.25, 0, h);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.78)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  } else if (layout === "metade" && img) {
    const alturaImg = Math.round(h * 0.5);
    cobrir(ctx, img, 0, 0, w, alturaImg);
    topo = alturaImg + 64;
  }

  const ehCapa = indice === 0;
  const tit = ajustar(
    ctx,
    s.titulo || " ",
    larguraTexto,
    fonteTitulo,
    layout === "metade" ? 76 : ehCapa ? 112 : 92,
    40,
    layout === "metade" ? 3 : 5,
  );
  const lhTit = Math.round(tit.px * 1.08);
  const txt = s.texto.trim()
    ? ajustar(ctx, s.texto, larguraTexto, fonteTexto, layout === "metade" ? 38 : 42, 28, layout === "metade" ? 5 : 7)
    : { px: 0, linhas: [] as string[] };
  const lhTxt = Math.round(txt.px * 1.4);
  const alturaBloco = 10 + 40 + tit.linhas.length * lhTit + (txt.linhas.length ? 28 + txt.linhas.length * lhTxt : 0);

  // Onde o bloco começa: embaixo no "fundo", logo abaixo da imagem na "metade", centrado no "texto".
  let y =
    layout === "fundo"
      ? base - alturaBloco
      : layout === "metade"
        ? topo
        : Math.max(pad, Math.round((h - alturaBloco) / 2) - 24);
  if (layout === "metade") base = h - pad;

  // Traço de destaque
  ctx.fillStyle = c.marca.destaque;
  ctx.fillRect(pad, y, 72, 10);
  y += 10 + 40;

  ctx.fillStyle = corTinta;
  ctx.font = fonteTitulo(tit.px);
  for (const l of tit.linhas) {
    y += lhTit;
    ctx.fillText(l, pad, y - Math.round(tit.px * 0.22));
  }
  if (txt.linhas.length) {
    y += 28;
    ctx.font = fonteTexto(txt.px);
    ctx.fillStyle = layout === "fundo" ? "rgba(255,255,255,0.9)" : comAlfa(c.marca.texto, 0.86);
    for (const l of txt.linhas) {
      y += lhTxt;
      ctx.fillText(l, pad, y - Math.round(txt.px * 0.3));
    }
  }

  // Rodapé: nome do negócio e posição
  ctx.font = fonteTexto(28);
  ctx.fillStyle = layout === "fundo" ? "rgba(255,255,255,0.78)" : comAlfa(c.marca.texto, 0.62);
  const rodapeY = h - 56;
  if (layout !== "metade" || h - y > 120) ctx.fillText(c.nomeNegocio.slice(0, 40), pad, rodapeY);
  const pos = ehCapa && c.total > 1 ? "Arraste →" : `${indice + 1}/${c.total}`;
  ctx.textAlign = "right";
  ctx.fillText(pos, w - pad, rodapeY);
  ctx.textAlign = "left";
}

// ---------------------------------------------------------------------------
// PDF (uma página por slide, imagem JPEG em tamanho real)
// ---------------------------------------------------------------------------

function base64ParaBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Monta um PDF simples com um JPEG por página (sem biblioteca). */
export function montarPdf(paginas: Array<{ jpegDataUrl: string; w: number; h: number }>): Blob {
  const enc = new TextEncoder();
  const partes: Uint8Array[] = [];
  const offsets: number[] = [];
  let tamanhoAtual = 0;
  const push = (p: Uint8Array | string) => {
    const b = typeof p === "string" ? enc.encode(p) : p;
    partes.push(b);
    tamanhoAtual += b.length;
  };
  const objeto = (n: number) => {
    offsets[n] = tamanhoAtual;
  };

  const n = paginas.length;
  // 1 catálogo, 2 páginas, depois 3 objetos por página: página, imagem, conteúdo.
  push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  objeto(1);
  push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  const kids = paginas.map((_, i) => `${3 + i * 3} 0 R`).join(" ");
  objeto(2);
  push(`2 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${n} >>\nendobj\n`);
  paginas.forEach((p, i) => {
    const pag = 3 + i * 3;
    const img = pag + 1;
    const cont = pag + 2;
    const jpeg = base64ParaBytes(p.jpegDataUrl.split(",")[1] ?? "");
    objeto(pag);
    push(
      `${pag} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${p.w} ${p.h}] /Resources << /XObject << /Im${i} ${img} 0 R >> >> /Contents ${cont} 0 R >>\nendobj\n`,
    );
    objeto(img);
    push(
      `${img} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
    );
    push(jpeg);
    push("\nendstream\nendobj\n");
    const fluxo = `q ${p.w} 0 0 ${p.h} 0 0 cm /Im${i} Do Q`;
    objeto(cont);
    push(`${cont} 0 obj\n<< /Length ${fluxo.length} >>\nstream\n${fluxo}\nendstream\nendobj\n`);
  });
  const total = 3 + n * 3;
  const inicioXref = tamanhoAtual;
  let xref = `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (let i = 1; i < total; i++) xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  push(xref);
  push(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF\n`);
  return new Blob(partes as BlobPart[], { type: "application/pdf" });
}

export function baixar(blob: Blob, nome: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function nomeArquivo(titulo: string): string {
  return (
    titulo
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50) || "carrossel"
  );
}
