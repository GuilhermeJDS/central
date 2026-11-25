/**
 * Busca do Rastro: acha o negócio no Google Maps e os vizinhos do mesmo tipo.
 *
 * Dois motores:
 * - "reach" (principal): serviço próprio em RASTRO_URL (/buscar e
 *   /vizinhos), autenticado pelo header x-rastro-token = RASTRO_TOKEN.
 *   Responde sempre `{ lugares: [...] }`.
 * - "google" (reserva): Places API (New), Text Search, chave em
 *   GOOGLE_PLACES_API_KEY, pedindo só os campos que usamos (FieldMask).
 *
 * O reach é tentado primeiro. Se responder 503/504/429, der erro de rede
 * (inclui timeout) ou faltar variável, cai no google. Qualquer outra resposta
 * do reach é erro dele (não mascara bug com a reserva). Se os dois falharem,
 * lança erro dizendo o motivo de cada um.
 */
import "server-only";

import { z } from "zod";

export type FonteRastro = "reach" | "google";

export type Lugar = {
  placeId: string;
  nome: string;
  endereco: string | null;
  nota: number | null;
  totalAvaliacoes: number | null;
  site: string | null;
  telefone: string | null;
  linkMaps: string | null;
  /** Categoria do Maps (ex.: "Barbearia"), quando vier. */
  categoria: string | null;
  fonte: FonteRastro;
};

export type ResultadoBuscaNegocio = { fonte: FonteRastro; lugar: Lugar | null };
export type ResultadoBuscaVizinhos = { fonte: FonteRastro; lugares: Lugar[] };

const TIMEOUT_REACH_MS = 100 * 1000;
const TIMEOUT_GOOGLE_MS = 20 * 1000;
const URL_GOOGLE = "https://places.googleapis.com/v1/places:searchText";
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.rating",
  "places.userRatingCount",
  "places.websiteUri",
  "places.nationalPhoneNumber",
  "places.googleMapsUri",
  "places.primaryTypeDisplayName",
].join(",");

/** Erro que autoriza cair no motor reserva. */
class ReachIndisponivel extends Error {}

// ---------------------------------------------------------------------------
// Motor 1: reach
// ---------------------------------------------------------------------------

const textoOuNull = z
  .string()
  .nullish()
  .transform((v) => (v && v.trim() ? v.trim() : null));
const numeroOuNull = z.number().nullish().transform((v) => (typeof v === "number" && Number.isFinite(v) ? v : null));

const lugarReachSchema = z.object({
  placeId: z.string().trim().min(1),
  nome: z.string().trim().min(1),
  endereco: textoOuNull,
  nota: numeroOuNull,
  totalAvaliacoes: numeroOuNull,
  site: textoOuNull,
  telefone: textoOuNull,
  linkMaps: textoOuNull,
  categoria: textoOuNull,
});

const respostaReachSchema = z.object({ lugares: z.array(z.unknown()) });

/** Só aceita `{ lugares: [...] }`. */
function lugaresDoReach(corpo: unknown): Lugar[] {
  const resposta = respostaReachSchema.safeParse(corpo);
  if (!resposta.success) throw new Error("Reach respondeu fora do formato { lugares: [...] }");

  return resposta.data.lugares.map((item) => {
    const parsed = lugarReachSchema.safeParse(item);
    if (!parsed.success) throw new Error(`Lugar do reach fora do formato: ${parsed.error.message}`);
    return { ...parsed.data, fonte: "reach" as const };
  });
}

async function chamarReach(caminho: "/buscar" | "/vizinhos", corpo: Record<string, unknown>): Promise<Lugar[]> {
  const base = process.env.RASTRO_URL?.trim();
  const token = process.env.RASTRO_TOKEN?.trim();
  if (!base) throw new ReachIndisponivel("RASTRO_URL não configurada");
  if (!token) throw new ReachIndisponivel("RASTRO_TOKEN não configurado");

  let resposta: Response;
  try {
    resposta = await fetch(`${base.replace(/\/+$/, "")}${caminho}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-rastro-token": token },
      body: JSON.stringify(corpo),
      signal: AbortSignal.timeout(TIMEOUT_REACH_MS),
      cache: "no-store",
    });
  } catch (e) {
    // fetch só lança em erro de rede/DNS/timeout.
    throw new ReachIndisponivel(`erro de rede: ${e instanceof Error ? e.message : String(e)}`);
  }

  if ([429, 503, 504].includes(resposta.status)) {
    throw new ReachIndisponivel(`reach respondeu ${resposta.status}`);
  }
  if (!resposta.ok) {
    const texto = await resposta.text().catch(() => "");
    throw new Error(`Reach respondeu ${resposta.status}: ${texto.slice(0, 300)}`);
  }
  return lugaresDoReach(await resposta.json());
}

// ---------------------------------------------------------------------------
// Motor 2: google (Places API New, Text Search)
// ---------------------------------------------------------------------------

type PlaceGoogle = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  rating?: number;
  userRatingCount?: number;
  websiteUri?: string;
  nationalPhoneNumber?: string;
  googleMapsUri?: string;
  primaryTypeDisplayName?: { text?: string };
};

function lugarDoGoogle(p: PlaceGoogle): Lugar | null {
  const nome = p.displayName?.text?.trim();
  if (!p.id || !nome) return null;
  return {
    placeId: p.id,
    nome,
    endereco: p.formattedAddress?.trim() || null,
    nota: typeof p.rating === "number" ? p.rating : null,
    totalAvaliacoes: typeof p.userRatingCount === "number" ? p.userRatingCount : null,
    site: p.websiteUri?.trim() || null,
    telefone: p.nationalPhoneNumber?.trim() || null,
    linkMaps: p.googleMapsUri?.trim() || null,
    categoria: p.primaryTypeDisplayName?.text?.trim() || null,
    fonte: "google",
  };
}

async function chamarGoogle(textQuery: string, pageSize: number): Promise<Lugar[]> {
  const chave = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!chave) throw new Error("GOOGLE_PLACES_API_KEY não configurada");

  const resposta = await fetch(URL_GOOGLE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": chave,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify({ textQuery, pageSize, languageCode: "pt-BR", regionCode: "BR" }),
    signal: AbortSignal.timeout(TIMEOUT_GOOGLE_MS),
    cache: "no-store",
  });
  if (!resposta.ok) {
    const texto = await resposta.text().catch(() => "");
    throw new Error(`Google Places respondeu ${resposta.status}: ${texto.slice(0, 300)}`);
  }
  const corpo = (await resposta.json()) as { places?: PlaceGoogle[] };
  return (corpo.places ?? []).map(lugarDoGoogle).filter((l): l is Lugar => l !== null);
}

// ---------------------------------------------------------------------------
// Reach com google de reserva
// ---------------------------------------------------------------------------

function mensagem(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

async function comReserva(
  reach: () => Promise<Lugar[]>,
  google: () => Promise<Lugar[]>,
): Promise<{ fonte: FonteRastro; lugares: Lugar[] }> {
  try {
    return { fonte: "reach", lugares: await reach() };
  } catch (e) {
    if (!(e instanceof ReachIndisponivel)) throw e;
    try {
      return { fonte: "google", lugares: await google() };
    } catch (e2) {
      throw new Error(`Rastro sem motor: reach (${e.message}) e google (${mensagem(e2)}) falharam.`);
    }
  }
}

/** O negócio no Maps (primeiro resultado) ou null se não achar. */
export async function buscarNegocio(nome: string, cidade: string): Promise<ResultadoBuscaNegocio> {
  const { fonte, lugares } = await comReserva(
    () => chamarReach("/buscar", { nome, cidade }),
    () => chamarGoogle(`${nome} ${cidade}`, 1),
  );
  return { fonte, lugar: lugares[0] ?? null };
}

/** Até `limite` negócios do mesmo tipo na cidade, sem o próprio negócio. */
export async function buscarVizinhos(
  tipo: string,
  cidade: string,
  excluirPlaceId: string | null,
  limite = 3,
): Promise<ResultadoBuscaVizinhos> {
  const { fonte, lugares } = await comReserva(
    () => chamarReach("/vizinhos", { tipo, cidade, excluirPlaceId, limite }),
    () => chamarGoogle(`${tipo} em ${cidade}`, Math.min(limite + 1, 20)),
  );
  return {
    fonte,
    lugares: lugares.filter((l) => l.placeId !== excluirPlaceId).slice(0, limite),
  };
}

/**
 * Link que abre direto a tela de avaliar no Google. Só funciona com placeId
 * do Google: se o lugar veio do reach, devolve null.
 */
export function linkAvaliacao(placeId: string, fonte: FonteRastro): string | null {
  if (fonte !== "google" || !placeId) return null;
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`;
}
