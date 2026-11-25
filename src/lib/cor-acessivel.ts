/**
 * Cor de destaque legível: garante contraste WCAG mínimo da cor escolhida pelo
 * cliente contra o fundo do tema, e escolhe a cor do texto que vai em cima dela.
 */

type Rgb = { r: number; g: number; b: number };

export const CONTRASTE_MINIMO_AA = 4.5;

export function hexParaRgb(hex: string | null | undefined): Rgb | null {
  if (!hex) return null;
  const valor = hex.trim().replace(/^#/, "");
  const cheio =
    valor.length === 3
      ? valor
          .split("")
          .map((c) => c + c)
          .join("")
      : valor;
  if (!/^[0-9a-f]{6}$/i.test(cheio)) return null;
  return {
    r: Number.parseInt(cheio.slice(0, 2), 16),
    g: Number.parseInt(cheio.slice(2, 4), 16),
    b: Number.parseInt(cheio.slice(4, 6), 16),
  };
}

function rgbParaHex({ r, g, b }: Rgb) {
  const parte = (n: number) =>
    Math.round(Math.min(255, Math.max(0, n)))
      .toString(16)
      .padStart(2, "0");
  return `#${parte(r)}${parte(g)}${parte(b)}`.toUpperCase();
}

/** Luminância relativa (WCAG 2.x). */
function luminancia({ r, g, b }: Rgb) {
  const canal = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

function contrasteRgb(a: Rgb, b: Rgb) {
  const la = luminancia(a);
  const lb = luminancia(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export function contraste(corA: string, corB: string): number {
  const a = hexParaRgb(corA);
  const b = hexParaRgb(corB);
  if (!a || !b) return 1;
  return contrasteRgb(a, b);
}

function rgbParaHsl({ r, g, b }: Rgb) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return { h: h / 6, s, l };
}

function hslParaRgb({ h, s, l }: { h: number; s: number; l: number }): Rgb {
  if (s === 0) return { r: l * 255, g: l * 255, b: l * 255 };
  const hue = (p: number, q: number, t: number) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: hue(p, q, h + 1 / 3) * 255,
    g: hue(p, q, h) * 255,
    b: hue(p, q, h - 1 / 3) * 255,
  };
}

export type CorAcessivel = {
  /** Cor de destaque já ajustada para passar o contraste contra o fundo. */
  cor: string;
  /** Texto para usar em cima da cor (botões): o de maior contraste. */
  texto: string;
  /** Contraste final da cor contra o fundo. */
  contraste: number;
  /** true quando a cor original precisou ser escurecida/clareada. */
  ajustada: boolean;
};

/**
 * Recebe a cor escolhida e o fundo do tema. Se o contraste for menor que o
 * mínimo, anda na luminosidade (HSL), mantendo matiz e saturação, até passar.
 */
export function corAcessivel(
  cor: string | null | undefined,
  fundo: string,
  opcoes: {
    fallback: string;
    minimo?: number;
    textoClaro?: string;
    textoEscuro?: string;
  },
): CorAcessivel {
  const minimo = opcoes.minimo ?? CONTRASTE_MINIMO_AA;
  const textoClaro = opcoes.textoClaro ?? "#FFFFFF";
  const textoEscuro = opcoes.textoEscuro ?? "#111111";
  const fundoRgb = hexParaRgb(fundo) ?? { r: 255, g: 255, b: 255 };
  const original = hexParaRgb(cor) ?? hexParaRgb(opcoes.fallback)!;

  let atual = original;
  let ajustada = false;

  if (contrasteRgb(atual, fundoRgb) < minimo) {
    ajustada = true;
    const hsl = rgbParaHsl(original);
    const escurecer = luminancia(fundoRgb) > 0.18;
    let l = hsl.l;
    for (let i = 0; i < 100; i += 1) {
      l = escurecer ? l - 0.01 : l + 0.01;
      if (l <= 0 || l >= 1) {
        l = Math.min(1, Math.max(0, l));
      }
      atual = hslParaRgb({ ...hsl, l });
      if (contrasteRgb(atual, fundoRgb) >= minimo || l === 0 || l === 1) break;
    }
  }

  const claro = hexParaRgb(textoClaro)!;
  const escuro = hexParaRgb(textoEscuro)!;
  const texto =
    contrasteRgb(atual, claro) >= contrasteRgb(atual, escuro)
      ? textoClaro
      : textoEscuro;

  return {
    cor: rgbParaHex(atual),
    texto,
    contraste: Math.round(contrasteRgb(atual, fundoRgb) * 100) / 100,
    ajustada,
  };
}
