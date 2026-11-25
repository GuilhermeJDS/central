/**
 * Uma porta só para qualquer provedor de IA:
 *   chamarModelo({ provedor, chave, modelo, sistema, mensagens, imagens? })
 *     → { texto, tokensEntrada, tokensSaida, cortada }
 *
 * Erros saem como ErroProvedor (tipo + mensagem em português, sem a chave).
 * Texto vazio não é erro aqui: quem chama decide (o teste de chave aceita).
 *
 * Só servidor. Sem `import "server-only"` para os scripts de teste (tsx)
 * rodarem; a trava abaixo impede o uso no navegador.
 */
import { chamarAnthropic } from "@/lib/ia/provedores/anthropic";
import { CATALOGO_IA, type ProvedorIA } from "@/lib/ia/provedores/catalogo";
import { chamarGoogle } from "@/lib/ia/provedores/google";
import { chamarOpenAICompativel } from "@/lib/ia/provedores/openai-compativel";
import { ErroProvedor, type PedidoModelo, type RespostaModelo } from "@/lib/ia/provedores/tipos";

export { ErroProvedor } from "@/lib/ia/provedores/tipos";
export type { ImagemModelo, MensagemModelo, PedidoModelo, RespostaModelo } from "@/lib/ia/provedores/tipos";

if (typeof window !== "undefined") {
  throw new Error("Provedores de IA só rodam no servidor");
}

const TIMEOUT_PADRAO_MS = 60_000;
const MAX_TOKENS_PADRAO = 4096;

export async function chamarModelo(p: PedidoModelo): Promise<RespostaModelo> {
  if (!p.chave.trim()) throw new ErroProvedor(p.provedor, "chave_invalida");
  if (!p.modelo.trim()) throw new ErroProvedor(p.provedor, "modelo_inexistente");
  if (p.imagens?.length && !CATALOGO_IA[p.provedor].leImagem) throw new ErroProvedor(p.provedor, "sem_imagem");
  const maxTokens = p.maxTokens ?? MAX_TOKENS_PADRAO;
  const timeoutMs = p.timeoutMs ?? TIMEOUT_PADRAO_MS;
  switch (p.provedor) {
    case "ANTHROPIC":
      return chamarAnthropic(p, maxTokens, timeoutMs);
    case "GOOGLE":
      return chamarGoogle(p, maxTokens, timeoutMs);
    case "OPENAI":
    case "DEEPSEEK":
    case "XAI":
    case "OPENROUTER":
      return chamarOpenAICompativel(p, maxTokens, timeoutMs);
  }
}

/**
 * Chamada mínima para conferir chave + modelo. Qualquer resposta 2xx vale,
 * mesmo vazia (modelos de raciocínio podem gastar os poucos tokens pensando).
 */
export async function testarChave(provedor: ProvedorIA, chave: string, modelo: string): Promise<void> {
  await chamarModelo({
    provedor,
    chave,
    modelo,
    sistema: "Responda só com a palavra OK.",
    mensagens: [{ papel: "usuario", texto: "Teste de conexão. Responda OK." }],
    maxTokens: 64,
    timeoutMs: 30_000,
  });
}
