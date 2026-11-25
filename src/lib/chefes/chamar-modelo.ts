/**
 * Chamada ao modelo dos chefes. Usa a chave da conta (lib/ia/credencial):
 * a do cliente, no provedor e modelo que ele escolheu, ou a da Korely
 * (Anthropic, MODELO_CHEFES). Lança erro em vez de devolver null, para o
 * chamador registrar a falha na execução.
 */
import { semIdDeSkill } from "@/lib/central/nome-acao";
import "server-only";

import { credencialDaConta, modeloDe, SemChaveIA, type Credencial, type OrigemChave } from "@/lib/ia/credencial";
import { CATALOGO_IA, type ProvedorIA } from "@/lib/ia/provedores/catalogo";
import { chamarModelo as chamarProvedor, ErroProvedor } from "@/lib/ia/provedores";
import { comRestricoes, semTravessao } from "@/lib/lista-negra";
import { CATALOGO_REDES } from "@/lib/redes/catalogo";

export const MODELO_CHEFES = "claude-haiku-5-5";

/** O que vai para concluirExecucao (custo, modelo e provedor). */
export type UsoModelo = {
  modelo: string;
  provedor: ProvedorIA;
  origem: OrigemChave;
  tokensEntrada: number;
  tokensSaida: number;
};

export type RespostaModelo = UsoModelo & { texto: string };

export async function chamarModelo(
  accountId: string,
  system: string,
  mensagem: string,
  opts: { maxTokens: number; timeoutMs: number; credencial?: Credencial; /** Usa o modelo escolhido para este chefe. */ chefe?: string },
): Promise<RespostaModelo> {
  const cred = opts.credencial ?? (await credencialDaConta(accountId, opts.chefe));
  const modelo = modeloDe(cred, MODELO_CHEFES);
  const r = await chamarProvedor({
    provedor: cred.provedor,
    chave: cred.chave,
    modelo,
    // Lista Negra ativa + travessão proibido no bloco de restrições.
    sistema: await comRestricoes(system),
    mensagens: [{ papel: "usuario", texto: mensagem }],
    maxTokens: opts.maxTokens,
    timeoutMs: opts.timeoutMs,
  });
  if (r.cortada) throw new Error("Resposta do modelo cortada (limite de tokens)");
  if (!r.texto) throw new Error("Modelo respondeu sem texto");
  return {
    texto: semTravessao(r.texto),
    modelo,
    provedor: cred.provedor,
    origem: cred.origem,
    tokensEntrada: r.tokensEntrada,
    tokensSaida: r.tokensSaida,
  };
}

/** Só os campos de uso, para espalhar em concluirExecucao. */
export function usoDe(r: UsoModelo): UsoModelo {
  return {
    modelo: r.modelo,
    provedor: r.provedor,
    origem: r.origem,
    tokensEntrada: r.tokensEntrada,
    tokensSaida: r.tokensSaida,
  };
}

/** Extrai o primeiro objeto JSON `{...}` do texto (tolera texto em volta). */
export function extrairJson(texto: string): unknown {
  const inicio = texto.indexOf("{");
  const fim = texto.lastIndexOf("}");
  if (inicio === -1 || fim <= inicio) throw new Error("Modelo não devolveu JSON");
  try {
    return JSON.parse(texto.slice(inicio, fim + 1));
  } catch {
    throw new Error("JSON do modelo inválido");
  }
}

export function mensagemDeErro(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

const FORA_DO_FORMATO = /não devolveu JSON|JSON do modelo inválido|Chefe escolheu|Modelo respondeu sem texto|cortada/;

/**
 * Mensagem que pode ir para o dono: chave faltando, erro do provedor (sem a
 * chave), resposta fora do formato ou trava dos chefes. O resto vira `padrao`.
 */
export function mensagemParaDono(e: unknown, padrao: string): string {
  return semIdDeSkill(mensagemCrua(e, padrao));
}

function mensagemCrua(e: unknown, padrao: string): string {
  if (e instanceof SemChaveIA || e instanceof ErroProvedor) return e.message;
  const m = mensagemDeErro(e);
  if (m.startsWith("Os chefes") || m.startsWith("Para os chefes") || m.startsWith("Conecte sua chave") || m.startsWith("Conecte a sua chave") || m.startsWith("Escolha um plano")) return m;
  // Erro das redes conectadas (já sem token) ou busca de virais vazia.
  if (m.startsWith("Não achei posts") || Object.values(CATALOGO_REDES).some((r) => m.startsWith(`${r.nome}:`))) return m;
  // Erro do provedor que já virou texto (gravado na execução): já vem sem a chave.
  if (Object.values(CATALOGO_IA).some((i) => m.startsWith(`${i.nome}:`))) return m;
  if (FORA_DO_FORMATO.test(m))
    return "O modelo respondeu fora do formato esperado. Tente de novo ou escolha outro modelo na Chave de IA.";
  return padrao;
}
