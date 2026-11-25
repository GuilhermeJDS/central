/**
 * Cofre das chaves de IA dos clientes: AES-256-GCM.
 *
 * Chave mestra: o segredo do sistema (lib/segredo, APP_SECRET). Formato gravado:
 * "v1:<iv base64>:<tag base64>:<cifrado base64>".
 *
 * A chave do cliente nunca vai para log, erro ou resposta: os erros daqui
 * não citam o conteúdo, e a tela só recebe `ultimos4`.
 */
import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

import { segredoSistema } from "@/lib/segredo";

const ALGORITMO = "aes-256-gcm";
const VERSAO = "v1";

const chaveMestra = segredoSistema;

export function cifrar(texto: string): string {
  const iv = randomBytes(12);
  const cifra = createCipheriv(ALGORITMO, chaveMestra(), iv);
  const cifrado = Buffer.concat([cifra.update(texto, "utf8"), cifra.final()]);
  const tag = cifra.getAuthTag();
  return [VERSAO, iv.toString("base64"), tag.toString("base64"), cifrado.toString("base64")].join(":");
}

export function decifrar(guardado: string): string {
  const [versao, iv, tag, cifrado] = guardado.split(":");
  if (versao !== VERSAO || !iv || !tag || !cifrado) throw new Error("Chave guardada em formato desconhecido.");
  try {
    const decifra = createDecipheriv(ALGORITMO, chaveMestra(), Buffer.from(iv, "base64"));
    decifra.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([decifra.update(Buffer.from(cifrado, "base64")), decifra.final()]).toString("utf8");
  } catch {
    // Sem detalhe de propósito: nada do conteúdo vaza no erro.
    throw new Error("Não deu para abrir a chave guardada (o APP_SECRET mudou?).");
  }
}

/** Só os 4 últimos caracteres, para a tela. */
export function ultimos4(chave: string): string {
  return chave.trim().slice(-4);
}
