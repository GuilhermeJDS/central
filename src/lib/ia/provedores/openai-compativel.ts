/** OpenAI, DeepSeek, xAI e OpenRouter: todos no formato /chat/completions da OpenAI. */
import type { ProvedorIA } from "@/lib/ia/provedores/catalogo";
import { buscar, erroHttp, ErroProvedor, type PedidoModelo, type RespostaModelo } from "@/lib/ia/provedores/tipos";

const BASE: Partial<Record<ProvedorIA, string>> = {
  OPENAI: "https://api.openai.com/v1",
  DEEPSEEK: "https://api.deepseek.com/v1",
  XAI: "https://api.x.ai/v1",
  OPENROUTER: "https://openrouter.ai/api/v1",
};

/** DeepSeek não aceita mais que 8192 tokens de saída. */
const MAX_SAIDA: Partial<Record<ProvedorIA, number>> = { DEEPSEEK: 8192 };

type Resposta = {
  choices?: { message?: { content?: string | null; refusal?: string | null }; finish_reason?: string }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

export async function chamarOpenAICompativel(
  p: PedidoModelo,
  maxTokens: number,
  timeoutMs: number,
): Promise<RespostaModelo> {
  const base = BASE[p.provedor];
  if (!base) throw new ErroProvedor(p.provedor, "outro", null, "provedor sem formato OpenAI");
  if (p.imagens?.length && p.provedor === "DEEPSEEK") throw new ErroProvedor(p.provedor, "sem_imagem");

  const ultima = p.mensagens.length - 1;
  const messages = [
    { role: "system", content: p.sistema },
    ...p.mensagens.map((m, i) =>
      i === ultima && m.papel === "usuario" && p.imagens?.length
        ? {
            role: "user",
            content: [
              ...p.imagens.map((img) => ({
                type: "image_url",
                image_url: { url: `data:${img.mediaType};base64,${img.base64}` },
              })),
              { type: "text", text: m.texto },
            ],
          }
        : { role: m.papel === "usuario" ? "user" : "assistant", content: m.texto },
    ),
  ];
  const limite = Math.min(maxTokens, MAX_SAIDA[p.provedor] ?? maxTokens);

  const r = await buscar(
    p.provedor,
    `${base}/chat/completions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${p.chave}`,
        // OpenRouter: identifica a Central no painel de uso do cliente.
        ...(p.provedor === "OPENROUTER" ? { "HTTP-Referer": "https://github.com/matheusmongarde/central", "X-Title": "Central" } : {}),
      },
      body: JSON.stringify({
        model: p.modelo,
        messages,
        // OpenAI trocou max_tokens por max_completion_tokens (obrigatório nos modelos de raciocínio).
        ...(p.provedor === "OPENAI" ? { max_completion_tokens: limite } : { max_tokens: limite }),
      }),
    },
    timeoutMs,
  );
  if (!r.ok) throw erroHttp(p.provedor, r.status, await r.text(), p.chave);

  const d = (await r.json()) as Resposta;
  const escolha = d.choices?.[0];
  if (escolha?.message?.refusal) throw new ErroProvedor(p.provedor, "recusa");
  return {
    texto: (escolha?.message?.content ?? "").trim(),
    tokensEntrada: d.usage?.prompt_tokens ?? 0,
    tokensSaida: d.usage?.completion_tokens ?? 0,
    cortada: escolha?.finish_reason === "length",
  };
}
