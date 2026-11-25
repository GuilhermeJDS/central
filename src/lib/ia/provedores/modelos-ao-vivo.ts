/**
 * Lista real de modelos de cada provedor, pela API dele, com a chave do
 * cliente. Só servidor. A chave nunca entra no erro (ErroProvedor mascara).
 *
 *   Anthropic  GET https://api.anthropic.com/v1/models
 *   OpenAI     GET https://api.openai.com/v1/models
 *   Gemini     GET https://generativelanguage.googleapis.com/v1beta/models (models.list)
 *   DeepSeek   GET https://api.deepseek.com/models
 *   xAI        GET https://api.x.ai/v1/models
 *   OpenRouter GET https://openrouter.ai/api/v1/models
 */
import { type ProvedorIA } from "@/lib/ia/provedores/catalogo";
import { buscar, erroHttp } from "@/lib/ia/provedores/tipos";
import type { ModeloAoVivo, TipoModelo } from "@/lib/ia/provedores/modelos-tipos";

export type { ModeloAoVivo, TipoModelo } from "@/lib/ia/provedores/modelos-tipos";

if (typeof window !== "undefined") {
  throw new Error("Lista de modelos só roda no servidor");
}

const TIMEOUT_MS = 15_000;

/** Classifica pelo nome: o que gera imagem, o que gera texto, o resto. */
export function tipoDoModelo(provedor: ProvedorIA, id: string, metodos?: string[]): TipoModelo {
  const m = id.toLowerCase();
  if (/(dall-e|gpt-image|imagen|image-generation|-image\b|-image-|imagine|flash-image|nano-banana)/.test(m))
    return "imagem";
  if (/(embed|embedding|whisper|tts|transcribe|audio|realtime|moderation|speech|search-preview|aqa|veo|lyria|-live)/.test(m))
    return "outro";
  if (provedor === "GOOGLE" && metodos && !metodos.includes("generateContent")) return "outro";
  if (provedor === "OPENAI" && /^(babbage|davinci|text-|code-|ada)/.test(m)) return "outro";
  return "texto";
}

type ItemOpenAI = { id: string; created?: number };
type ItemAnthropic = { id: string; display_name?: string; created_at?: string };
type ItemOpenRouter = { id: string; name?: string; architecture?: { output_modalities?: string[] } };
type ItemGoogle = { name: string; displayName?: string; supportedGenerationMethods?: string[] };

async function getJson<T>(provedor: ProvedorIA, url: string, headers: Record<string, string>, chave: string): Promise<T> {
  const r = await buscar(provedor, url, { method: "GET", headers, cache: "no-store" }, TIMEOUT_MS);
  if (!r.ok) throw erroHttp(provedor, r.status, await r.text().catch(() => ""), chave);
  return (await r.json()) as T;
}

async function brutos(provedor: ProvedorIA, chave: string): Promise<ModeloAoVivo[]> {
  switch (provedor) {
    case "ANTHROPIC": {
      const j = await getJson<{ data?: ItemAnthropic[] }>(
        provedor,
        "https://api.anthropic.com/v1/models?limit=1000",
        { "x-api-key": chave, "anthropic-version": "2023-06-01" },
        chave,
      );
      return (j.data ?? []).map((d) => ({ id: d.id, nome: d.display_name ?? d.id, tipo: tipoDoModelo(provedor, d.id) }));
    }
    case "GOOGLE": {
      const lista: ItemGoogle[] = [];
      let token = "";
      for (let pagina = 0; pagina < 5; pagina++) {
        const url = new URL("https://generativelanguage.googleapis.com/v1beta/models");
        url.searchParams.set("pageSize", "1000");
        if (token) url.searchParams.set("pageToken", token);
        const j = await getJson<{ models?: ItemGoogle[]; nextPageToken?: string }>(
          provedor,
          url.toString(),
          { "x-goog-api-key": chave },
          chave,
        );
        lista.push(...(j.models ?? []));
        token = j.nextPageToken ?? "";
        if (!token) break;
      }
      return lista.map((d) => {
        const id = d.name.replace(/^models\//, "");
        return { id, nome: d.displayName ?? id, tipo: tipoDoModelo(provedor, id, d.supportedGenerationMethods) };
      });
    }
    case "OPENROUTER": {
      const j = await getJson<{ data?: ItemOpenRouter[] }>(provedor, "https://openrouter.ai/api/v1/models", { Authorization: `Bearer ${chave}` }, chave);
      return (j.data ?? []).map((d) => {
        const saidas = d.architecture?.output_modalities ?? [];
        const tipo: TipoModelo = saidas.includes("image") && !saidas.includes("text") ? "imagem" : saidas.length && !saidas.includes("text") ? "outro" : tipoDoModelo(provedor, d.id);
        return { id: d.id, nome: d.name ?? d.id, tipo };
      });
    }
    case "OPENAI":
    case "DEEPSEEK":
    case "XAI": {
      const base = {
        OPENAI: "https://api.openai.com/v1/models",
        DEEPSEEK: "https://api.deepseek.com/models",
        XAI: "https://api.x.ai/v1/models",
      }[provedor];
      const j = await getJson<{ data?: ItemOpenAI[] }>(provedor, base, { Authorization: `Bearer ${chave}` }, chave);
      return (j.data ?? []).map((d) => ({ id: d.id, nome: d.id, tipo: tipoDoModelo(provedor, d.id) }));
    }
  }
}

const cache = new Map<string, { em: number; modelos: ModeloAoVivo[] }>();
const VALIDADE_MS = 10 * 60_000;

/**
 * Todos os modelos que a chave enxerga, em ordem (texto, imagem, outros;
 * dentro de cada grupo, os mais novos primeiro). Cache de 10 min por chave (em memória,
 * indexado pelo fim da chave + provedor, nunca pela chave inteira).
 */
export async function listarModelosAoVivo(provedor: ProvedorIA, chave: string, cacheChave?: string) {
  const k = cacheChave ? `${provedor}:${cacheChave}` : null;
  const guardado = k ? cache.get(k) : undefined;
  if (guardado && Date.now() - guardado.em < VALIDADE_MS) return guardado.modelos;
  const ordem: Record<TipoModelo, number> = { texto: 0, imagem: 1, outro: 2 };
  const vistos = new Set<string>();
  const modelos = (await brutos(provedor, chave))
    .filter((m) => m.id && !vistos.has(m.id) && vistos.add(m.id))
    .sort((a, b) => ordem[a.tipo] - ordem[b.tipo] || b.id.localeCompare(a.id, undefined, { numeric: true }));
  if (k) cache.set(k, { em: Date.now(), modelos });
  return modelos;
}
