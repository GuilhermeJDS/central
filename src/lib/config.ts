import "server-only";

import { cifrar, decifrar } from "@/lib/cripto";
import { GRUPOS, provedor, type GrupoId } from "@/lib/catalogo-integracoes";
import { db } from "@/lib/db";

/**
 * Configurações guardadas na tabela Config.
 *   integracao.{grupo}.{provedor} → { campo: valor } (secretos cifrados)
 *   ativo.{grupo}                 → "id do provedor ativo"
 *   geral                         → nome do sistema e endereço público
 *   instalacao                    → passos do onboarding já feitos ou pulados
 */

export type Valores = Record<string, string | boolean | string[]>;

async function lerBruto(chave: string): Promise<string | null> {
  return (await db.config.findUnique({ where: { chave } }))?.valor ?? null;
}

async function gravar(chave: string, valor: string) {
  await db.config.upsert({ where: { chave }, update: { valor }, create: { chave, valor } });
}

async function lerJson<T>(chave: string, padrao: T): Promise<T> {
  const v = await lerBruto(chave);
  if (!v) return padrao;
  try {
    return { ...padrao, ...JSON.parse(v) };
  } catch {
    return padrao;
  }
}

// ---------------------------------------------------------------- integrações

/**
 * O Rastro vem pré-ligado pelo .env que o `npm run setup`
 * escreve: assim funcionam na primeira vez, sem colar token nenhum.
 */
function doAmbiente(g: GrupoId, p: string): Valores | null {
  if (g === "rastro" && p === "rastro" && process.env.RASTRO_TOKEN) return { url: process.env.RASTRO_URL || "http://127.0.0.1:4310", token: process.env.RASTRO_TOKEN };
  return null;
}

/** Valores do provedor, com os secretos já decifrados (uso no servidor). */
export async function integracao(g: GrupoId, p: string): Promise<Valores | null> {
  const bruto = await lerBruto(`integracao.${g}.${p}`);
  if (!bruto) return doAmbiente(g, p);
  const v = JSON.parse(bruto) as Valores;
  const def = provedor(g, p);
  for (const c of def?.campos ?? []) {
    if (c.secreto && typeof v[c.id] === "string" && v[c.id]) v[c.id] = (await decifrar(v[c.id] as string)) ?? "";
  }
  return v;
}

/** Provedor ativo e os valores dele; null quando nada está ligado. */
export async function ativo(g: GrupoId): Promise<{ id: string; valores: Valores } | null> {
  const def = GRUPOS.find((x) => x.id === g)!;
  const padrao = def.multiplo ? null : def.provedores[0].id;
  const id = (await lerBruto(`ativo.${g}`)) ?? padrao;
  if (!id) return null;
  const valores = await integracao(g, id);
  return valores ? { id, valores } : null;
}

export async function definirAtivo(g: GrupoId, p: string | null) {
  if (p === null) await db.config.deleteMany({ where: { chave: `ativo.${g}` } });
  else await gravar(`ativo.${g}`, p);
}

/**
 * Salva os campos de um provedor. Secreto vazio mantém o que já estava
 * (a tela nunca recebe o valor de volta).
 */
export async function salvarIntegracao(g: GrupoId, p: string, entrada: Valores) {
  const def = provedor(g, p);
  if (!def) throw new Error("Provedor desconhecido");
  const atual = (await integracao(g, p)) ?? {};
  const saida: Valores = {};
  for (const c of def.campos) {
    let v = entrada[c.id];
    if (c.tipo === "booleano") v = v === true || v === "true" || v === "on";
    else if (typeof v === "string") v = v.trim();
    if (c.secreto) {
      const valor = typeof v === "string" && v ? v : (atual[c.id] as string | undefined) ?? "";
      saida[c.id] = valor ? await cifrar(valor) : "";
    } else saida[c.id] = v ?? "";
  }
  await gravar(`integracao.${g}.${p}`, JSON.stringify(saida));
}

export async function apagarIntegracao(g: GrupoId, p: string) {
  await db.config.deleteMany({ where: { chave: `integracao.${g}.${p}` } });
  if ((await lerBruto(`ativo.${g}`)) === p) await definirAtivo(g, null);
}

export type ResumoCampo = { id: string; preenchido: boolean; mostra: string };

/** O que a tela pode ver: valores comuns inteiros, secretos só os 4 últimos. */
export async function resumoIntegracoes() {
  const linhas = await db.config.findMany({ where: { chave: { startsWith: "integracao." } } });
  const ativos = await db.config.findMany({ where: { chave: { startsWith: "ativo." } } });
  const r: Record<string, { ativo: string | null; provedores: Record<string, Record<string, ResumoCampo>> }> = {};
  for (const g of GRUPOS) {
    r[g.id] = { ativo: ativos.find((a) => a.chave === `ativo.${g.id}`)?.valor ?? null, provedores: {} };
    if (!g.multiplo && linhas.some((l) => l.chave === `integracao.${g.id}.${g.provedores[0].id}`)) r[g.id].ativo = g.provedores[0].id;
  }
  for (const [g, p] of [["rastro", "rastro"]] as [GrupoId, string][]) {
    const amb = doAmbiente(g, p);
    if (!amb || linhas.some((l) => l.chave === `integracao.${g}.${p}`)) continue;
    r[g].provedores[p] = { url: { id: "url", preenchido: true, mostra: String(amb.url) }, token: { id: "token", preenchido: true, mostra: `••••${String(amb.token).slice(-4)} (.env)` } };
    if (!r[g].ativo) r[g].ativo = p;
  }
  for (const l of linhas) {
    const [, g, p] = l.chave.split(".") as [string, GrupoId, string];
    const def = provedor(g, p);
    if (!def || !r[g]) continue;
    const v = JSON.parse(l.valor) as Valores;
    const campos: Record<string, ResumoCampo> = {};
    for (const c of def.campos) {
      const bruto = v[c.id];
      if (c.secreto) {
        const claro = typeof bruto === "string" && bruto ? ((await decifrar(bruto)) ?? "") : "";
        campos[c.id] = { id: c.id, preenchido: !!claro, mostra: claro ? `••••${claro.slice(-4)}` : "" };
      } else {
        campos[c.id] = { id: c.id, preenchido: bruto !== "" && bruto !== undefined && bruto !== false, mostra: typeof bruto === "boolean" ? String(bruto) : Array.isArray(bruto) ? bruto.join(", ") : (bruto ?? "") };
      }
    }
    r[g].provedores[p] = campos;
  }
  return r;
}

// ---------------------------------------------------------------- geral

export type ConfigGeral = { nomeSistema: string; appUrl: string };
export const GERAL_PADRAO: ConfigGeral = { nomeSistema: "Central", appUrl: "" };
export const configGeral = () => lerJson("geral", GERAL_PADRAO);
export async function salvarGeral(c: Partial<ConfigGeral>) {
  await gravar("geral", JSON.stringify({ ...(await configGeral()), ...c }));
}

/** Endereço público: o que foi salvo, APP_URL, ou o da própria requisição. */
export async function enderecoPublico(req?: Request): Promise<string> {
  const salvo = (await configGeral()).appUrl || process.env.APP_URL || "";
  if (salvo) return salvo.replace(/\/+$/, "");
  const h = req?.headers ?? (await import("next/headers").then((m) => m.headers()).catch(() => null));
  if (h) {
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (host) return `${h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https")}://${host}`;
  }
  return "http://localhost:3000";
}

/** A instalação começou? (Existe ao menos um usuário.) */
export async function instalado() {
  return (await db.user.count()) > 0;
}

export async function marcarPasso(passo: string) {
  const feitos = await lerJson<{ passos: string[] }>("instalacao", { passos: [] });
  if (!feitos.passos.includes(passo)) feitos.passos.push(passo);
  await gravar("instalacao", JSON.stringify(feitos));
}
export const passosFeitos = async () => (await lerJson<{ passos: string[] }>("instalacao", { passos: [] })).passos;

// ---------------------------------------------------------------- atualizações

export type ConfigAtualizacoes = { vistoEm: string | null; reposVistos: string[]; skillsVistas: string[] };
const ATUALIZACOES_PADRAO: ConfigAtualizacoes = { vistoEm: null, reposVistos: [], skillsVistas: [] };
export const configAtualizacoes = () => lerJson("atualizacoes", ATUALIZACOES_PADRAO);
export async function salvarAtualizacoes(c: Partial<ConfigAtualizacoes>) {
  await gravar("atualizacoes", JSON.stringify({ ...(await configAtualizacoes()), ...c }));
}
