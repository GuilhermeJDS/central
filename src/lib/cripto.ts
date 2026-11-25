import "server-only";

import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

import { segredoSistema } from "@/lib/segredo";

const scryptAsync = promisify(scrypt) as (s: string, salt: Buffer, len: number) => Promise<Buffer>;

/** O mesmo segredo do cofre (lib/segredo): APP_SECRET ou dados/.segredo. */
export async function segredo(): Promise<Buffer> {
  return segredoSistema();
}

export async function cifrar(texto: string): Promise<string> {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", await segredo(), iv);
  const corpo = Buffer.concat([c.update(texto, "utf8"), c.final()]);
  return `v1.${iv.toString("base64url")}.${c.getAuthTag().toString("base64url")}.${corpo.toString("base64url")}`;
}

export async function decifrar(cifrado: string): Promise<string | null> {
  const [v, iv, tag, corpo] = cifrado.split(".");
  if (v !== "v1" || !iv || !tag || !corpo) return null;
  try {
    const d = createDecipheriv("aes-256-gcm", await segredo(), Buffer.from(iv, "base64url"));
    d.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([d.update(Buffer.from(corpo, "base64url")), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export async function assinar(dado: string): Promise<string> {
  return createHmac("sha256", await segredo()).update(dado).digest("base64url");
}

export function iguais(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const aleatorio = (bytes = 24) => randomBytes(bytes).toString("base64url");

export async function hashSenha(senha: string): Promise<string> {
  const salt = randomBytes(16);
  const h = await scryptAsync(senha.normalize("NFKC"), salt, 64);
  return `scrypt.${salt.toString("base64url")}.${h.toString("base64url")}`;
}

export async function conferirSenha(senha: string, guardado: string): Promise<boolean> {
  const [alg, salt, h] = guardado.split(".");
  if (alg !== "scrypt" || !salt || !h) return false;
  const calc = await scryptAsync(senha.normalize("NFKC"), Buffer.from(salt, "base64url"), 64);
  const esperado = Buffer.from(h, "base64url");
  return calc.length === esperado.length && timingSafeEqual(calc, esperado);
}
