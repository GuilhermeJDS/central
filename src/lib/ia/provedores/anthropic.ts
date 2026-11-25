import { buscar, erroHttp, ErroProvedor, type PedidoModelo, type RespostaModelo } from "@/lib/ia/provedores/tipos";

type Resposta = {
  content?: { type: string; text?: string }[];
  stop_reason?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
};

export async function chamarAnthropic(p: PedidoModelo, maxTokens: number, timeoutMs: number): Promise<RespostaModelo> {
  const ultima = p.mensagens.length - 1;
  const messages = p.mensagens.map((m, i) => ({
    role: m.papel === "usuario" ? "user" : "assistant",
    content: [
      ...(i === ultima && m.papel === "usuario"
        ? (p.imagens ?? []).map((img) => ({
            type: "image" as const,
            source: { type: "base64" as const, media_type: img.mediaType, data: img.base64 },
          }))
        : []),
      { type: "text" as const, text: m.texto },
    ],
  }));

  const r = await buscar(
    "ANTHROPIC",
    "https://api.anthropic.com/v1/messages",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": p.chave, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: p.modelo,
        max_tokens: maxTokens,
        ...(p.pensar ? { thinking: { type: "adaptive" }, output_config: { effort: "medium" } } : {}),
        system: p.sistema,
        messages,
      }),
    },
    timeoutMs,
  );
  if (!r.ok) throw erroHttp("ANTHROPIC", r.status, await r.text(), p.chave);

  const d = (await r.json()) as Resposta;
  if (d.stop_reason === "refusal") throw new ErroProvedor("ANTHROPIC", "recusa");
  const u = d.usage ?? {};
  return {
    texto: (d.content ?? [])
      .filter((b) => b.type === "text" && b.text)
      .map((b) => b.text)
      .join("\n")
      .trim(),
    tokensEntrada: (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0),
    tokensSaida: u.output_tokens ?? 0,
    cortada: d.stop_reason === "max_tokens",
  };
}
