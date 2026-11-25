/**
 * Parte da credencial sem banco nem cofre (serve também aos scripts tsx).
 * O resto (chave do cliente) fica em credencial.ts, só servidor.
 */
import type { ProvedorIA } from "@/lib/ia/provedores/catalogo";

/** "ambiente": ANTHROPIC_API_KEY do .env (scripts e testes locais). */
export type OrigemChave = "cliente" | "ambiente";

export type Credencial = {
  provedor: ProvedorIA;
  chave: string;
  /** null = chave do ambiente: quem chama usa o modelo padrão dele. */
  modelo: string | null;
  origem: OrigemChave;
};

export const MENSAGEM_SEM_CHAVE = "Conecte a sua chave de IA para os chefes trabalharem no seu negócio.";

export class SemChaveIA extends Error {
  constructor() {
    super(MENSAGEM_SEM_CHAVE);
    this.name = "SemChaveIA";
  }
}

export function credencialAmbiente(): Credencial | null {
  const chave = process.env.ANTHROPIC_API_KEY?.trim();
  return chave ? { provedor: "ANTHROPIC", chave, modelo: null, origem: "ambiente" } : null;
}

/**
 * Chave do ambiente (ANTHROPIC_API_KEY do .env). Só scripts locais usam;
 * os chefes da Central sempre rodam com a chave que a pessoa colou.
 */
export function credencialAmbientePainel(): Credencial {
  const c = credencialAmbiente();
  if (!c) throw new Error("Os chefes estão fora do ar agora. Tente de novo em alguns minutos.");
  return c;
}

export function modeloDe(c: Credencial, padrao: string): string {
  return c.modelo ?? padrao;
}
