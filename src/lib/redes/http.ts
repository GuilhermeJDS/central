/**
 * HTTP dos coletores: timeout, JSON tolerante e mensagens sem segredo.
 *
 * Os tokens podem ir na URL (Meta, Google tokeninfo): por isso a URL nunca
 * entra em erro nem em log, e todo texto da API passa por `limpar`.
 */
import "server-only";

import { createHash } from "crypto";

import type { RedeConectavel } from "@/lib/redes/catalogo";
import { ErroRede } from "@/lib/redes/tipos";

export type RespostaHttp = { status: number; corpo: unknown; headers: Headers };

const TIMEOUT_MS = 15_000;

/** Mascara os segredos e corta: seguro para mensagem ao dono. */
export function limpar(texto: unknown, segredos: Array<string | null | undefined>): string {
  let t = typeof texto === "string" ? texto : "";
  for (const s of segredos) {
    if (s && s.length >= 6) t = t.split(s).join("•••");
  }
  // Qualquer coisa com cara de token que escapou.
  t = t.replace(/\b(EAA|IGAA|IG|AIza|ya29\.|1\/\/|AAAA)[\w.\-%/]{12,}/g, "•••");
  return t.replace(/\s+/g, " ").trim().slice(0, 220);
}

/** Identificador estável do token para limites/cache, sem guardar o token. */
export function impressao(token: string): string {
  return createHash("sha256").update(token).digest("hex").slice(0, 16);
}

export async function pedir(
  rede: RedeConectavel,
  url: string,
  opts: { headers?: Record<string, string>; metodo?: "GET" | "POST"; corpo?: string; timeoutMs?: number } = {},
): Promise<RespostaHttp> {
  let r: Response;
  try {
    r = await fetch(url, {
      method: opts.metodo ?? "GET",
      headers: { Accept: "application/json", ...opts.headers },
      body: opts.corpo,
      signal: AbortSignal.timeout(opts.timeoutMs ?? TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (e) {
    const tempo = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    throw new ErroRede(rede, "indisponivel", tempo ? "demorou demais para responder. Tente de novo." : "não respondeu agora. Tente de novo.");
  }
  const texto = await r.text();
  let corpo: unknown = null;
  try {
    corpo = texto ? JSON.parse(texto) : null;
  } catch {
    corpo = null;
  }
  return { status: r.status, corpo, headers: r.headers };
}

/** Acesso seguro a campos de JSON desconhecido. */
export function campo(obj: unknown, ...caminho: Array<string | number>): unknown {
  let atual: unknown = obj;
  for (const c of caminho) {
    if (atual === null || typeof atual !== "object") return undefined;
    atual = (atual as Record<string | number, unknown>)[c];
  }
  return atual;
}

export function texto(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

export function lista(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
