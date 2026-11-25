import "server-only";

import { ativo } from "@/lib/config";

/**
 * Buffer (API pública em GraphQL, https://developers.buffer.com).
 * Chave pessoal em Bearer; a resposta é sempre HTTP 200: o erro vem no corpo
 * (`errors` para falha geral, `MutationError` para erro da ação).
 */
const API = "https://api.buffer.com";

export class BufferDesligado extends Error {}

export type CanalBuffer = { id: string; nome: string; servico: string; avatar: string | null; pausado: boolean };

async function chave(): Promise<{ apiKey: string; lembrete: boolean }> {
  const r = await ativo("buffer");
  const apiKey = typeof r?.valores.apiKey === "string" ? r.valores.apiKey : "";
  if (!apiKey) throw new BufferDesligado("Buffer não conectado (Conexões → Buffer).");
  return { apiKey, lembrete: r?.valores.lembrete === true };
}

async function gql<T>(apiKey: string, query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const r = await fetch(API, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(20_000),
  });
  const corpo = (await r.json().catch(() => null)) as { data?: T; errors?: Array<{ message: string; extensions?: { code?: string } }> } | null;
  if (!corpo) throw new Error(`O Buffer respondeu ${r.status} sem corpo.`);
  if (corpo.errors?.length) {
    const e = corpo.errors[0];
    if (e.extensions?.code === "UNAUTHORIZED") throw new Error("O Buffer recusou a chave. Gere outra em publish.buffer.com/settings/api.");
    if (e.extensions?.code === "RATE_LIMIT_EXCEEDED") throw new Error("Limite de pedidos do Buffer. Tento de novo daqui a pouco.");
    throw new Error(`Buffer: ${e.message}`);
  }
  return corpo.data as T;
}

/** Todos os canais (perfis) de todas as organizações da conta. */
export async function canaisBuffer(apiKeyTeste?: string): Promise<CanalBuffer[]> {
  const apiKey = apiKeyTeste ?? (await chave()).apiKey;
  const orgs = await gql<{ account: { organizations: Array<{ id: string }> } }>(apiKey, `query { account { organizations { id } } }`);
  const listas = await Promise.all(
    orgs.account.organizations.map((o) =>
      gql<{ channels: Array<{ id: string; name: string; displayName: string | null; service: string; avatar: string | null; isQueuePaused: boolean }> }>(
        apiKey,
        // Id inline (JSON.stringify escapa): a doc só mostra esse formato.
        `query { channels(input: { organizationId: ${JSON.stringify(o.id)} }) { id name displayName service avatar isQueuePaused } }`,
      ),
    ),
  );
  return listas.flatMap((l) =>
    l.channels.map((c) => ({ id: c.id, nome: c.displayName || c.name, servico: String(c.service).toLowerCase(), avatar: c.avatar, pausado: c.isQueuePaused })),
  );
}

/** Rede da Central → serviço no Buffer. */
export const SERVICO_DA_REDE: Record<string, string[]> = {
  INSTAGRAM: ["instagram"],
  TIKTOK: ["tiktok"],
  YOUTUBE: ["youtube"],
  LINKEDIN: ["linkedin"],
  X: ["twitter", "x"],
  GOOGLE_EMPRESA: ["googlebusiness", "google_business", "gbp"],
};

export type PostBuffer = {
  canalId: string;
  texto: string;
  /** URLs públicas, na ordem (carrossel = várias imagens). */
  imagens?: string[];
  video?: string | null;
  /** Quando sai; sem data = próximo horário da fila do Buffer. */
  quando?: Date | null;
};

export async function agendarNoBuffer(p: PostBuffer): Promise<{ id: string }> {
  const { apiKey, lembrete } = await chave();
  const assets = p.video ? [{ video: { url: p.video } }] : (p.imagens ?? []).map((url) => ({ image: { url } }));
  const input: Record<string, unknown> = {
    text: p.texto,
    channelId: p.canalId,
    schedulingType: lembrete ? "notification" : "automatic",
    mode: p.quando ? "customScheduled" : "addToQueue",
    ...(p.quando ? { dueAt: p.quando.toISOString() } : {}),
    ...(assets.length ? { assets } : {}),
  };
  const d = await gql<{ createPost: { post?: { id: string }; message?: string } }>(
    apiKey,
    `mutation Criar($input: CreatePostInput!) { createPost(input: $input) { ... on PostActionSuccess { post { id } } ... on MutationError { message } } }`,
    { input },
  );
  if (!d.createPost.post) throw new Error(`Buffer: ${d.createPost.message ?? "não aceitou o post"}`);
  return { id: d.createPost.post.id };
}
