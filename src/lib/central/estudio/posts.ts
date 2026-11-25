/**
 * Posts reais da conta conectada (Conexões) para vincular às peças do
 * estúdio, e os números do post vinculado comparados com a média da conta.
 * Lê com o cache de 6 h de lib/redes/contas (a API da rede não é chamada a
 * cada clique). accountId sempre da sessão.
 */
import "server-only";

import { lerRede } from "@/lib/redes/contas";
import { ehRedeConectavel, type RedeConectavel } from "@/lib/redes/catalogo";
import * as instagram from "@/lib/redes/instagram";
import * as linkedin from "@/lib/redes/linkedin";
import { ErroRede, type Metricas, type Publicacao } from "@/lib/redes/tipos";
import * as x from "@/lib/redes/x";
import * as youtube from "@/lib/redes/youtube";

export type PostConta = {
  id: string;
  texto: string;
  link: string | null;
  data: string | null;
  formato: string | null;
  imagem: string | null;
  metricas: Metricas;
};

export type ResultadoPosts =
  | { ok: true; posts: PostConta[] }
  | { ok: false; motivo: "sem_rede" | "nao_conectada" | "erro"; mensagem: string };

const NOME: Record<string, string> = { INSTAGRAM: "Instagram", YOUTUBE: "YouTube", X: "X", LINKEDIN: "LinkedIn", TIKTOK: "TikTok" };

async function buscar(accountId: string, rede: RedeConectavel): Promise<Publicacao[]> {
  switch (rede) {
    case "INSTAGRAM":
      return lerRede(accountId, rede, "publicacoes", "24", (c) => instagram.publicacoes(c, 24));
    case "YOUTUBE":
      return lerRede(accountId, rede, "videos", "20", (c) => youtube.videos(c, 20));
    case "X":
      return lerRede(accountId, rede, "posts", "20", (c) => x.posts(c, 20));
    case "LINKEDIN":
      return (await lerRede(accountId, rede, "publicacoes", "20", (c) => linkedin.publicacoes(c, 20))).publicacoes;
    default:
      return [];
  }
}

/**
 * SÓ NO DESENVOLVIMENTO LOCAL (NODE_ENV=development e ESTUDIO_POSTS_EXEMPLO=1):
 * posts inventados de estética quando a rede não está conectada, para
 * conferir a tela do vínculo sem token real. Em produção nunca roda.
 */
function postsExemplo(rede: string): PostConta[] | null {
  if (process.env.NODE_ENV !== "development" || process.env.ESTUDIO_POSTS_EXEMPLO !== "1") return null;
  const textos = [
    "5 sinais de que a pele pede limpeza 👀 Reconhece algum?",
    "Horários livres desta semana: quarta 14h e 16h, quinta 10h.",
    "Drenagem linfática: o que esperar da primeira sessão.",
    "Antes e depois da hidratação facial (com autorização da cliente).",
    "Bastidores da cabine: o vapor que abre os poros.",
    "Design de sobrancelha ou micropigmentação?",
    "Protetor solar em dia nublado? Sim!",
    "Cliente do mês: a Joana voltou pela 10ª vez 💗",
  ];
  const dia = 86_400_000;
  return textos.map((texto, i) => {
    const alcance = [2840, 1210, 1630, 980, 1420, 1105, 870, 1340][i];
    return {
      id: `exemplo-${rede.toLowerCase()}-${i + 1}`,
      texto,
      link: null,
      data: new Date(Date.now() - (5 + i * 3) * dia).toISOString(),
      formato: i % 3 === 0 ? "CAROUSEL_ALBUM" : "FEED",
      imagem: i === 0 ? "/uploads/carrossel/seed-aurora-hero-2.webp" : null,
      metricas: {
        alcance,
        visualizacoes: Math.round(alcance * 1.6),
        curtidas: Math.round(alcance * 0.071),
        comentarios: Math.round(alcance * 0.009),
        salvamentos: Math.round(alcance * (i === 0 ? 0.052 : 0.018)),
        compartilhamentos: Math.round(alcance * (i === 0 ? 0.021 : 0.006)),
      },
    };
  });
}

export async function postsDaConta(accountId: string, rede: string | null): Promise<ResultadoPosts> {
  if (!rede) return { ok: false, motivo: "sem_rede", mensagem: "Escolha a rede da peça antes de vincular." };
  if (!ehRedeConectavel(rede) || rede === "GOOGLE_EMPRESA")
    return {
      ok: false,
      motivo: "sem_rede",
      mensagem: `O ${NOME[rede] ?? rede} ainda não conecta na Korely. Dá para marcar a peça como publicada.`,
    };
  try {
    const lista = await buscar(accountId, rede);
    return {
      ok: true,
      posts: lista
        .filter((p) => p.id)
        .map((p) => ({
          id: p.id,
          texto: p.texto,
          link: p.link,
          data: p.data,
          formato: p.formato,
          imagem: p.imagem ?? null,
          metricas: p.metricas,
        })),
    };
  } catch (e) {
    const exemplo = postsExemplo(rede);
    if (exemplo) return { ok: true, posts: exemplo };
    if (e instanceof ErroRede && e.motivo === "entrada")
      return { ok: false, motivo: "nao_conectada", mensagem: `Conecte o ${NOME[rede]} em Conexões para vincular o post.` };
    return {
      ok: false,
      motivo: "erro",
      mensagem: e instanceof ErroRede ? e.message : `Não deu para ler o ${NOME[rede]} agora.`,
    };
  }
}

// ---------------------------------------------------------------------------
// Números do post vinculado
// ---------------------------------------------------------------------------

export type ChaveMetrica = "alcance" | "visualizacoes" | "curtidas" | "comentarios" | "salvamentos" | "compartilhamentos";
export const METRICAS: ChaveMetrica[] = ["alcance", "visualizacoes", "curtidas", "comentarios", "salvamentos", "compartilhamentos"];

export type NumerosPost = {
  post: PostConta;
  /** Média de cada métrica nos outros posts da conta (só as que a rede mandou). */
  media: Partial<Record<ChaveMetrica, number>>;
  /** Engajamento: (curtidas + comentários + salvos + compartilhamentos) / alcance (ou visualizações). */
  engajamento: number | null;
  engajamentoMedio: number | null;
  /** Mini-gráfico: alcance (ou visualizações) dos últimos posts, do mais antigo ao mais novo. */
  serie: Array<{ id: string; valor: number; data: string | null; este: boolean }>;
  /** Qual métrica a série usa. */
  serieMetrica: ChaveMetrica;
  /** Quantos posts entraram na média. */
  base: number;
};

function engajamentoDe(m: Metricas): number | null {
  const base = m.alcance ?? m.visualizacoes;
  if (!base) return null;
  const soma = (m.curtidas ?? 0) + (m.comentarios ?? 0) + (m.salvamentos ?? 0) + (m.compartilhamentos ?? 0);
  return soma / base;
}

function mediaDe(nums: number[]): number | null {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
}

export async function numerosDoPost(
  accountId: string,
  rede: string,
  postId: string,
): Promise<{ ok: true; numeros: NumerosPost } | { ok: false; mensagem: string }> {
  const r = await postsDaConta(accountId, rede);
  if (!r.ok) return { ok: false, mensagem: r.mensagem };
  const post = r.posts.find((p) => p.id === postId);
  if (!post) return { ok: false, mensagem: "O post não aparece mais entre os últimos da conta. Troque o vínculo." };
  const outros = r.posts.filter((p) => p.id !== postId);
  const media: NumerosPost["media"] = {};
  for (const k of METRICAS) {
    const m = mediaDe(outros.map((p) => p.metricas[k]).filter((v): v is number => typeof v === "number"));
    if (m !== null) media[k] = m;
  }
  const serieMetrica: ChaveMetrica = r.posts.some((p) => typeof p.metricas.alcance === "number") ? "alcance" : "visualizacoes";
  const serie = r.posts
    .filter((p) => typeof p.metricas[serieMetrica] === "number")
    .slice(0, 12)
    .reverse()
    .map((p) => ({ id: p.id, valor: p.metricas[serieMetrica] ?? 0, data: p.data, este: p.id === postId }));
  return {
    ok: true,
    numeros: {
      post,
      media,
      engajamento: engajamentoDe(post.metricas),
      engajamentoMedio: mediaDe(outros.map((p) => engajamentoDe(p.metricas)).filter((v): v is number => v !== null)),
      serie,
      serieMetrica,
      base: outros.length,
    },
  };
}
