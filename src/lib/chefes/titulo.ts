/**
 * Título curto de cada decisão: gerado pela skill junto com o resultado
 * (até 8 palavras, o que é e para quem). A mensagem fica só no corpo.
 */
import "server-only";

import { chamarModelo, usoDe, type UsoModelo } from "@/lib/chefes/chamar-modelo";
import type { Credencial } from "@/lib/ia/credencial";
import { gravarTitulo, somarUso } from "@/lib/skills/execucoes";

export const MAX_PALAVRAS_TITULO = 8;

const REGRA =
  `até ${MAX_PALAVRAS_TITULO} palavras, dizendo o que é e para quem ` +
  '(ex.: "Mensagem de volta para a Carla", "Legenda do post de corte degradê"). ' +
  "Sem aspas, sem ponto final, sem repetir o começo do resultado.";

/** Para skills de texto livre: o título vem na primeira linha. */
export const PEDIDO_TITULO_LINHA =
  `Na PRIMEIRA linha da resposta escreva "TÍTULO: " e um título curto, ${REGRA} ` +
  "Depois deixe uma linha em branco e escreva o resultado.";

/** Para skills que respondem JSON: o campo "titulo". */
export const PEDIDO_TITULO_JSON = `Em titulo vai um título curto, ${REGRA}`;

/** Corta em 8 palavras e tira aspas, marcação e ponto final. */
export function limparTitulo(bruto: string | null | undefined): string | null {
  const t = (bruto ?? "")
    .replace(/[*_`#>"“”]/g, "")
    .replace(/\s*—\s*/g, ", ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.:;,!]+$/, "")
    .trim();
  if (t.length < 3) return null;
  return t.split(" ").slice(0, MAX_PALAVRAS_TITULO).join(" ").slice(0, 120);
}

const LINHA_TITULO = /^\s*[*_#>\s]*t[íi]tulo\s*[*_]*\s*:\s*(.+)$/i;

/** Separa a linha "TÍTULO: ..." do resultado. Sem a linha, título null e corpo intacto. */
export function separarTitulo(saida: string): { titulo: string | null; corpo: string } {
  const linhas = saida.split(/\r?\n/);
  const i = linhas.findIndex((l) => l.trim().length > 0);
  if (i === -1) return { titulo: null, corpo: saida.trim() };
  const m = linhas[i].match(LINHA_TITULO);
  if (!m) return { titulo: null, corpo: saida.trim() };
  return { titulo: limparTitulo(m[1]), corpo: linhas.slice(i + 1).join("\n").trim() };
}

/**
 * Reserva: a skill não mandou título. Uma chamada curta tira o título do
 * próprio resultado (o custo vai junto na execução).
 */
async function tituloDeReserva(
  accountId: string,
  resultado: string,
  credencial?: Credencial,
): Promise<{ titulo: string | null; uso: UsoModelo | null }> {
  try {
    const r = await chamarModelo(
      accountId,
      `Dê um título curto para o trabalho abaixo, ${REGRA} Responda só com o título, em português do Brasil.`,
      resultado.slice(0, 4000),
      { maxTokens: 60, timeoutMs: 20_000, credencial },
    );
    return { titulo: limparTitulo(r.texto.split(/\r?\n/)[0]), uso: usoDe(r) };
  } catch (e) {
    console.error("[titulo] reserva falhou:", e instanceof Error ? e.message : e);
    return { titulo: null, uso: null };
  }
}

/** Toda decisão sai com título: se a skill não mandou, grava o de reserva. */
export async function garantirTitulo(
  accountId: string,
  execucaoId: string,
  titulo: string | null,
  resultado: string,
  credencial?: Credencial,
): Promise<void> {
  if (titulo) return;
  const r = await tituloDeReserva(accountId, resultado, credencial);
  if (r.uso) await somarUso(accountId, execucaoId, r.uso);
  if (r.titulo) await gravarTitulo(accountId, execucaoId, r.titulo);
}
