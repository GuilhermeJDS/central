/**
 * Parte da credencial sem banco nem cofre (serve também aos scripts tsx).
 * O resto (chave do cliente) fica em credencial.ts, só servidor.
 */
import type { ProvedorIA } from "@/lib/ia/provedores/catalogo";

export type OrigemChave = "cliente" | "korely";

export type Credencial = {
  provedor: ProvedorIA;
  chave: string;
  /** null = chave da Korely: quem chama usa o modelo padrão dele. */
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

export function credencialKorely(): Credencial | null {
  const chave = process.env.ANTHROPIC_API_KEY?.trim();
  return chave ? { provedor: "ANTHROPIC", chave, modelo: null, origem: "korely" } : null;
}

/**
 * Painel da unidade: sempre a chave da Korely (ANTHROPIC_API_KEY), nunca a do
 * cliente. Sem a variável no servidor, erro que pode ir para o dono.
 */
export function credencialKorelyPainel(): Credencial {
  const c = credencialKorely();
  if (!c) throw new Error("Os chefes estão fora do ar agora. Tente de novo em alguns minutos.");
  return c;
}

export function modeloDe(c: Credencial, padraoKorely: string): string {
  return c.modelo ?? padraoKorely;
}
