/**
 * Dados reais das redes conectadas para a entrada das skills (em vez de o
 * dono colar texto). O motor chama `dadosParaSkill` depois que o chefe
 * escolheu a skill.
 *
 * - Cada leitura passa pelo cache de 6 h dos coletores (lib/redes/contas).
 * - Falha numa leitura vira aviso, não derruba a skill; só as skills de
 *   virais exigem ter achado alguma coisa (sem dado, não há o que analisar).
 * - Na execução fica só o resumo (redes lidas e a busca), nunca o dado bruto.
 *
 * SEGURANÇA: `accountId` sempre do servidor; os tokens nunca chegam aqui.
 */
import "server-only";

import type { FichaNegocio } from "@/generated/prisma/client";
import { lerRede } from "@/lib/redes/contas";
import { CATALOGO_REDES, type RedeConectavel } from "@/lib/redes/catalogo";
import * as instagram from "@/lib/redes/instagram";
import * as linkedin from "@/lib/redes/linkedin";
import { ErroRede, type Metrica, type Perfil, type Publicacao } from "@/lib/redes/tipos";
import * as x from "@/lib/redes/x";
import * as youtube from "@/lib/redes/youtube";

/** Skills que só fazem sentido com dados de busca da rede (virais). */
export const SKILLS_VIRAIS = new Set(["ig-viral", "yt-viral", "x-viral", "virality"]);

export const REDE_DO_REPOSITORIO: Partial<Record<string, RedeConectavel>> = {
  instagram: "INSTAGRAM",
  youtube: "YOUTUBE",
  linkedin: "LINKEDIN",
  x: "X",
};

const MAX_CARACTERES = 14_000;

export type DadosSkill = {
  /** Texto para a entrada da skill; null = nada lido. */
  bloco: string | null;
  redesLidas: RedeConectavel[];
  avisos: string[];
  busca: string | null;
  /** Alguma busca de virais (hashtag, nicho, busca recente) trouxe dados. */
  achouVirais: boolean;
};

// ---------------------------------------------------------------------------
// Formatação (curta, só o que a skill usa)
// ---------------------------------------------------------------------------

const fmt = new Intl.NumberFormat("pt-BR");

function linhaPerfil(p: Perfil): string {
  return [
    `Perfil: ${p.nome}${p.usuario ? ` (${p.usuario.startsWith("@") ? p.usuario : `@${p.usuario}`})` : ""}`,
    p.seguidores !== null ? `seguidores: ${fmt.format(p.seguidores)}` : null,
    p.publicacoes !== null ? `publicações: ${fmt.format(p.publicacoes)}` : null,
    p.link,
  ]
    .filter(Boolean)
    .join(" | ");
}

function linhaPublicacao(p: Publicacao, i: number): string {
  const m = Object.entries(p.metricas)
    .map(([k, v]) => `${k} ${fmt.format(v as number)}`)
    .join(", ");
  const quem = p.autor ? `${p.autor}${p.seguidoresAutor !== null && p.seguidoresAutor !== undefined ? ` (${fmt.format(p.seguidoresAutor)} seguidores)` : ""} | ` : "";
  const quando = p.data ? p.data.slice(0, 10) : "sem data";
  const dur = p.duracaoSegundos ? ` ${p.duracaoSegundos}s` : "";
  const texto = p.texto.replace(/\s+/g, " ").slice(0, 220);
  return `${i + 1}. ${quem}${quando} ${p.formato ?? ""}${dur} | ${m || "sem métricas"} | ${texto}${p.link ? ` | ${p.link}` : ""}`;
}

function blocoPublicacoes(titulo: string, ps: Publicacao[], max = 12): string {
  if (!ps.length) return `${titulo}: nenhuma.`;
  return [`${titulo}:`, ...ps.slice(0, max).map(linhaPublicacao)].join("\n");
}

function blocoMetricas(titulo: string, ms: Metrica[]): string | null {
  if (!ms.length) return null;
  return `${titulo}: ${ms.map((m) => `${m.nome} ${fmt.format(m.valor)}`).join(", ")}`;
}

// ---------------------------------------------------------------------------
// Leituras por rede
// ---------------------------------------------------------------------------

type Ctx = {
  accountId: string;
  busca: string;
  partes: string[];
  avisos: string[];
  lidas: Set<RedeConectavel>;
  virais: number;
};

/** Roda uma leitura; erro vira aviso. */
async function tentar<T>(ctx: Ctx, rede: RedeConectavel, fn: () => Promise<T>): Promise<T | null> {
  try {
    const v = await fn();
    ctx.lidas.add(rede);
    return v;
  } catch (e) {
    ctx.avisos.push(e instanceof ErroRede ? e.message : `${CATALOGO_REDES[rede].nome}: não deu para ler agora.`);
    return null;
  }
}

async function lerInstagram(ctx: Ctx, skill: string): Promise<void> {
  const { accountId } = ctx;
  const p = await tentar(ctx, "INSTAGRAM", () => lerRede(accountId, "INSTAGRAM", "perfil", "", instagram.perfil));
  if (p) ctx.partes.push(`[Instagram]\n${linhaPerfil(p)}`);
  if (skill === "ig-viral" || skill === "virality") {
    const h = await tentar(ctx, "INSTAGRAM", () =>
      lerRede(accountId, "INSTAGRAM", "hashtag", ctx.busca, (c) => instagram.buscaHashtag(c, ctx.busca)),
    );
    if (h?.publicacoes.length) ctx.virais++;
    if (h) ctx.partes.push(blocoPublicacoes(`Posts que mais performam em #${h.hashtag} (Instagram)`, h.publicacoes, 15));
    if (skill === "virality") return;
  }
  const pubs = await tentar(ctx, "INSTAGRAM", () =>
    lerRede(accountId, "INSTAGRAM", "publicacoes", "", (c) => instagram.publicacoes(c, 12)),
  );
  if (pubs) ctx.partes.push(blocoPublicacoes("Últimas publicações do perfil", pubs));
  if (["ig-audit", "ig-profile", "ig-plan", "ig-viral"].includes(skill)) {
    const ins = await tentar(ctx, "INSTAGRAM", () => lerRede(accountId, "INSTAGRAM", "insights", "", instagram.insightsConta));
    const b = ins ? blocoMetricas("Números da conta (28 dias)", ins) : null;
    if (b) ctx.partes.push(b);
  }
}

async function lerYoutube(ctx: Ctx, skill: string): Promise<void> {
  const { accountId } = ctx;
  const c = await tentar(ctx, "YOUTUBE", () => lerRede(accountId, "YOUTUBE", "canal", "", youtube.canal));
  if (c) ctx.partes.push(`[YouTube]\n${linhaPerfil(c)}`);
  if (skill === "yt-viral" || skill === "virality") {
    const v = await tentar(ctx, "YOUTUBE", () =>
      lerRede(accountId, "YOUTUBE", "nicho", ctx.busca, (con) => youtube.buscaNicho(con, ctx.busca)),
    );
    if (v?.length) ctx.virais++;
    if (v)
      ctx.partes.push(
        blocoPublicacoes(`Vídeos do nicho "${ctx.busca}" que mais cresceram em 30 dias (ordem: visualizações ÷ inscritos)`, v, 15),
      );
    if (skill === "virality") return;
  }
  const vids = await tentar(ctx, "YOUTUBE", () => lerRede(accountId, "YOUTUBE", "videos", "", (con) => youtube.videos(con, 15)));
  if (vids) ctx.partes.push(blocoPublicacoes("Últimos vídeos do canal", vids, 15));
  if (skill === "yt-retention" || skill === "yt-audit") {
    const r = await tentar(ctx, "YOUTUBE", () => lerRede(accountId, "YOUTUBE", "retencao", "", youtube.retencao));
    if (r?.length)
      ctx.partes.push(
        [
          "Retenção (28 dias, vídeos mais vistos):",
          ...r.map(
            (v, i) =>
              `${i + 1}. ${v.titulo ?? v.videoId} | views ${v.visualizacoes ?? "?"} | média assistida ${v.duracaoMediaSegundos ?? "?"}s | ${v.percentualMedioAssistido ?? "?"}% do vídeo`,
          ),
        ].join("\n"),
      );
  }
}

async function lerLinkedin(ctx: Ctx): Promise<void> {
  const { accountId } = ctx;
  const p = await tentar(ctx, "LINKEDIN", () => lerRede(accountId, "LINKEDIN", "perfil", "", linkedin.perfil));
  if (p) ctx.partes.push(`[LinkedIn]\n${linhaPerfil(p)}`);
  const pubs = await tentar(ctx, "LINKEDIN", () => lerRede(accountId, "LINKEDIN", "publicacoes", "", (c) => linkedin.publicacoes(c, 10)));
  if (pubs) {
    if (pubs.publicacoes.length) ctx.partes.push(blocoPublicacoes("Últimas publicações", pubs.publicacoes, 10));
    const t = blocoMetricas("Totais da página", pubs.totais);
    if (t) ctx.partes.push(t);
    if (pubs.aviso) ctx.avisos.push(`LinkedIn: ${pubs.aviso}`);
  }
}

async function lerX(ctx: Ctx, skill: string): Promise<void> {
  const { accountId } = ctx;
  const p = await tentar(ctx, "X", () => lerRede(accountId, "X", "perfil", "", x.perfil));
  if (p) ctx.partes.push(`[X]\n${linhaPerfil(p)}`);
  if (skill === "x-viral" || skill === "virality") {
    const b = await tentar(ctx, "X", () => lerRede(accountId, "X", "busca", ctx.busca, (c) => x.buscaRecente(c, ctx.busca)));
    if (b?.length) ctx.virais++;
    if (b) ctx.partes.push(blocoPublicacoes(`Posts sobre "${ctx.busca}" com mais engajamento nos últimos 7 dias (X)`, b, 15));
    if (skill === "virality") return;
  }
  const posts = await tentar(ctx, "X", () => lerRede(accountId, "X", "posts", "", (c) => x.posts(c, 20)));
  if (posts) ctx.partes.push(blocoPublicacoes("Últimos posts do perfil", posts, 15));
}

// ---------------------------------------------------------------------------
// Entrada
// ---------------------------------------------------------------------------

/** Tema de busca: o que o chefe pediu; senão, o começo do "o que vende". */
export function temaDeBusca(busca: string | null | undefined, ficha: Pick<FichaNegocio, "oQueVende">): string {
  const b = (busca ?? "").trim();
  if (b) return b.slice(0, 80);
  return ficha.oQueVende.split(/[.,;\n]/)[0].trim().split(/\s+/).slice(0, 4).join(" ").slice(0, 80);
}

export async function dadosParaSkill(
  accountId: string,
  repositorio: string,
  skill: string,
  conectadas: Set<RedeConectavel>,
  busca: string,
): Promise<DadosSkill> {
  const ctx: Ctx = { accountId, busca, partes: [], avisos: [], lidas: new Set(), virais: 0 };
  const redes: RedeConectavel[] =
    skill === "virality"
      ? (["INSTAGRAM", "YOUTUBE", "X"] as const).filter((r) => conectadas.has(r))
      : [REDE_DO_REPOSITORIO[repositorio]].filter((r): r is RedeConectavel => !!r && conectadas.has(r));

  for (const r of redes) {
    if (r === "INSTAGRAM") await lerInstagram(ctx, skill);
    else if (r === "YOUTUBE") await lerYoutube(ctx, skill);
    else if (r === "LINKEDIN") await lerLinkedin(ctx);
    else if (r === "X") await lerX(ctx, skill);
  }

  const base = { avisos: [...new Set(ctx.avisos)], busca: SKILLS_VIRAIS.has(skill) ? busca : null, achouVirais: ctx.virais > 0 };
  if (!ctx.partes.length) return { ...base, bloco: null, redesLidas: [] };
  let bloco = ctx.partes.join("\n\n");
  if (bloco.length > MAX_CARACTERES) bloco = `${bloco.slice(0, MAX_CARACTERES)}\n(…cortado)`;
  return { ...base, bloco, redesLidas: [...ctx.lidas] };
}
