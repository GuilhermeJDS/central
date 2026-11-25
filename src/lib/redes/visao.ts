import "server-only";

import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { lerRede, redesConectadas } from "@/lib/redes/contas";
import { ehRedeConectavel } from "@/lib/redes/catalogo";
import * as instagram from "@/lib/redes/instagram";
import * as linkedin from "@/lib/redes/linkedin";
import type { Metrica, Metricas } from "@/lib/redes/tipos";
import * as x from "@/lib/redes/x";
import * as youtube from "@/lib/redes/youtube";

/**
 * Uma rede inteira para a tela: perfil, números da conta e os posts.
 * Origem: a API oficial (rede conectada em Conexões) ou, sem ela, o que o
 * agente da pessoa mandou pela API da Central (tabela dados_rede).
 */
export const REDES_VISAO = ["INSTAGRAM", "TIKTOK", "YOUTUBE", "LINKEDIN", "X"] as const;
export type RedeVisao = (typeof REDES_VISAO)[number];
export const SLUG_REDE: Record<RedeVisao, string> = { INSTAGRAM: "instagram", TIKTOK: "tiktok", YOUTUBE: "youtube", LINKEDIN: "linkedin", X: "x" };
export const NOME_REDE: Record<RedeVisao, string> = { INSTAGRAM: "Instagram", TIKTOK: "TikTok", YOUTUBE: "YouTube", LINKEDIN: "LinkedIn", X: "X" };
export const redeDoSlug = (slug: string): RedeVisao | null => (Object.entries(SLUG_REDE).find(([, s]) => s === slug)?.[0] as RedeVisao) ?? null;

export type PerfilVisao = {
  nome: string;
  usuario: string | null;
  seguidores: number | null;
  seguindo: number | null;
  publicacoes: number | null;
  descricao: string | null;
  link: string | null;
  foto: string | null;
};
export type PostVisao = {
  id: string;
  texto: string;
  link: string | null;
  data: string | null;
  formato: string | null;
  imagem: string | null;
  /** YouTube: id do vídeo para o player; outras redes: URL de vídeo, quando o agente mandar. */
  video: string | null;
  duracaoSegundos: number | null;
  metricas: Metricas;
};
export type VisaoRede = {
  rede: RedeVisao;
  origem: "api" | "agente" | null;
  perfil: PerfilVisao | null;
  numerosConta: Metrica[];
  posts: PostVisao[];
  atualizadoEm: string | null;
  erro: string | null;
};

// ------------------------------------------------------------- o que o agente manda

const num = z.coerce.number().int().nonnegative().nullable().optional();
export const perfilAgenteSchema = z.object({
  nome: z.string().trim().min(1).max(160),
  usuario: z.string().trim().max(80).nullable().optional(),
  seguidores: num,
  seguindo: num,
  publicacoes: num,
  descricao: z.string().max(2200).nullable().optional(),
  link: z.string().url().max(500).nullable().optional(),
  foto: z.string().url().max(1000).nullable().optional(),
});
export const postAgenteSchema = z.object({
  id: z.string().trim().min(1).max(200),
  texto: z.string().max(5000).default(""),
  link: z.string().url().max(1000).nullable().optional(),
  data: z.string().max(40).nullable().optional(),
  formato: z.string().max(40).nullable().optional(),
  imagem: z.string().url().max(1000).nullable().optional(),
  video: z.string().max(1000).nullable().optional(),
  duracaoSegundos: num,
  metricas: z
    .object({ visualizacoes: num, curtidas: num, comentarios: num, compartilhamentos: num, salvamentos: num, alcance: num })
    .partial()
    .default({}),
});
export const envioAgenteSchema = z.object({
  rede: z.enum(REDES_VISAO),
  perfil: perfilAgenteSchema,
  posts: z.array(postAgenteSchema).max(100).default([]),
});

export async function gravarDoAgente(accountId: string, envio: z.infer<typeof envioAgenteSchema>, agente: string | null) {
  const limpo = (m: Record<string, number | null | undefined>) => Object.fromEntries(Object.entries(m).filter(([, v]) => typeof v === "number"));
  const posts = envio.posts.map((p) => ({ ...p, metricas: limpo(p.metricas) }));
  await prisma.dadoRede.upsert({
    where: { accountId_rede: { accountId, rede: envio.rede } },
    update: { perfil: envio.perfil, posts, agente },
    create: { accountId, rede: envio.rede, perfil: envio.perfil, posts, agente },
  });
  return { rede: envio.rede, posts: posts.length };
}

// ------------------------------------------------------------- leitura

function idYoutube(link: string | null, id: string): string | null {
  const m = link?.match(/(?:v=|youtu\.be\/|shorts\/)([\w-]{11})/);
  return m?.[1] ?? (/^[\w-]{11}$/.test(id) ? id : null);
}

async function daApi(accountId: string, rede: RedeVisao): Promise<Omit<VisaoRede, "rede" | "origem" | "atualizadoEm" | "erro">> {
  const r = rede as "INSTAGRAM" | "YOUTUBE" | "LINKEDIN" | "X";
  const perfilBruto =
    r === "INSTAGRAM" ? await lerRede(accountId, r, "perfil", "", (c) => instagram.perfil(c))
    : r === "YOUTUBE" ? await lerRede(accountId, r, "canal", "", (c) => youtube.canal(c))
    : r === "X" ? await lerRede(accountId, r, "perfil", "", (c) => x.perfil(c))
    : await lerRede(accountId, r, "perfil", "", (c) => linkedin.perfil(c));
  const pubs =
    r === "INSTAGRAM" ? await lerRede(accountId, r, "publicacoes", "24", (c) => instagram.publicacoes(c, 24))
    : r === "YOUTUBE" ? await lerRede(accountId, r, "videos", "20", (c) => youtube.videos(c, 20))
    : r === "X" ? await lerRede(accountId, r, "posts", "20", (c) => x.posts(c, 20))
    : (await lerRede(accountId, r, "publicacoes", "20", (c) => linkedin.publicacoes(c, 20))).publicacoes;
  const numerosConta = r === "INSTAGRAM" ? await lerRede(accountId, r, "insights", "", (c) => instagram.insightsConta(c)).catch(() => []) : [];
  return {
    perfil: {
      nome: perfilBruto.nome,
      usuario: perfilBruto.usuario,
      seguidores: perfilBruto.seguidores,
      seguindo: null,
      publicacoes: perfilBruto.publicacoes,
      descricao: perfilBruto.descricao ?? null,
      link: perfilBruto.link,
      foto: null,
    },
    numerosConta,
    posts: pubs
      .filter((p) => p.id)
      .map((p) => ({
        id: p.id,
        texto: p.texto,
        link: p.link,
        data: p.data,
        formato: p.formato,
        imagem: p.imagem ?? null,
        video: r === "YOUTUBE" ? idYoutube(p.link, p.id) : null,
        duracaoSegundos: p.duracaoSegundos ?? null,
        metricas: p.metricas,
      })),
  };
}

export async function visaoDaRede(accountId: string, rede: RedeVisao): Promise<VisaoRede> {
  const conectadas = await redesConectadas(accountId);
  if (ehRedeConectavel(rede) && conectadas.has(rede)) {
    try {
      return { rede, origem: "api", atualizadoEm: new Date().toISOString(), erro: null, ...(await daApi(accountId, rede)) };
    } catch (e) {
      const agente = await doAgente(accountId, rede);
      return agente ?? { rede, origem: "api", perfil: null, numerosConta: [], posts: [], atualizadoEm: null, erro: e instanceof Error ? e.message : "A rede não respondeu." };
    }
  }
  return (await doAgente(accountId, rede)) ?? { rede, origem: null, perfil: null, numerosConta: [], posts: [], atualizadoEm: null, erro: null };
}

async function doAgente(accountId: string, rede: RedeVisao): Promise<VisaoRede | null> {
  const l = await prisma.dadoRede.findUnique({ where: { accountId_rede: { accountId, rede } } });
  if (!l) return null;
  const perfil = perfilAgenteSchema.safeParse(l.perfil);
  const posts = z.array(postAgenteSchema).safeParse(l.posts);
  return {
    rede,
    origem: "agente",
    perfil: perfil.success
      ? { nome: perfil.data.nome, usuario: perfil.data.usuario ?? null, seguidores: perfil.data.seguidores ?? null, seguindo: perfil.data.seguindo ?? null, publicacoes: perfil.data.publicacoes ?? null, descricao: perfil.data.descricao ?? null, link: perfil.data.link ?? null, foto: perfil.data.foto ?? null }
      : null,
    numerosConta: [],
    posts: posts.success
      ? posts.data.map((p) => ({
          id: p.id,
          texto: p.texto,
          link: p.link ?? null,
          data: p.data ?? null,
          formato: p.formato ?? null,
          imagem: p.imagem ?? null,
          video: rede === "YOUTUBE" ? idYoutube(p.link ?? null, p.video ?? p.id) : (p.video ?? null),
          duracaoSegundos: p.duracaoSegundos ?? null,
          metricas: Object.fromEntries(Object.entries(p.metricas).filter(([, v]) => typeof v === "number")) as Metricas,
        }))
      : [],
    atualizadoEm: l.atualizadoEm.toISOString(),
    erro: null,
  };
}

/** Média de cada métrica nos posts (para comparar um post com a conta). */
export function mediaDasMetricas(posts: PostVisao[]): Metricas {
  const soma: Record<string, { t: number; n: number }> = {};
  for (const p of posts) for (const [k, v] of Object.entries(p.metricas)) if (typeof v === "number") (soma[k] ??= { t: 0, n: 0 }), (soma[k].t += v), soma[k].n++;
  return Object.fromEntries(Object.entries(soma).map(([k, { t, n }]) => [k, Math.round(t / n)])) as Metricas;
}

export const ROTULO_METRICA: Record<string, string> = {
  visualizacoes: "Visualizações",
  alcance: "Alcance",
  curtidas: "Curtidas",
  comentarios: "Comentários",
  compartilhamentos: "Compartilhamentos",
  salvamentos: "Salvamentos",
};
