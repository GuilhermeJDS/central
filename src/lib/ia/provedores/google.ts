/** Google Gemini: formato generateContent. */
import { buscar, erroHttp, ErroProvedor, type PedidoModelo, type RespostaModelo } from "@/lib/ia/provedores/tipos";

type Resposta = {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
};

export async function chamarGoogle(p: PedidoModelo, maxTokens: number, timeoutMs: number): Promise<RespostaModelo> {
  const ultima = p.mensagens.length - 1;
  const contents = p.mensagens.map((m, i) => ({
    role: m.papel === "usuario" ? "user" : "model",
    parts: [
      ...(i === ultima && m.papel === "usuario"
        ? (p.imagens ?? []).map((img) => ({ inline_data: { mime_type: img.mediaType, data: img.base64 } }))
        : []),
      { text: m.texto },
    ],
  }));

  const r = await buscar(
    "GOOGLE",
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(p.modelo)}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": p.chave },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: p.sistema }] },
        contents,
        generationConfig: { maxOutputTokens: maxTokens },
      }),
    },
    timeoutMs,
  );
  if (!r.ok) throw erroHttp("GOOGLE", r.status, await r.text(), p.chave);

  const d = (await r.json()) as Resposta;
  if (d.promptFeedback?.blockReason) throw new ErroProvedor("GOOGLE", "recusa");
  const c = d.candidates?.[0];
  if (c?.finishReason === "SAFETY" || c?.finishReason === "PROHIBITED_CONTENT") throw new ErroProvedor("GOOGLE", "recusa");
  const u = d.usageMetadata ?? {};
  return {
    texto: (c?.content?.parts ?? [])
      .filter((parte) => !parte.thought && parte.text)
      .map((parte) => parte.text)
      .join("")
      .trim(),
    tokensEntrada: u.promptTokenCount ?? 0,
    tokensSaida: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0),
    cortada: c?.finishReason === "MAX_TOKENS",
  };
}
