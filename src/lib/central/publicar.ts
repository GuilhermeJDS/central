import "server-only";

import { agendarNoBuffer, BufferDesligado, canaisBuffer, SERVICO_DA_REDE } from "@/lib/buffer";
import { ativo, enderecoPublico } from "@/lib/config";
import { prisma } from "@/lib/prisma";

/**
 * Peça aprovada e com data no Cronograma → fila do Buffer, no dia e hora.
 * O Buffer baixa as imagens pelo link: por isso elas precisam estar num
 * endereço público (VPS ou Vercel). No computador, só texto vai.
 */
export type ResultadoPublicar = { ok: boolean; mensagem: string };

const NOME_REDE: Record<string, string> = { INSTAGRAM: "Instagram", TIKTOK: "TikTok", YOUTUBE: "YouTube", LINKEDIN: "LinkedIn", X: "X", GOOGLE_EMPRESA: "Google" };

export async function bufferLigado(): Promise<boolean> {
  const r = await ativo("buffer");
  return Boolean(r?.valores.apiKey);
}

function enderecoLocal(base: string): boolean {
  return /^https?:\/\/(localhost|127\.|0\.0\.0\.0|192\.168\.|10\.)/.test(base);
}

export async function publicarNoBuffer(accountId: string, entregaId: string, imagens: string[] = []): Promise<ResultadoPublicar> {
  const e = await prisma.entregaChefe.findFirst({
    where: { id: entregaId, accountId },
    select: { id: true, rede: true, texto: true, tipo: true, etapa: true, programadaPara: true, bufferId: true },
  });
  if (!e) return { ok: false, mensagem: "Peça não encontrada." };
  if (e.etapa === "EM_REVISAO") return { ok: false, mensagem: "Aprove a peça antes de mandar." };
  if (!e.rede) return { ok: false, mensagem: "A peça não tem rede. Escolha a rede no estúdio." };
  if (!e.texto?.trim() && !imagens.length) return { ok: false, mensagem: "A peça está sem texto." };

  const base = await enderecoPublico();
  if (imagens.length && enderecoLocal(base)) {
    return { ok: false, mensagem: `O Buffer não consegue baixar imagem de ${base}. Publique a Central numa VPS ou na Vercel, ou mande só o texto e suba as imagens no app do Buffer.` };
  }
  try {
    const servicos = SERVICO_DA_REDE[e.rede] ?? [];
    const canal = (await canaisBuffer()).find((c) => servicos.includes(c.servico));
    if (!canal) return { ok: false, mensagem: `Não tem ${NOME_REDE[e.rede] ?? e.rede} conectado no Buffer. Conecte a rede lá e tente de novo.` };
    const quando = e.programadaPara && e.programadaPara.getTime() > Date.now() + 5 * 60_000 ? e.programadaPara : null;
    const { id } = await agendarNoBuffer({
      canalId: canal.id,
      texto: e.texto ?? "",
      imagens: imagens.map((u) => (u.startsWith("http") ? u : `${base}${u}`)),
      quando,
    });
    await prisma.entregaChefe.update({
      where: { id: e.id, accountId },
      data: { bufferId: id, bufferEnviadaEm: new Date(), bufferErro: null, ...(e.etapa === "APROVADO" && quando ? { etapa: "PROGRAMADO" } : {}) },
    });
    const dia = quando ? quando.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : null;
    return { ok: true, mensagem: dia ? `Na fila do Buffer (${canal.nome}) para ${dia}.` : `Na fila do Buffer (${canal.nome}), no próximo horário livre.` };
  } catch (err) {
    const mensagem = err instanceof BufferDesligado ? err.message : err instanceof Error ? err.message : "O Buffer não aceitou.";
    await prisma.entregaChefe.update({ where: { id: e.id, accountId }, data: { bufferErro: mensagem.slice(0, 400) } });
    return { ok: false, mensagem };
  }
}

/** Ao pôr data numa peça de texto: vai sozinha para o Buffer (carrossel precisa das imagens: botão no estúdio). */
export async function publicarSeDer(accountId: string, entregaId: string): Promise<void> {
  if (!(await bufferLigado())) return;
  const e = await prisma.entregaChefe.findFirst({ where: { id: entregaId, accountId }, select: { tipo: true, bufferId: true, programadaPara: true } });
  if (!e || e.bufferId || !e.programadaPara || e.tipo === "CARROSSEL") return;
  await publicarNoBuffer(accountId, entregaId).catch(() => {});
}
