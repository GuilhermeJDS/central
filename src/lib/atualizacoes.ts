import "server-only";

import { execFile, spawn } from "node:child_process";
import { existsSync, openSync, readFileSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

import { configAtualizacoes, salvarAtualizacoes } from "@/lib/config";
import { db } from "@/lib/db";

/**
 * Tela Atualizações: tudo vem do GitHub público, sem token e sem servidor
 * de ninguém no meio.
 *  - Central: compara a versão local (package.json) com a do catalogo.json
 *    do repositório oficial e lista o que mudou.
 *  - Projetos: os repositórios públicos do autor (selo "novo" no que a
 *    pessoa ainda não viu).
 *  - Skills: as do catalogo.json que ainda não estão instaladas.
 * Para lançar algo novo para todo mundo, basta editar o catalogo.json e dar push.
 */
export const REPO_OFICIAL = process.env.CENTRAL_REPO?.trim() || "matheusmongarde/central";
export const AUTOR = REPO_OFICIAL.split("/")[0];
const RAW = `https://raw.githubusercontent.com/${REPO_OFICIAL}/main`;
const CACHE_MS = 6 * 60 * 60 * 1000;

export type Novidade = { versao: string; data: string; itens: string[] };
export type SkillCatalogo = {
  slug: string;
  nome: string;
  /** Nome do chefe que usa (ex.: "Editora Pauta"). */
  chefe: string;
  descricao: string;
  versao: string;
  /** Caminho do SKILL.md dentro do repositório oficial (ou URL https completa). */
  arquivo: string;
};
export type Catalogo = { versao: string; novidades: Novidade[]; skills: SkillCatalogo[] };
export type Projeto = { nome: string; descricao: string | null; url: string; estrelas: number; criadoEm: string; atualizadoEm: string; topicos: string[] };

const execFileAsync = promisify(execFile);

export function versaoLocal(): string {
  try {
    return JSON.parse(readFileSync(path.join(process.cwd(), "package.json"), "utf8")).version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

/** 1 se a > b, -1 se a < b, 0 se iguais ("1.10.0" > "1.9.2"). */
export function compararVersao(a: string, b: string): number {
  const pa = a.split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  const pb = b.split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}

// ---------------------------------------------------------------- cache em Config

async function lerCache<T>(chave: string): Promise<{ em: number; dado: T } | null> {
  const l = await db.config.findUnique({ where: { chave: `cache.${chave}` } });
  if (!l) return null;
  try {
    return JSON.parse(l.valor) as { em: number; dado: T };
  } catch {
    return null;
  }
}
async function gravarCache<T>(chave: string, dado: T) {
  const valor = JSON.stringify({ em: Date.now(), dado });
  await db.config.upsert({ where: { chave: `cache.${chave}` }, update: { valor }, create: { chave: `cache.${chave}`, valor } });
}

async function buscar<T>(url: string): Promise<T> {
  const r = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "central-aberta" },
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`${url} respondeu ${r.status}`);
  return (await r.json()) as T;
}

/** Usa o cache; busca de novo quando passou de 6 h ou quando `forcar`. */
async function comCache<T>(chave: string, buscarNovo: () => Promise<T>, forcar = false): Promise<{ dado: T | null; em: number | null; erro?: string }> {
  const c = await lerCache<T>(chave);
  if (!forcar && c && Date.now() - c.em < CACHE_MS) return { dado: c.dado, em: c.em };
  try {
    const dado = await buscarNovo();
    await gravarCache(chave, dado);
    return { dado, em: Date.now() };
  } catch (e) {
    return { dado: c?.dado ?? null, em: c?.em ?? null, erro: e instanceof Error ? e.message : "sem conexão" };
  }
}

export async function catalogo(forcar = false) {
  return comCache<Catalogo>("catalogo", async () => {
    const c = await buscar<Catalogo>(`${RAW}/catalogo.json`);
    return { versao: String(c.versao ?? "0.0.0"), novidades: Array.isArray(c.novidades) ? c.novidades : [], skills: Array.isArray(c.skills) ? c.skills : [] };
  }, forcar);
}

export async function projetos(forcar = false) {
  return comCache<Projeto[]>("projetos", async () => {
    const lista = await buscar<Array<Record<string, unknown>>>(`https://api.github.com/users/${AUTOR}/repos?type=owner&sort=created&per_page=50`);
    return lista
      .filter((r) => !r.fork && !r.private && !r.archived && r.name !== AUTOR)
      .map((r) => ({
        nome: String(r.name),
        descricao: (r.description as string | null) ?? null,
        url: String(r.html_url),
        estrelas: Number(r.stargazers_count ?? 0),
        criadoEm: String(r.created_at),
        atualizadoEm: String(r.pushed_at ?? r.updated_at),
        topicos: Array.isArray(r.topics) ? (r.topics as string[]) : [],
      }));
  }, forcar);
}

// ---------------------------------------------------------------- contador do menu

/** Só lê o cache (o menu não pode esperar a rede); renova no fundo quando vence. */
export async function contarNovidades(): Promise<number> {
  const [c, p, visto, instaladas] = await Promise.all([lerCache<Catalogo>("catalogo"), lerCache<Projeto[]>("projetos"), configAtualizacoes(), skillsInstaladas()]);
  if (!c || Date.now() - c.em > CACHE_MS) void catalogo().catch(() => {});
  if (!p || Date.now() - p.em > CACHE_MS) void projetos().catch(() => {});
  let n = 0;
  if (c && compararVersao(c.dado.versao, versaoLocal()) > 0) n++;
  if (p) n += p.dado.filter((r) => !visto.reposVistos.includes(r.nome)).length;
  if (c) n += c.dado.skills.filter((s) => !instaladas.has(s.slug) && !visto.skillsVistas.includes(s.slug)).length;
  return n;
}

export async function marcarTudoVisto() {
  const [c, p] = await Promise.all([lerCache<Catalogo>("catalogo"), lerCache<Projeto[]>("projetos")]);
  await salvarAtualizacoes({
    vistoEm: new Date().toISOString(),
    reposVistos: p?.dado.map((r) => r.nome) ?? [],
    skillsVistas: c?.dado.skills.map((s) => s.slug) ?? [],
  });
}

// ---------------------------------------------------------------- skills extras

export async function skillsInstaladas(): Promise<Set<string>> {
  const l = await db.skillInstalada.findMany({ select: { slug: true } });
  return new Set(l.map((s) => s.slug));
}

/** Baixa o SKILL.md do catálogo e guarda no banco (funciona na Vercel também). */
export async function instalarSkill(slug: string): Promise<{ ok: boolean; mensagem: string }> {
  const c = (await catalogo()).dado;
  const s = c?.skills.find((x) => x.slug === slug);
  if (!s) return { ok: false, mensagem: "Essa skill não está no catálogo." };
  const url = /^https:\/\//.test(s.arquivo) ? s.arquivo : `${RAW}/${s.arquivo.replace(/^\/+/, "")}`;
  if (!url.startsWith("https://raw.githubusercontent.com/")) return { ok: false, mensagem: "Só instalo skill que vem do GitHub." };
  const r = await fetch(url, { signal: AbortSignal.timeout(10_000), cache: "no-store" });
  if (!r.ok) return { ok: false, mensagem: `Não consegui baixar a skill (${r.status}).` };
  const conteudo = await r.text();
  if (!/^---[\s\S]*?\n---/.test(conteudo) || conteudo.length > 200_000) return { ok: false, mensagem: "O arquivo baixado não parece um SKILL.md." };
  await db.skillInstalada.upsert({
    where: { slug },
    update: { nome: s.nome, chefe: s.chefe, descricao: s.descricao, versao: s.versao, conteudo, origem: url },
    create: { slug, nome: s.nome, chefe: s.chefe, descricao: s.descricao, versao: s.versao, conteudo, origem: url },
  });
  return { ok: true, mensagem: `${s.nome} instalada. O ${s.chefe} já pode usar.` };
}

export async function removerSkill(slug: string) {
  await db.skillInstalada.deleteMany({ where: { slug } });
}

// ---------------------------------------------------------------- atualizar a Central

export type ModoAtualizar = { modo: "git"; podeAuto: true } | { modo: "vercel" | "docker" | "zip"; podeAuto: false };

export function comoAtualizar(): ModoAtualizar {
  if (process.env.VERCEL) return { modo: "vercel", podeAuto: false };
  if (existsSync("/.dockerenv")) return { modo: "docker", podeAuto: false };
  if (!existsSync(path.join(process.cwd(), ".git"))) return { modo: "zip", podeAuto: false };
  return { modo: "git", podeAuto: true };
}

const LOG = () => path.join(process.cwd(), "dados", "atualizacao.log");

/**
 * git pull + npm install + banco, num processo separado (o log vai para
 * dados/atualizacao.log). Em produção com PM2, reinicia no fim.
 */
export async function atualizarAgora(): Promise<{ ok: boolean; mensagem: string }> {
  const m = comoAtualizar();
  if (!m.podeAuto) return { ok: false, mensagem: "Daqui não dá para atualizar sozinho. Siga o passo a passo da tela." };
  try {
    const { stdout } = await execFileAsync("git", ["status", "--porcelain", "--untracked-files=no"], { cwd: process.cwd() });
    if (stdout.trim()) return { ok: false, mensagem: "Você mudou arquivos da Central. Guarde as mudanças (git stash) antes de atualizar." };
  } catch {
    return { ok: false, mensagem: "O git não respondeu. Rode git pull no terminal." };
  }
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const passos = [`git pull --ff-only`, `${npm} install --no-audit --no-fund`, `node scripts/db.mjs`];
  if (process.env.NODE_ENV === "production") passos.push(`${npm} run build`);
  if (process.env.pm_id !== undefined) passos.push("pm2 restart central");
  const fd = openSync(LOG(), "w");
  const p = spawn(passos.join(" && "), { cwd: process.cwd(), shell: true, detached: true, stdio: ["ignore", fd, fd] });
  p.unref();
  return {
    ok: true,
    mensagem: process.env.NODE_ENV === "production" && process.env.pm_id === undefined
      ? "Atualizando. Quando terminar, reinicie a Central (npm run start)."
      : "Atualizando. Em um ou dois minutos a Central recarrega sozinha.",
  };
}

export function logAtualizacao(): string {
  try {
    return readFileSync(LOG(), "utf8").slice(-4000);
  } catch {
    return "";
  }
}
