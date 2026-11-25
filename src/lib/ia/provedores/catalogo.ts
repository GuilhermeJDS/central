/**
 * Catálogo dos provedores de IA (módulo puro: vai para a tela também).
 * Os modelos são sugestões; o cliente pode digitar outro e o teste confere.
 */
export const PROVEDORES_IA = ["ANTHROPIC", "OPENAI", "GOOGLE", "DEEPSEEK", "XAI", "OPENROUTER"] as const;

export type ProvedorIA = (typeof PROVEDORES_IA)[number];

export type InfoProvedor = {
  nome: string;
  /** Onde o cliente cria a chave. */
  ondePegar: string;
  modeloPadrao: string;
  modelos: string[];
  /** Lê fotos (portfólio, avaliações com imagem). */
  leImagem: boolean;
};

export const CATALOGO_IA: Record<ProvedorIA, InfoProvedor> = {
  ANTHROPIC: {
    nome: "Anthropic (Claude)",
    ondePegar: "https://console.anthropic.com/settings/keys",
    modeloPadrao: "claude-sonnet-5-5",
    modelos: ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"],
    leImagem: true,
  },
  OPENAI: {
    nome: "OpenAI (ChatGPT)",
    ondePegar: "https://platform.openai.com/api-keys",
    modeloPadrao: "gpt-5-mini",
    modelos: ["gpt-5", "gpt-5-mini", "gpt-4.1"],
    leImagem: true,
  },
  GOOGLE: {
    nome: "Google (Gemini)",
    ondePegar: "https://aistudio.google.com/apikey",
    modeloPadrao: "gemini-2.5-flash",
    modelos: ["gemini-2.5-pro", "gemini-2.5-flash"],
    leImagem: true,
  },
  DEEPSEEK: {
    nome: "DeepSeek",
    ondePegar: "https://platform.deepseek.com/api_keys",
    // deepseek-chat/-reasoner foram aposentados em 24/07/2026.
    modeloPadrao: "deepseek-v4-flash",
    modelos: ["deepseek-v4-flash", "deepseek-v4-pro"],
    leImagem: false,
  },
  XAI: {
    nome: "xAI (Grok)",
    ondePegar: "https://console.x.ai",
    // grok-4 e grok-3-mini foram aposentados em 15/05/2026.
    modeloPadrao: "grok-4.3",
    modelos: ["grok-4.7", "grok-4.3"],
    leImagem: true,
  },
  OPENROUTER: {
    nome: "OpenRouter (Claude, GPT, Gemini e outros)",
    ondePegar: "https://openrouter.ai/settings/keys",
    // Ao conectar com um clique, o modelo sai da lista real (ver padraoOpenRouter).
    modeloPadrao: "anthropic/claude-sonnet-5.5",
    modelos: ["anthropic/claude-sonnet-5.5", "openai/gpt-5-mini", "google/gemini-2.5-flash"],
    leImagem: true,
  },
};

/**
 * Provedores com que a Korely já rodou os chefes de ponta a ponta.
 * Atualizar aqui quando um provedor novo passar no teste completo.
 */
export const PROVEDORES_TESTADOS: ProvedorIA[] = ["ANTHROPIC"];

export function ehProvedorIA(v: unknown): v is ProvedorIA {
  return typeof v === "string" && (PROVEDORES_IA as readonly string[]).includes(v);
}
