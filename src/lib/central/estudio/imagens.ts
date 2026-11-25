/**
 * Imagens do estúdio: identidade da marca (estilo + personagem), biblioteca
 * de imagens e geração com o modelo de imagem do CLIENTE (chave da OpenAI ou
 * do Gemini em Conexões). Nunca usa a chave da Korely para imagem.
 *
 * Mesmo estilo e mesmo personagem em todos os slides de uma peça: o pedido
 * leva o estilo e o personagem da Identidade e, a partir da segunda imagem
 * da peça, a primeira imagem gerada vai junto como referência (OpenAI:
 * /images/edits; Gemini: imagem na mesma mensagem).
 *
 * A chave decifrada fica só na memória durante a chamada.
 */
import "server-only";

import fs from "node:fs/promises";
import path from "node:path";

import { decifrar } from "@/lib/ia/cofre";
import { prisma } from "@/lib/prisma";
import { lerUpload, saveUploadedImage } from "@/lib/uploads";

export type ProvedorImagem = "OPENAI" | "GOOGLE";
export const NOME_PROVEDOR_IMAGEM: Record<ProvedorImagem, string> = { OPENAI: "OpenAI", GOOGLE: "Gemini" };
const MODELO_IMAGEM: Record<ProvedorImagem, string> = {
  OPENAI: process.env.ESTUDIO_MODELO_IMAGEM_OPENAI || "gpt-image-1",
  GOOGLE: process.env.ESTUDIO_MODELO_IMAGEM_GEMINI || "gemini-2.5-flash-image",
};
const TEMPO_MS = 120_000;

export type IdentidadeView = {
  estilo: string;
  personagem: string;
  provedorImagem: ProvedorImagem | null;
  referenciaUrl: string | null;
  corFundo: string | null;
  corTexto: string | null;
  corDestaque: string | null;
  fonte: string | null;
};

export async function obterIdentidade(accountId: string): Promise<IdentidadeView> {
  const i = await prisma.identidadeMarca.findUnique({ where: { accountId } });
  return {
    estilo: i?.estilo ?? "",
    personagem: i?.personagem ?? "",
    provedorImagem: i?.provedorImagem === "OPENAI" || i?.provedorImagem === "GOOGLE" ? i.provedorImagem : null,
    referenciaUrl: i?.referenciaUrl ?? null,
    corFundo: i?.corFundo ?? null,
    corTexto: i?.corTexto ?? null,
    corDestaque: i?.corDestaque ?? null,
    fonte: i?.fonte ?? null,
  };
}

/** Provedores de imagem com chave validada na conta. */
export async function provedoresDeImagem(accountId: string): Promise<ProvedorImagem[]> {
  const chaves = await prisma.chaveIa.findMany({
    where: { accountId, validaEm: { not: null }, provedor: { in: ["OPENAI", "GOOGLE"] } },
    select: { provedor: true },
  });
  return chaves.map((c) => c.provedor as ProvedorImagem);
}

export class SemChaveImagem extends Error {
  constructor() {
    super("Para gerar imagens, conecte uma chave da OpenAI ou do Gemini em Conexões.");
  }
}

async function chaveDeImagem(accountId: string, preferido: ProvedorImagem | null): Promise<{ provedor: ProvedorImagem; chave: string }> {
  const chaves = await prisma.chaveIa.findMany({
    where: { accountId, validaEm: { not: null }, provedor: { in: ["OPENAI", "GOOGLE"] } },
    select: { provedor: true, chaveCifrada: true },
  });
  const c = chaves.find((k) => k.provedor === preferido) ?? chaves[0];
  if (!c) throw new SemChaveImagem();
  return { provedor: c.provedor as ProvedorImagem, chave: decifrar(c.chaveCifrada) };
}

async function lerLocal(url: string): Promise<{ bytes: Buffer; tipo: string } | null> {
  return lerUpload(url);
}

function pedidoDaImagem(cena: string, id: IdentidadeView, nicho: string): string {
  return [
    `Foto para um post de ${nicho}, formato vertical 4:5.`,
    id.estilo ? `Estilo (mantenha igual em todas as imagens): ${id.estilo}.` : "Estilo: foto realista, luz natural suave, cores calmas.",
    id.personagem ? `Pessoa que aparece (sempre a mesma, mesmo rosto, cabelo e roupa): ${id.personagem}.` : "",
    `Cena: ${cena}.`,
    "Sem texto, letras, logotipos ou marcas d'água na imagem.",
  ]
    .filter(Boolean)
    .join("\n");
}

async function chamarOpenAI(chave: string, prompt: string, referencia: { bytes: Buffer; tipo: string } | null): Promise<Buffer> {
  let r: Response;
  if (referencia) {
    const form = new FormData();
    form.set("model", MODELO_IMAGEM.OPENAI);
    form.set("prompt", `${prompt}\nUse a imagem anexada como referência de estilo e de personagem.`);
    form.set("size", "1024x1536");
    form.append("image[]", new Blob([new Uint8Array(referencia.bytes)], { type: referencia.tipo }), "referencia.png");
    r = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${chave}` },
      body: form,
      signal: AbortSignal.timeout(TEMPO_MS),
    });
  } else {
    r = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODELO_IMAGEM.OPENAI, prompt, size: "1024x1536", n: 1 }),
      signal: AbortSignal.timeout(TEMPO_MS),
    });
  }
  if (!r.ok) throw new Error(mensagemHttp("OpenAI", r.status));
  const d = (await r.json()) as { data?: { b64_json?: string }[] };
  const b64 = d.data?.[0]?.b64_json;
  if (!b64) throw new Error("A OpenAI não devolveu a imagem. Tente de novo.");
  return Buffer.from(b64, "base64");
}

async function chamarGemini(chave: string, prompt: string, referencia: { bytes: Buffer; tipo: string } | null): Promise<Buffer> {
  const parts: unknown[] = [];
  if (referencia) parts.push({ inline_data: { mime_type: referencia.tipo, data: referencia.bytes.toString("base64") } });
  parts.push({ text: referencia ? `${prompt}\nUse a imagem anexada como referência de estilo e de personagem.` : prompt });
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODELO_IMAGEM.GOOGLE)}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": chave },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "4:5" } },
      }),
      signal: AbortSignal.timeout(TEMPO_MS),
    },
  );
  if (!r.ok) throw new Error(mensagemHttp("Gemini", r.status));
  const d = (await r.json()) as {
    candidates?: { content?: { parts?: { inlineData?: { data?: string }; inline_data?: { data?: string } }[] } }[];
  };
  const parte = d.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data || p.inline_data?.data);
  const b64 = parte?.inlineData?.data ?? parte?.inline_data?.data;
  if (!b64) throw new Error("O Gemini não devolveu a imagem (pode ter recusado o pedido). Mude a descrição e tente de novo.");
  return Buffer.from(b64, "base64");
}

function mensagemHttp(nome: string, status: number): string {
  if (status === 401 || status === 403) return `${nome}: a chave não tem permissão para gerar imagem. Confira em Conexões.`;
  if (status === 429) return `${nome}: limite de uso atingido. Tente daqui a pouco.`;
  if (status === 400) return `${nome}: o pedido foi recusado. Mude a descrição da cena.`;
  return `${nome} não respondeu agora (${status}). Tente de novo.`;
}

/**
 * Gera uma imagem para a peça e guarda na biblioteca. A referência é, nesta
 * ordem: a pedida, a primeira imagem gerada da peça, a referência da Identidade.
 */
export async function gerarImagem(
  accountId: string,
  dados: { cena: string; entregaId?: string | null; referenciaUrl?: string | null; nicho: string },
): Promise<{ id: string; url: string; provedor: ProvedorImagem }> {
  const id = await obterIdentidade(accountId);
  const { provedor, chave } = await chaveDeImagem(accountId, id.provedorImagem);
  const primeiraDaPeca = dados.entregaId
    ? await prisma.imagemMarca.findFirst({
        where: { accountId, entregaId: dados.entregaId, origem: "GERADA" },
        orderBy: { criadaEm: "asc" },
        select: { url: true },
      })
    : null;
  const refUrl = dados.referenciaUrl ?? primeiraDaPeca?.url ?? id.referenciaUrl;
  const referencia = refUrl ? await lerLocal(refUrl) : null;
  const prompt = pedidoDaImagem(dados.cena.slice(0, 600), id, dados.nicho);
  const bytes = provedor === "OPENAI" ? await chamarOpenAI(chave, prompt, referencia) : await chamarGemini(chave, prompt, referencia);
  const url = await saveUploadedImage(new File([new Uint8Array(bytes)], "gerada.png", { type: "image/png" }), "carrossel", "gerada", {
    maxWidth: 1600,
  });
  const img = await prisma.imagemMarca.create({
    data: { accountId, url, origem: "GERADA", prompt: dados.cena.slice(0, 2000), provedor, entregaId: dados.entregaId ?? null },
  });
  return { id: img.id, url, provedor };
}

export type ImagemView = {
  id: string;
  url: string;
  origem: "GERADA" | "ENVIADA";
  prompt: string | null;
  provedor: string | null;
  entregaId: string | null;
  em: string;
};

export async function listarImagens(accountId: string, limite = 120): Promise<ImagemView[]> {
  const l = await prisma.imagemMarca.findMany({ where: { accountId }, orderBy: { criadaEm: "desc" }, take: limite });
  return l.map((i) => ({
    id: i.id,
    url: i.url,
    origem: i.origem === "GERADA" ? "GERADA" : "ENVIADA",
    prompt: i.prompt,
    provedor: i.provedor,
    entregaId: i.entregaId,
    em: i.criadaEm.toISOString(),
  }));
}
