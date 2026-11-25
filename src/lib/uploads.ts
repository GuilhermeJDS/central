import "server-only";

import { randomUUID } from "node:crypto";

import { isConvertibleToWebp, optimizeImageToWebp } from "@/lib/image-processing";
import { prisma } from "@/lib/prisma";

/**
 * Uploads guardados no banco (tabela arquivos) e servidos por
 * /api/uploads/<caminho>. Mesmo caminho no PC, na VPS e na Vercel.
 */
export const UPLOAD_API_PREFIX = "/api/uploads";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
/** Limite da imagem que chega pela API dos agentes. */
export const MAX_API_IMAGE_SIZE = 25 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const IMAGE_EXT_BY_MIME: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };

export function buildUploadPublicUrl(caminho: string): string {
  return `${UPLOAD_API_PREFIX}/${caminho.replace(/^\/+/, "")}`;
}

/** "/api/uploads/estudio/x.webp" → "estudio/x.webp" (null se não for upload nosso). */
export function caminhoDoUpload(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = /^\/(?:api\/)?uploads\/([\w/.-]+)$/.exec(url);
  if (!m || m[1].includes("..")) return null;
  return m[1];
}

export function detectImageMimeFromMagicBytes(buffer: Buffer): string | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return "image/png";
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (buffer.length >= 6 && (buffer.toString("ascii", 0, 6) === "GIF87a" || buffer.toString("ascii", 0, 6) === "GIF89a")) return "image/gif";
  return null;
}

export async function saveUploadedImage(file: File, subdir: string, filenamePrefix: string, options: { maxWidth?: number } = {}): Promise<string> {
  if (file.size > MAX_IMAGE_SIZE) throw new Error("Imagem muito grande. O limite é 5 MB.");
  return saveImageBuffer(Buffer.from(await file.arrayBuffer()), subdir, filenamePrefix, options);
}

/** Valida pelos bytes (não pela extensão), converte para WebP e guarda. */
export async function saveImageBuffer(rawBuffer: Buffer, subdir: string, filenamePrefix: string, options: { maxWidth?: number } = {}): Promise<string> {
  const detected = detectImageMimeFromMagicBytes(rawBuffer);
  if (!detected || !ALLOWED_IMAGE_TYPES.has(detected)) throw new Error("Formato de imagem não suportado. Use JPG, PNG, WebP ou GIF.");
  let buffer: Buffer = rawBuffer;
  let tipo = detected;
  let ext = IMAGE_EXT_BY_MIME[detected] ?? "jpg";
  if (isConvertibleToWebp(detected)) {
    const o = await optimizeImageToWebp(rawBuffer, { maxWidth: options.maxWidth });
    buffer = o.buffer;
    tipo = o.mime;
    ext = o.extension;
  }
  const pasta = subdir.replace(/[^\w/-]/g, "").replace(/^\/+|\/+$/g, "") || "geral";
  const prefixo = filenamePrefix.replace(/[^\w-]/g, "").slice(0, 40) || "img";
  const caminho = `${pasta}/${prefixo}-${randomUUID()}.${ext}`;
  await prisma.arquivo.create({ data: { caminho, tipo, tamanho: buffer.length, dados: new Uint8Array(buffer) } });
  return buildUploadPublicUrl(caminho);
}

/** Bytes de um upload nosso (para mandar a imagem ao modelo, por exemplo). */
export async function lerUpload(url: string): Promise<{ bytes: Buffer; tipo: string } | null> {
  const caminho = caminhoDoUpload(url);
  if (!caminho) return null;
  const a = await prisma.arquivo.findUnique({ where: { caminho }, select: { dados: true, tipo: true } });
  return a ? { bytes: Buffer.from(a.dados), tipo: a.tipo } : null;
}

export async function removeUploadedImage(url: string | null | undefined) {
  const caminho = caminhoDoUpload(url);
  if (caminho) await prisma.arquivo.deleteMany({ where: { caminho } });
}
