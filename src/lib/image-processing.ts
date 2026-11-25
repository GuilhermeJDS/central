import sharp from "sharp";

export type OptimizedImage = {
  buffer: Buffer;
  extension: string;
  mime: string;
};

const WEBP_QUALITY = 80;

/**
 * Formatos convertidos para WebP no upload. GIF fica de fora pra não perder
 * animação (sharp achataria no primeiro frame) e SVG é vetorial.
 */
const CONVERTIBLE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export function isConvertibleToWebp(mime: string): boolean {
  return CONVERTIBLE_MIME_TYPES.has(mime);
}

export async function optimizeImageToWebp(
  buffer: Buffer,
  { maxWidth }: { maxWidth?: number } = {},
): Promise<OptimizedImage> {
  let pipeline = sharp(buffer).rotate();

  if (maxWidth) {
    pipeline = pipeline.resize({ width: maxWidth, withoutEnlargement: true });
  }

  const outBuffer = await pipeline.webp({ quality: WEBP_QUALITY }).toBuffer();

  return { buffer: outBuffer, extension: "webp", mime: "image/webp" };
}
