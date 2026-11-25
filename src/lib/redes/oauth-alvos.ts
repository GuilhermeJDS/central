/** Alvos do "Conectar com…" (módulo puro: vai para a tela também). */
import type { RedeConectavel } from "@/lib/redes/catalogo";

export const ALVOS_OAUTH = ["instagram", "youtube", "google-empresa", "linkedin", "x", "openrouter"] as const;
export type AlvoOAuth = (typeof ALVOS_OAUTH)[number];

export function ehAlvoOAuth(v: unknown): v is AlvoOAuth {
  return typeof v === "string" && (ALVOS_OAUTH as readonly string[]).includes(v);
}

export const REDE_DO_ALVO: Record<Exclude<AlvoOAuth, "openrouter">, RedeConectavel> = {
  instagram: "INSTAGRAM",
  youtube: "YOUTUBE",
  "google-empresa": "GOOGLE_EMPRESA",
  linkedin: "LINKEDIN",
  x: "X",
};

export const ALVO_DA_REDE: Record<RedeConectavel, AlvoOAuth> = {
  INSTAGRAM: "instagram",
  YOUTUBE: "youtube",
  GOOGLE_EMPRESA: "google-empresa",
  LINKEDIN: "linkedin",
  X: "x",
};

