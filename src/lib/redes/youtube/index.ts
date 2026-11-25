/**
 * Coletor do YouTube. Só servidor.
 *
 * - API key (Data API v3): canal, vídeos com estatísticas e busca do nicho
 *   (virais, ranqueados por visualizações ÷ inscritos do canal).
 * - Token OAuth opcional (yt-analytics.readonly): retenção pela Analytics API.
 *
 * Cota da Data API: 10.000 unidades/dia por projeto. Aqui paramos em 9.000
 * por chave (busca = 100, leituras = 1) e o cache de 6 h evita repetir.
 */
import "server-only";

import { erroGoogle, temEscopo, tokenGoogle } from "@/lib/redes/google";
import { campo, impressao, lista, pedir, texto } from "@/lib/redes/http";
import { gastarCota } from "@/lib/redes/limites";
import {
  ErroRede,
  metricas,
  numero,
  type Conexao,
  type Perfil,
  type Publicacao,
  type ResultadoTeste,
} from "@/lib/redes/tipos";

const REDE = "YOUTUBE" as const;
const API = "https://www.googleapis.com/youtube/v3";
const ANALYTICS = "https://youtubeanalytics.googleapis.com/v2/reports";
const COTA_DIA = 9000;

type Opcoes = { canal?: string | null; oauth?: string | null };

async function yt(
  chave: string,
  caminho: string,
  params: Record<string, string>,
  unidades: number,
  oauth?: string,
): Promise<unknown> {
  gastarCota(REDE, impressao(chave), unidades, COTA_DIA);
  const url = new URL(`${API}${caminho}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  // Conectado pelo "Conectar com o Google": sem API key, lê com o token da pessoa.
  const semChave = !chave.startsWith("AIza");
  if (semChave && !oauth) oauth = (await tokenGoogle(REDE, chave)).acesso;
  if (!semChave) url.searchParams.set("key", chave);
  const r = await pedir(REDE, url.toString(), oauth ? { headers: { Authorization: `Bearer ${oauth}` } } : {});
  if (r.status >= 400)
    throw erroGoogle(REDE, r, [chave, oauth], { oauth: !!oauth, api: "YouTube Data API v3", chave: impressao(chave) });
  return r.corpo;
}

/** "@loja", "youtube.com/@loja", "youtube.com/channel/UC…", "UC…" → parâmetro do channels.list. */
export function parametroCanal(bruto: string): Record<string, string> | null {
  const s = bruto.trim();
  if (!s) return null;
  const id = s.match(/(?:^|\/channel\/)(UC[\w-]{22})(?:[/?#]|$)/);
  if (id) return { id: id[1] };
  const handle = s.match(/(?:^|youtube\.com\/)(@[\w.\-]{3,100})/i);
  if (handle) return { forHandle: handle[1] };
  const legado = s.match(/youtube\.com\/(?:user|c)\/([\w.\-]{2,100})/i);
  if (legado) return { forHandle: `@${legado[1]}` };
  if (/^[\w.\-]{3,100}$/.test(s)) return { forHandle: `@${s}` };
  return null;
}

const PARTES_CANAL = "snippet,statistics,contentDetails";

export async function testar(chaveBruta: string, opcoes: Opcoes = {}): Promise<ResultadoTeste> {
  const chave = chaveBruta.trim();
  if (!/^AIza[\w-]{30,}$/.test(chave))
    return { ok: false, conta: null, motivo: "YouTube: a API key começa com AIza. Confira se colou inteira." };
  try {
    let canal: unknown;
    let expiraEm: Date | null = null;
    if (opcoes.oauth?.trim()) {
      const t = await tokenGoogle(REDE, opcoes.oauth);
      if (!temEscopo(t, "youtube.readonly", "youtube", "yt-analytics.readonly"))
        throw new ErroRede(REDE, "sem_permissao", "o token OAuth não tem os escopos do YouTube (youtube.readonly e yt-analytics.readonly).");
      expiraEm = t.expiraEm;
      canal = campo(await yt(chave, "/channels", { part: PARTES_CANAL, mine: "true" }, 1, t.acesso), "items", 0);
    } else {
      const p = parametroCanal(opcoes.canal ?? "");
      if (!p) throw new ErroRede(REDE, "entrada", "informe o @ ou o link do canal (ou cole o token OAuth).");
      canal = campo(await yt(chave, "/channels", { part: PARTES_CANAL, ...p }, 1), "items", 0);
    }
    const id = texto(campo(canal, "id"));
    if (!id) throw new ErroRede(REDE, "nao_encontrado", "canal não encontrado. Confira o @ ou o link.");
    const titulo = texto(campo(canal, "snippet", "title")) ?? id;
    const handle = texto(campo(canal, "snippet", "customUrl"));
    return { ok: true, conta: { id, nome: handle ? `${titulo} (${handle})` : titulo, expiraEm }, motivo: null };
  } catch (e) {
    if (e instanceof ErroRede) return { ok: false, conta: null, motivo: e.message };
    return { ok: false, conta: null, motivo: "YouTube: não deu para testar agora. Tente de novo." };
  }
}

/** "Conectar com o Google": só o token de renovação (1//…), sem API key. */
export async function testarOAuth(refresh: string): Promise<ResultadoTeste> {
  try {
    const canal = campo(await yt(refresh, "/channels", { part: PARTES_CANAL, mine: "true" }, 1), "items", 0);
    const id = texto(campo(canal, "id"));
    if (!id) throw new ErroRede(REDE, "nao_encontrado", "essa conta do Google não tem canal no YouTube. Entre com a conta dona do canal.");
    const titulo = texto(campo(canal, "snippet", "title")) ?? id;
    const handle = texto(campo(canal, "snippet", "customUrl"));
    return { ok: true, conta: { id, nome: handle ? `${titulo} (${handle})` : titulo, expiraEm: null }, motivo: null };
  } catch (e) {
    if (e instanceof ErroRede) return { ok: false, conta: null, motivo: e.message };
    return { ok: false, conta: null, motivo: "YouTube: não deu para testar agora. Tente de novo." };
  }
}

// ---------------------------------------------------------------------------
// Leituras
// ---------------------------------------------------------------------------

export async function canal(con: Conexao): Promise<Perfil> {
  const c = campo(await yt(con.token, "/channels", { part: PARTES_CANAL, id: con.contaExternaId }, 1), "items", 0);
  if (!c) throw new ErroRede(REDE, "nao_encontrado", "o canal conectado não foi encontrado.");
  const handle = texto(campo(c, "snippet", "customUrl"));
  return {
    id: con.contaExternaId,
    nome: texto(campo(c, "snippet", "title")) ?? con.contaExternaId,
    usuario: handle,
    seguidores: numero(campo(c, "statistics", "subscriberCount")),
    publicacoes: numero(campo(c, "statistics", "videoCount")),
    link: handle ? `https://www.youtube.com/${handle}` : `https://www.youtube.com/channel/${con.contaExternaId}`,
    descricao: (texto(campo(c, "snippet", "description")) ?? "").slice(0, 500) || null,
  };
}

/** PT1M5S → 65. */
export function segundosDe(iso: string | null): number | null {
  if (!iso) return null;
  const m = iso.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return null;
  const [, d, h, mi, s] = m.map((x) => Number(x ?? 0));
  return d * 86_400 + h * 3600 + mi * 60 + s;
}

function videoDe(v: unknown, seguidoresAutor?: number | null): Publicacao {
  const id = String(campo(v, "id") ?? "");
  const dur = segundosDe(texto(campo(v, "contentDetails", "duration")));
  return {
    id,
    texto: [texto(campo(v, "snippet", "title")), (texto(campo(v, "snippet", "description")) ?? "").slice(0, 300)]
      .filter(Boolean)
      .join("\n"),
    link: id ? `https://www.youtube.com/watch?v=${id}` : null,
    data: texto(campo(v, "snippet", "publishedAt")),
    formato: dur !== null && dur <= 180 ? "short" : "video",
    duracaoSegundos: dur,
    imagem: id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : null,
    autor: texto(campo(v, "snippet", "channelTitle")),
    seguidoresAutor: seguidoresAutor ?? null,
    metricas: metricas({
      visualizacoes: campo(v, "statistics", "viewCount"),
      curtidas: campo(v, "statistics", "likeCount"),
      comentarios: campo(v, "statistics", "commentCount"),
    }),
  };
}

async function videosPorId(chave: string, ids: string[]): Promise<unknown[]> {
  if (!ids.length) return [];
  const d = await yt(chave, "/videos", { part: "snippet,statistics,contentDetails", id: ids.slice(0, 50).join(",") }, 1);
  return lista(campo(d, "items"));
}

/** Últimos vídeos do canal com visualizações, curtidas e comentários. */
export async function videos(con: Conexao, limite = 15): Promise<Publicacao[]> {
  const c = await yt(con.token, "/channels", { part: "contentDetails", id: con.contaExternaId }, 1);
  const uploads = texto(campo(c, "items", 0, "contentDetails", "relatedPlaylists", "uploads"));
  if (!uploads) return [];
  const pl = await yt(
    con.token,
    "/playlistItems",
    { part: "contentDetails", playlistId: uploads, maxResults: String(Math.min(limite, 50)) },
    1,
  );
  const ids = lista(campo(pl, "items"))
    .map((i) => texto(campo(i, "contentDetails", "videoId")))
    .filter((x): x is string => !!x);
  return (await videosPorId(con.token, ids)).map((v) => videoDe(v));
}

/** Vídeos do nicho que mais cresceram nos últimos 30 dias (custa 100 da cota). */
export async function buscaNicho(con: Conexao, termo: string): Promise<Publicacao[]> {
  const q = termo.trim().slice(0, 100);
  if (!q) throw new ErroRede(REDE, "entrada", "diga o tema do nicho para buscar.");
  const desde = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const s = await yt(
    con.token,
    "/search",
    {
      part: "snippet",
      type: "video",
      q,
      order: "viewCount",
      publishedAfter: desde,
      regionCode: "BR",
      relevanceLanguage: "pt",
      maxResults: "20",
    },
    100,
  );
  const ids = lista(campo(s, "items"))
    .map((i) => texto(campo(i, "id", "videoId")))
    .filter((x): x is string => !!x);
  const vids = await videosPorId(con.token, ids);
  const canais = [...new Set(vids.map((v) => texto(campo(v, "snippet", "channelId"))).filter((x): x is string => !!x))];
  const inscritos = new Map<string, number | null>();
  if (canais.length) {
    const cs = await yt(con.token, "/channels", { part: "statistics", id: canais.slice(0, 50).join(",") }, 1);
    for (const c of lista(campo(cs, "items")))
      inscritos.set(String(campo(c, "id")), numero(campo(c, "statistics", "subscriberCount")));
  }
  const multiplo = (p: Publicacao) => (p.metricas.visualizacoes ?? 0) / Math.max(1000, p.seguidoresAutor ?? 0);
  return vids
    .map((v) => videoDe(v, inscritos.get(String(campo(v, "snippet", "channelId"))) ?? null))
    .sort((a, b) => multiplo(b) - multiplo(a));
}

export type RetencaoVideo = {
  videoId: string;
  titulo: string | null;
  visualizacoes: number | null;
  duracaoMediaSegundos: number | null;
  percentualMedioAssistido: number | null;
};

/** Retenção dos vídeos mais vistos nos últimos 28 dias. Exige o token OAuth. */
export async function retencao(con: Conexao): Promise<RetencaoVideo[]> {
  if (!con.refresh)
    throw new ErroRede(REDE, "sem_permissao", "a retenção precisa do token OAuth (yt-analytics.readonly). Cole em Conexões → YouTube.");
  const t = await tokenGoogle(REDE, con.refresh);
  const hoje = new Date();
  const dia = (d: Date) => d.toISOString().slice(0, 10);
  const url = new URL(ANALYTICS);
  url.searchParams.set("ids", "channel==MINE");
  url.searchParams.set("startDate", dia(new Date(hoje.getTime() - 28 * 86_400_000)));
  url.searchParams.set("endDate", dia(hoje));
  url.searchParams.set("metrics", "views,averageViewDuration,averageViewPercentage");
  url.searchParams.set("dimensions", "video");
  url.searchParams.set("sort", "-views");
  url.searchParams.set("maxResults", "10");
  const r = await pedir(REDE, url.toString(), { headers: { Authorization: `Bearer ${t.acesso}` } });
  if (r.status >= 400)
    throw erroGoogle(REDE, r, [con.token, con.refresh, t.acesso], {
      oauth: true,
      api: "YouTube Analytics API",
      chave: impressao(con.token),
    });
  const linhas = lista(campo(r.corpo, "rows")).filter(Array.isArray) as unknown[][];
  const titulos = new Map<string, string | null>();
  const ids = linhas.map((l) => String(l[0]));
  for (const v of await videosPorId(con.token, ids))
    titulos.set(String(campo(v, "id")), texto(campo(v, "snippet", "title")));
  return linhas.map((l) => ({
    videoId: String(l[0]),
    titulo: titulos.get(String(l[0])) ?? null,
    visualizacoes: numero(l[1]),
    duracaoMediaSegundos: numero(l[2]),
    percentualMedioAssistido: numero(l[3]),
  }));
}
