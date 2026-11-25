/**
 * Cores da marca do cliente para o carrossel: Estúdio › Marca › Identidade.
 * Sem identidade preenchida, a paleta neutra da Central.
 */
import "server-only";

import { IDS_FONTE, type IdFonte, type MarcaCarrossel } from "@/lib/central/carrossel";
import { prisma } from "@/lib/prisma";

const HEX = /^#[0-9a-f]{6}$/i;

export const MARCA_PADRAO: MarcaCarrossel = {
  fundo: "#F5F4F1",
  texto: "#1A1A1A",
  destaque: "#2F6AF7",
  fonte: "bricolage",
  formato: "4x5",
};

export async function marcaDoCliente(accountId: string): Promise<MarcaCarrossel> {
  const base = await marcaDoSite(accountId);
  // Estúdio › Marca › Identidade manda nas cores e na fonte, quando preenchida.
  const id = await prisma.identidadeMarca.findUnique({
    where: { accountId },
    select: { corFundo: true, corTexto: true, corDestaque: true, fonte: true },
  });
  if (!id) return base;
  return {
    ...base,
    fundo: id.corFundo && HEX.test(id.corFundo) ? id.corFundo : base.fundo,
    texto: id.corTexto && HEX.test(id.corTexto) ? id.corTexto : base.texto,
    destaque: id.corDestaque && HEX.test(id.corDestaque) ? id.corDestaque : base.destaque,
    fonte: id.fonte && IDS_FONTE.includes(id.fonte as IdFonte) ? (id.fonte as IdFonte) : base.fonte,
  };
}

/** Base antes da Identidade: na versão aberta não existe site da unidade. */
export async function marcaDoSite(_accountId: string): Promise<MarcaCarrossel> {
  return MARCA_PADRAO;
}
