/**
 * Parte comum dos executar.ts das skills: manda o system prompt montado + a
 * entrada para o modelo da conta.
 *
 * Sem `credencial` (scripts locais) ou com a chave da Korely: Anthropic,
 * claude-opus-5-5 com raciocínio adaptativo (como sempre foi). Com a chave do
 * cliente: o provedor e o modelo que ele escolheu, sem raciocínio extra.
 */
import { credencialKorely, modeloDe, SemChaveIA, type Credencial, type OrigemChave } from "@/lib/ia/credencial-base";
import type { ProvedorIA } from "@/lib/ia/provedores/catalogo";
import { chamarModelo } from "@/lib/ia/provedores";
import { comRestricoes, semTravessao } from "@/lib/lista-negra";

export const MODELO_SKILL_KORELY = "claude-opus-5-5";
const MAX_TOKENS = 16000;
const TIMEOUT_MS = 5 * 60 * 1000;

export type EntradaModeloSkill = {
  texto: string;
  imagens?: Array<{ base64: string; mediaType: string }>;
  credencial?: Credencial;
};

export type UsoTokensSkill = {
  entrada: number;
  saida: number;
  cacheLeitura: number;
  cacheEscrita: number;
  total: number;
};

export type SaidaModeloSkill = {
  saida: string;
  usoTokens: UsoTokensSkill;
  modelo: string;
  provedor: ProvedorIA;
  origem: OrigemChave;
};

export async function rodarSkillNoModelo(system: string, entrada: EntradaModeloSkill): Promise<SaidaModeloSkill> {
  if (!entrada.texto?.trim() && !entrada.imagens?.length) {
    throw new Error("Entrada vazia: mande texto ou imagens");
  }
  const cred = entrada.credencial ?? credencialKorely();
  if (!cred) throw new SemChaveIA();
  const modelo = modeloDe(cred, MODELO_SKILL_KORELY);

  const r = await chamarModelo({
    provedor: cred.provedor,
    chave: cred.chave,
    modelo,
    // Lista Negra ativa + travessão proibido no bloco de restrições.
    sistema: await comRestricoes(system),
    mensagens: [{ papel: "usuario", texto: entrada.texto?.trim() ? entrada.texto : "Veja a imagem." }],
    imagens: entrada.imagens,
    maxTokens: MAX_TOKENS,
    timeoutMs: TIMEOUT_MS,
    pensar: cred.origem === "korely",
  });
  if (!r.texto) throw new Error(`Resposta sem texto${r.cortada ? " (cortada no limite de tokens)" : ""}`);

  return {
    saida: semTravessao(r.texto),
    usoTokens: {
      entrada: r.tokensEntrada,
      saida: r.tokensSaida,
      cacheLeitura: 0,
      cacheEscrita: 0,
      total: r.tokensEntrada + r.tokensSaida,
    },
    modelo,
    provedor: cred.provedor,
    origem: cred.origem,
  };
}
