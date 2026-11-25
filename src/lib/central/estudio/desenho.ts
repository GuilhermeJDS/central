/**
 * PNG e PDF do slide do estúdio: desenha os elementos (mesmas posições,
 * fontes e cores do DOM) num canvas de 1080 de largura. Só no navegador.
 */
import { baixar, carregarFonte, montarPdf, nomeArquivo, tamanho, type MarcaCarrossel } from "@/lib/central/carrossel";
import { corDe, elementosDe, estiloTexto, type ElementoSlide, type SlideEstudio } from "@/lib/central/estudio/slide";

function carregarImagem(url: string): Promise<HTMLImageElement | null> {
  return new Promise((ok) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => ok(null);
    img.src = url;
  });
}

function quebrar(ctx: CanvasRenderingContext2D, texto: string, largura: number): string[] {
  const linhas: string[] = [];
  for (const par of texto.split("\n")) {
    let linha = "";
    for (const p of par.split(/\s+/).filter(Boolean)) {
      const teste = linha ? `${linha} ${p}` : p;
      if (ctx.measureText(teste).width <= largura || !linha) linha = teste;
      else {
        linhas.push(linha);
        linha = p;
      }
    }
    linhas.push(linha);
  }
  return linhas;
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

function retanguloRedondo(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function textoEm(
  ctx: CanvasRenderingContext2D,
  el: ElementoSlide,
  marca: MarcaCarrossel,
  x: number,
  y: number,
  largura: number,
): { linhas: string[]; lh: number; px: number } {
  const t = estiloTexto(el, marca);
  ctx.font = `${t.peso} ${t.px}px "${t.familia}", system-ui, sans-serif`;
  // Igual ao DOM: título com -0,01em; selo com +0,02em.
  (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing =
    el.tipo === "titulo" ? `${-0.01 * t.px}px` : el.tipo === "selo" ? `${0.02 * t.px}px` : "0px";
  const texto = el.tipo === "selo" ? (el.texto ?? "").toUpperCase() : (el.texto ?? "");
  const linhas = el.tipo === "selo" ? [texto] : quebrar(ctx, texto, largura);
  const lh = t.px * t.entrelinha;
  return { linhas, lh, px: t.px };
}

function escrever(ctx: CanvasRenderingContext2D, linhas: string[], x: number, y: number, lh: number, px: number) {
  ctx.textBaseline = "alphabetic";
  linhas.forEach((l, n) => ctx.fillText(l, x, y + n * lh + lh / 2 + px * 0.35));
}

export async function desenharSlideEstudio(
  canvas: HTMLCanvasElement,
  s: SlideEstudio,
  indice: number,
  total: number,
  marca: MarcaCarrossel,
  nomeNegocio: string,
): Promise<void> {
  const { w: W, h: H } = tamanho(marca.formato);
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  await carregarFonte(marca.fonte);
  const elementos = elementosDe(s, indice, marca);
  const imagens = new Map<string, HTMLImageElement | null>();
  await Promise.all(
    elementos.filter((e) => e.tipo === "imagem" && e.url).map(async (e) => imagens.set(e.url!, await carregarImagem(e.url!))),
  );

  ctx.fillStyle = marca.fundo;
  ctx.fillRect(0, 0, W, H);
  let fundoEscuro = false;

  // Imagens primeiro (no DOM ficam atrás), depois os textos na ordem.
  for (const el of elementos.filter((e) => e.tipo === "imagem")) {
    const img = el.url ? imagens.get(el.url) : null;
    const h = el.h ?? el.w;
    if (img) cobrir(ctx, img, el.x, el.y, el.w, h);
    if (el.escurecer) {
      const g = ctx.createLinearGradient(0, el.y, 0, el.y + h);
      g.addColorStop(0.25, "rgba(0,0,0,0)");
      g.addColorStop(1, "rgba(0,0,0,0.78)");
      ctx.fillStyle = g;
      ctx.fillRect(el.x, el.y, el.w, h);
      if (el.w >= W * 0.9 && h >= H * 0.9) fundoEscuro = true;
    }
  }

  for (const el of elementos.filter((e) => e.tipo !== "imagem")) {
    if (el.tipo === "titulo") {
      ctx.fillStyle = marca.destaque;
      ctx.fillRect(el.x, el.y - 60, 72, 10);
    }
    if (el.tipo === "balao") {
      const padX = 36;
      const padY = 28;
      const { linhas, lh, px } = textoEm(ctx, el, marca, el.x, el.y, el.w - padX * 2);
      const larg = Math.min(el.w, Math.max(...linhas.map((l) => ctx.measureText(l).width)) + padX * 2);
      const alt = linhas.length * lh + padY * 2;
      ctx.fillStyle = corDe(el.fundo ?? "destaque", marca);
      retanguloRedondo(ctx, el.x, el.y, larg, alt, 36);
      ctx.fill();
      ctx.save();
      ctx.translate(el.x + 64 + 18, el.y + alt - 14 + 18);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-18, -18, 36, 36);
      ctx.restore();
      ctx.fillStyle = corDe(el.cor, marca);
      escrever(ctx, linhas, el.x + padX, el.y + padY, lh, px);
      continue;
    }
    if (el.tipo === "selo") {
      const { linhas, lh, px } = textoEm(ctx, el, marca, el.x, el.y, el.w);
      const larg = ctx.measureText(linhas[0]).width + 52;
      const alt = lh + 24;
      ctx.save();
      ctx.translate(el.x + larg / 2, el.y + alt / 2);
      ctx.rotate((-3 * Math.PI) / 180);
      ctx.fillStyle = corDe(el.fundo ?? "destaque", marca);
      retanguloRedondo(ctx, -larg / 2, -alt / 2, larg, alt, alt / 2);
      ctx.fill();
      ctx.fillStyle = corDe(el.cor, marca);
      escrever(ctx, linhas, -larg / 2 + 26, -alt / 2 + 12, lh, px);
      ctx.restore();
      continue;
    }
    const { linhas, lh, px } = textoEm(ctx, el, marca, el.x, el.y, el.w);
    ctx.fillStyle = corDe(el.cor, marca);
    escrever(ctx, linhas, el.x, el.y, lh, px);
  }

  // Rodapé
  (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = "0px";
  const f = estiloTexto({ id: "", tipo: "texto", x: 0, y: 0, w: 0, tamanho: 28 }, marca);
  ctx.font = `${f.peso} 28px "${f.familia}", system-ui, sans-serif`;
  ctx.fillStyle = fundoEscuro ? "rgba(255,255,255,0.8)" : marca.texto;
  const base = H - 40 - 28 * 0.22;
  ctx.textAlign = "left";
  ctx.fillText(nomeNegocio.slice(0, 40), 96, base);
  ctx.textAlign = "right";
  ctx.fillText(indice === 0 && total > 1 ? "Arraste →" : `${indice + 1}/${total}`, W - 96, base);
  ctx.textAlign = "left";
}

export async function exportarPng(
  slides: SlideEstudio[],
  indices: number[],
  marca: MarcaCarrossel,
  nomeNegocio: string,
  titulo: string,
): Promise<void> {
  const base = nomeArquivo(titulo);
  for (const i of indices) {
    const c = document.createElement("canvas");
    await desenharSlideEstudio(c, slides[i], i, slides.length, marca, nomeNegocio);
    const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, "image/png"));
    if (blob) baixar(blob, `${base}-${String(i + 1).padStart(2, "0")}.png`);
    if (indices.length > 1) await new Promise((ok) => setTimeout(ok, 250));
  }
}

export async function exportarPdf(
  slides: SlideEstudio[],
  marca: MarcaCarrossel,
  nomeNegocio: string,
  titulo: string,
): Promise<void> {
  const { w, h } = tamanho(marca.formato);
  const paginas = [];
  for (let i = 0; i < slides.length; i++) {
    const c = document.createElement("canvas");
    await desenharSlideEstudio(c, slides[i], i, slides.length, marca, nomeNegocio);
    paginas.push({ jpegDataUrl: c.toDataURL("image/jpeg", 0.92), w, h });
  }
  baixar(montarPdf(paginas), `${nomeArquivo(titulo)}.pdf`);
}
