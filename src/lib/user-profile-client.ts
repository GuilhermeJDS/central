/**
 * Constantes e validação de foto de perfil seguros para Client Components.
 * A lógica de persistência fica em `user-profile.ts` (server-only).
 */

export const MAX_PROFILE_PHOTO_SIZE = 5 * 1024 * 1024;
export const ALLOWED_PROFILE_PHOTO_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export const PROFILE_PHOTO_HELPER_TEXT = "JPG, PNG ou WebP, máximo 5 MB";
export const PROFILE_PHOTO_SIZE_ERROR =
  "A imagem deve ter no máximo 5 MB.";
export const PROFILE_PHOTO_TYPE_ERROR =
  "Envie uma imagem JPG, PNG ou WebP.";
export const PROFILE_PHOTO_EMPTY_ERROR = "Selecione uma imagem válida.";
export const PROFILE_PHOTO_GENERIC_ERROR =
  "Não foi possível atualizar sua foto. Tente novamente.";

export const PROFILE_PHOTO_UPLOAD_URL = "/api/perfil/foto";
export const PROFILE_PHOTO_FILENAME_HEADER = "x-central-filename";
export const PROFILE_PHOTO_MIME_HEADER = "x-central-mime";

export type ProfilePhotoValidation =
  | { ok: true; mimeType: string }
  | { ok: false; message: string };

const EXT_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/** Infere MIME a partir do nome quando o browser manda type vazio. */
export function resolveProfilePhotoMime(
  file: { type?: string; name?: string },
): string | null {
  const raw = (file.type ?? "").trim().toLowerCase();
  if (ALLOWED_PROFILE_PHOTO_TYPES.has(raw)) {
    return raw;
  }

  const name = file.name ?? "";
  const ext = name.includes(".")
    ? name.slice(name.lastIndexOf(".") + 1).toLowerCase()
    : "";
  const fromExt = EXT_MIME[ext];
  return fromExt && ALLOWED_PROFILE_PHOTO_TYPES.has(fromExt) ? fromExt : null;
}

/** Valida tipo e tamanho de foto de perfil (cliente e servidor). */
export function validateProfilePhotoFile(file: {
  type?: string;
  name?: string;
  size: number;
}): ProfilePhotoValidation {
  if (!file || file.size <= 0) {
    return { ok: false, message: PROFILE_PHOTO_EMPTY_ERROR };
  }

  const mimeType = resolveProfilePhotoMime(file);
  if (!mimeType) {
    return { ok: false, message: PROFILE_PHOTO_TYPE_ERROR };
  }

  if (file.size > MAX_PROFILE_PHOTO_SIZE) {
    return { ok: false, message: PROFILE_PHOTO_SIZE_ERROR };
  }

  return { ok: true, mimeType };
}
