/**
 * Tipos e erro comum dos provedores de IA.
 *
 * A chave do cliente nunca entra em mensagem de erro: o texto devolvido pelo
 * provedor passa por `mascarar` antes de aparecer em qualquer lugar.
 */
import { CATALOGO_IA, type ProvedorIA } from "@/lib/ia/provedores/catalogo";

export type ImagemModelo = { base64: string; mediaType: string };

export type MensagemModelo = { papel: "usuario" | "assistente"; texto: string };

export type PedidoModelo = {
  provedor: ProvedorIA;
  chave: string;
  modelo: string;
  sistema: string;
  mensagens: MensagemModelo[];
  /** Vão junto da última mensagem do usuário. */
  imagens?: ImagemModelo[];
  maxTokens?: number;
  timeoutMs?: number;
  /** Anthropic: liga o raciocínio adaptativo (só modelos que aceitam). */
  pensar?: boolean;
};

export type RespostaModelo = {
  texto: string;
  tokensEntrada: number;
  tokensSaida: number;
  /** Parou no limite de tokens. */
  cortada: boolean;
};

export type TipoErroProvedor =
  | "chave_invalida"
  | "sem_credito"
  | "modelo_inexistente"
  | "limite"
  | "timeout"
  | "indisponivel"
  | "recusa"
  | "sem_imagem"
  | "outro";

const TEXTO_ERRO: Record<TipoErroProvedor, string> = {
  chave_invalida: "a chave não foi aceita. Confira se copiou a chave inteira e se ela está ativa.",
  sem_credito: "a conta está sem crédito. Adicione saldo no site do provedor.",
  modelo_inexistente: "esse modelo não existe ou a sua conta não tem acesso a ele.",
  limite: "limite de uso atingido agora. Espere um pouco e tente de novo.",
  timeout: "o provedor demorou demais para responder.",
  indisponivel: "o provedor está fora do ar agora. Tente de novo daqui a pouco.",
  recusa: "o modelo se recusou a responder esse pedido.",
  sem_imagem: "esse modelo não lê fotos. Escolha outro provedor para esta função.",
  outro: "o provedor devolveu um erro.",
};

export class ErroProvedor extends Error {
  readonly tipo: TipoErroProvedor;
  readonly provedor: ProvedorIA;
  readonly status: number | null;

  constructor(provedor: ProvedorIA, tipo: TipoErroProvedor, status: number | null = null, detalhe?: string) {
    const base = `${CATALOGO_IA[provedor].nome}: ${TEXTO_ERRO[tipo]}`;
    super(detalhe ? `${base} (${detalhe})` : base);
    this.name = "ErroProvedor";
    this.tipo = tipo;
    this.provedor = provedor;
    this.status = status;
  }
}

const PADRAO_CHAVE = /(sk-ant-[\w-]+|sk-[\w-]{4,}|xai-[\w-]{4,}|AIza[\w-]{10,}|Bearer\s+\S+)/g;

/** Tira a chave (e qualquer coisa com cara de chave) de um texto. */
export function mascarar(texto: string, chave: string): string {
  let t = texto;
  if (chave) t = t.split(chave).join("[chave]");
  return t.replace(PADRAO_CHAVE, "[chave]");
}

/** Classifica a resposta de erro HTTP pelo status e pelo texto devolvido. */
export function erroHttp(provedor: ProvedorIA, status: number, corpo: string, chave: string): ErroProvedor {
  const c = corpo.toLowerCase();
  if (
    status === 402 ||
    /credit balance|insufficient_quota|insufficient balance|exceeded your current quota|billing|no credits|doesn't have any credits|purchase credits/.test(
      c,
    )
  )
    return new ErroProvedor(provedor, "sem_credito", status);
  if (
    status === 401 ||
    /api key not valid|api_key_invalid|invalid api key|incorrect api key|invalid x-api-key|invalid_api_key|authentication_error|unauthorized/.test(
      c,
    )
  )
    return new ErroProvedor(provedor, "chave_invalida", status);
  if (
    status === 404 ||
    /model_not_found|not_found_error|model not exist|model .*(not found|does not exist)|invalid model|unknown model|no such model/.test(
      c,
    )
  )
    return new ErroProvedor(provedor, "modelo_inexistente", status);
  if (status === 403) return new ErroProvedor(provedor, "chave_invalida", status);
  if (status === 429) return new ErroProvedor(provedor, "limite", status);
  if (status >= 500) return new ErroProvedor(provedor, "indisponivel", status);
  return new ErroProvedor(provedor, "outro", status, `${status}: ${mascarar(corpo, chave).slice(0, 300)}`);
}

/** fetch com timeout, convertendo falha de rede/timeout em ErroProvedor. */
export async function buscar(
  provedor: ProvedorIA,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (e) {
    const nome = e instanceof Error ? e.name : "";
    if (nome === "TimeoutError" || nome === "AbortError") throw new ErroProvedor(provedor, "timeout");
    throw new ErroProvedor(provedor, "indisponivel");
  }
}
