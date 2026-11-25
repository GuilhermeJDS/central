import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

let cache: Buffer | null = null;

/**
 * Segredo do sistema (32 bytes): cifra as chaves guardadas e assina a sessão.
 * Vem do APP_SECRET (o `npm run setup` gera um). Sem ele, um segredo
 * aleatório é criado em dados/.segredo na primeira vez. Na Vercel o disco
 * some a cada deploy, então lá o APP_SECRET é obrigatório.
 * Trocar o segredo invalida as chaves já salvas e derruba as sessões.
 */
export function segredoSistema(): Buffer {
  if (cache) return cache;
  const env = process.env.APP_SECRET?.trim();
  if (env && env.length >= 16) return (cache = createHash("sha256").update(env).digest());
  if (process.env.VERCEL) throw new Error("Defina a variável APP_SECRET (32+ caracteres aleatórios) no projeto da Vercel.");
  const arquivo = path.join(process.cwd(), "dados", ".segredo");
  if (!existsSync(arquivo)) {
    mkdirSync(path.dirname(arquivo), { recursive: true });
    writeFileSync(arquivo, randomBytes(32).toString("base64url"), { mode: 0o600 });
  }
  return (cache = createHash("sha256").update(readFileSync(arquivo, "utf8").trim()).digest());
}
