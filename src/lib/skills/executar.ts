/**
 * Executor único das skills da Central.
 *
 * Onde a skill mora:
 *  - skills/<area>/<slug>/SKILL.md, no próprio repositório (as que vêm junto);
 *  - tabela skills_instaladas (as que a pessoa instalou em Atualizações).
 * O slug é único entre todas as áreas, então basta o nome para achar.
 *
 * O prompt de sistema é o SKILL.md + os arquivos de apoio da pasta (.md e
 * .json, até MAX_APOIO caracteres) + a voz do dono (ficha › "Como fala").
 * Quando o chefe passa a rede (Editora Pauta), ela vai no topo: a mesma skill
 * serve Instagram, TikTok, YouTube, LinkedIn e X.
 *
 * Só servidor: lê arquivos com fs e chama o modelo com a chave da conta.
 */
import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

import type { EntradaExecutar, FuncaoExecutar, ResultadoExecutar } from "@/lib/chefes/motor";
import { prisma } from "@/lib/prisma";
import { rodarSkillNoModelo } from "@/lib/skills/rodar-no-modelo";

export const RAIZ_SKILLS = path.join(/* turbopackIgnore: true */ process.cwd(), "skills");
const MAX_APOIO = 60_000;

export type SkillAchada = { slug: string; area: string; pasta: string | null; skillMd: string; origem: "repositorio" | "instalada" };

const cacheLocal = new Map<string, SkillAchada | null>();

/** Acha a skill pelo slug: primeiro na pasta skills/, depois nas instaladas. */
export async function acharSkill(slug: string): Promise<SkillAchada | null> {
  if (!/^[a-z0-9][a-z0-9-]{1,60}$/.test(slug)) return null;
  if (!cacheLocal.has(slug)) {
    let achada: SkillAchada | null = null;
    for (const area of await fs.readdir(RAIZ_SKILLS).catch(() => [] as string[])) {
      const pasta = path.join(RAIZ_SKILLS, area, slug);
      const md = await fs.readFile(path.join(pasta, "SKILL.md"), "utf-8").catch(() => null);
      if (md) {
        achada = { slug, area, pasta, skillMd: md, origem: "repositorio" };
        break;
      }
    }
    cacheLocal.set(slug, achada);
  }
  const local = cacheLocal.get(slug);
  if (local) return local;
  const instalada = await prisma.skillInstalada.findUnique({ where: { slug } });
  return instalada ? { slug, area: "instaladas", pasta: null, skillMd: instalada.conteudo, origem: "instalada" } : null;
}

/** Arquivos de apoio da pasta (subpastas também), em ordem, até o limite. */
async function arquivosDeApoio(pasta: string): Promise<string[]> {
  const partes: string[] = [];
  let total = 0;
  async function andar(dir: string) {
    const itens = (await fs.readdir(dir, { withFileTypes: true }).catch(() => [])).sort((a, b) => a.name.localeCompare(b.name));
    for (const it of itens) {
      const cheio = path.join(dir, it.name);
      if (it.isDirectory()) await andar(cheio);
      else if (/\.(md|json)$/.test(it.name) && it.name !== "SKILL.md" && it.name !== "LICENSE.md") {
        const conteudo = (await fs.readFile(cheio, "utf-8")).trim();
        if (total + conteudo.length > MAX_APOIO) continue;
        total += conteudo.length;
        partes.push(`<arquivo nome="${path.relative(pasta, cheio)}">\n${conteudo}\n</arquivo>`);
      }
    }
  }
  await andar(pasta);
  return partes;
}

export async function montarSystem(skill: SkillAchada, opts: { rede?: string; voz?: string }): Promise<string> {
  const partes: string[] = [];
  if (opts.rede) partes.push(`<rede>${opts.rede}</rede>\nTodo o trabalho desta vez é para o ${opts.rede}. Siga a parte da skill que fala dessa rede e ignore as outras.`);
  partes.push(skill.skillMd.trim());
  if (skill.pasta) partes.push(...(await arquivosDeApoio(skill.pasta)));
  if (opts.voz?.trim()) partes.push(`<voz_do_dono>\n${opts.voz.trim()}\n</voz_do_dono>\nEscreva do jeito que o dono escreve (exemplos acima).`);
  return partes.join("\n\n");
}

/** Executor de um "repositório" do chefe. `rede` só para a Editora Pauta. */
export function executorDeSkills(opts: { rede?: string } = {}): FuncaoExecutar {
  return async (slug: string, entrada: EntradaExecutar): Promise<ResultadoExecutar> => {
    const skill = await acharSkill(slug);
    if (!skill) throw new Error(`Skill não encontrada: "${slug}"`);
    const system = await montarSystem(skill, { rede: opts.rede, voz: entrada.voz });
    const r = await rodarSkillNoModelo(system, entrada);
    return { saida: r.saida, usoTokens: r.usoTokens, modelo: r.modelo, provedor: r.provedor, origem: r.origem };
  };
}

/** Descrição do frontmatter (o chefe escolhe a skill por ela). */
export function extrairDescricao(md: string): string {
  const fm = md.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fm) return "";
  const linhas = fm[1].split(/\r?\n/);
  const i = linhas.findIndex((l) => /^description:/.test(l));
  if (i === -1) return "";
  const resto = linhas[i].replace(/^description:\s*/, "").trim();
  if (resto && !/^[>|][+-]?$/.test(resto)) return resto.replace(/^["']|["']$/g, "").trim();
  const corpo: string[] = [];
  for (const l of linhas.slice(i + 1)) {
    if (l.trim() && !/^\s/.test(l)) break;
    corpo.push(l.trim());
  }
  return corpo.join(" ").replace(/\s+/g, " ").trim();
}
