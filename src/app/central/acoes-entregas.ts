"use server";

/**
 * Ações da Central — entregas. accountId SEMPRE de contaCentral(); ids
 * vindos do cliente só servem para achar registros DENTRO da conta.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";

import { contaCentral, contaCentralGeracao, contaCentralLeitura } from "@/app/central/_lib/sessao";
import { mensagemParaDono } from "@/lib/chefes/chamar-modelo";
import { IDS_FONTE, type IdFonte } from "@/lib/central/carrossel";
import { reproduzirEntrega } from "@/lib/central/producao";
import { destravarPresos } from "@/lib/central/producao-trabalho";
import { prisma } from "@/lib/prisma";
import { saveUploadedImage } from "@/lib/uploads";

export async function reproduzirEntregaAcao(entregaId: string): Promise<{ erro: string | null }> {
  let accountId: string;
  try {
    ({ accountId } = await contaCentralGeracao());
  } catch (e) {
    return { erro: mensagemParaDono(e, "Sem acesso agora.") };
  }
  const ok = await reproduzirEntrega(accountId, String(entregaId).slice(0, 64));
  revalidatePath("/central", "layout");
  return { erro: ok ? null : "Essa entrega já está sendo produzida." };
}

/**
 * Assinatura do estado dos trabalhos (status + etapa de cada um): a tela
 * recarrega quando muda. Destrava antes os que passaram do tempo limite.
 */
export async function estadoProducaoAcao(ids: string[]): Promise<string> {
  const { accountId } = await contaCentralLeitura();
  await destravarPresos(accountId);
  const linhas = await prisma.entregaChefe.findMany({
    where: { accountId, id: { in: ids.slice(0, 50).map((i) => String(i).slice(0, 64)) } },
    select: { id: true, status: true, producaoEtapa: true },
    orderBy: { id: "asc" },
  });
  return linhas.map((l) => `${l.id}:${l.status}:${l.producaoEtapa ?? ""}`).join("|");
}

// ---------------------------------------------------------------------------
// Editor de carrossel
// ---------------------------------------------------------------------------

const COR = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const IMAGEM = z
  .string()
  .max(300)
  .regex(/^\/(api\/)?uploads\/carrossel\/[\w.-]+$/)
  .nullable();

const carrosselSchema = z.object({
  slides: z
    .array(
      z.object({
        id: z.string().min(1).max(40),
        titulo: z.string().max(300),
        texto: z.string().max(1200),
        imagem: IMAGEM,
        imagemDica: z.string().max(300).default(""),
        layout: z.enum(["fundo", "metade", "texto"]).optional(),
      }),
    )
    .min(1)
    .max(15),
  marca: z.object({
    fundo: COR,
    texto: COR,
    destaque: COR,
    fonte: z.enum(IDS_FONTE as [IdFonte, ...IdFonte[]]),
    formato: z.enum(["4x5", "1x1"]),
  }),
  legenda: z.string().max(4000).optional(),
});

export async function salvarCarrosselAcao(entregaId: string, dados: unknown): Promise<{ erro: string | null }> {
  let accountId: string;
  try {
    ({ accountId } = await contaCentral());
  } catch (e) {
    return { erro: mensagemParaDono(e, "Sem acesso agora.") };
  }
  const r = carrosselSchema.safeParse(dados);
  if (!r.success) return { erro: "Algo no carrossel não está certo. Recarregue a página." };
  const { legenda, ...conteudo } = r.data;
  const { count } = await prisma.entregaChefe.updateMany({
    where: { id: String(entregaId).slice(0, 64), accountId, tipo: "CARROSSEL" },
    data: {
      conteudo: conteudo as unknown as Prisma.InputJsonValue,
      ...(legenda !== undefined ? { texto: legenda } : {}),
    },
  });
  return { erro: count ? null : "Carrossel não encontrado." };
}

export async function enviarImagemCarrosselAcao(form: FormData): Promise<{ url: string | null; erro: string | null }> {
  try {
    await contaCentral();
  } catch (e) {
    return { url: null, erro: mensagemParaDono(e, "Sem acesso agora.") };
  }
  const arquivo = form.get("imagem");
  if (!(arquivo instanceof File) || !arquivo.size) return { url: null, erro: "Escolha uma imagem." };
  try {
    const url = await saveUploadedImage(arquivo, "carrossel", "slide", { maxWidth: 1600 });
    return { url, erro: null };
  } catch (e) {
    return { url: null, erro: e instanceof Error ? e.message : "Não deu para enviar a imagem." };
  }
}
