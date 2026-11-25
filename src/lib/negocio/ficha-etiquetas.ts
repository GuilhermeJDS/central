/**
 * Serviços ("O que vende") e públicos ("Para quem") aparecem como etiquetas no
 * prontuário, mas continuam gravados como texto na ficha (os chefes leem
 * texto). Módulo puro: roda no cliente e no servidor.
 */

const SEPARADORES = /\s*(?:\n|;|•|·|,)\s*/;
/** Lista gravada pelo prontuário (separada por ";" ou linha): não quebra mais nada. */
const SEPARADORES_LISTA = /\s*(?:\n|;|•)\s*/;
/** Tamanho a partir do qual o " e " final não vira duas etiquetas (é frase). */
const CURTA = 40;

const palavras = (t: string) => t.trim().split(/\s+/).length;

function limpar(t: string): string {
  return t
    .replace(/^[-–—*\s]+/, "")
    .replace(/[.\s]+$/, "")
    .trim();
}

/**
 * Texto antigo: "a, b e c." → ["a", "b", "c"] (frase longa sem vírgula vira
 * uma etiqueta só). Texto já gravado como lista ("a; b e c") só se separa no ";".
 */
export function paraEtiquetas(texto: string): string[] {
  const lista = /[;\n]/.test(texto);
  // Só uma enumeração ("a, b e c") quebra no " e "; uma frase solta não.
  const enumeracao = texto.split(SEPARADORES).filter((x) => x.trim()).length > 1;
  const partes = texto
    .split(lista ? SEPARADORES_LISTA : SEPARADORES)
    .map(limpar)
    .filter(Boolean)
    .flatMap((p) => {
      // "drenagem e massagem" vira duas; "Muriaé e região que querem…" (frase) não.
      if (lista || !enumeracao) return [p];
      const pedacos = p.split(/\s+e\s+/);
      const [a, b] = pedacos;
      return pedacos.length === 2 && a.length <= CURTA && b.length <= CURTA && palavras(a) <= 4 && palavras(b) <= 4 ? [a, b] : [p];
    });
  const vistas = new Set<string>();
  return partes
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .filter((p) => {
      const k = p.toLocaleLowerCase("pt-BR");
      if (vistas.has(k)) return false;
      vistas.add(k);
      return true;
    });
}

export function deEtiquetas(lista: string[]): string {
  return lista.map((t) => limpar(t.replace(/[;\n]+/g, " "))).filter(Boolean).join("; ");
}
