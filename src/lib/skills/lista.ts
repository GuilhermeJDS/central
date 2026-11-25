import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

import { nomeDaAcao } from "@/lib/central/nome-acao";
import { prisma } from "@/lib/prisma";
import { extrairDescricao, RAIZ_SKILLS } from "@/lib/skills/executar";

export type SkillLista = { slug: string; area: string; nome: string; descricao: string; origem: "vem junto" | "instalada"; chefe: string };

const CHEFE_DA_AREA: Record<string, string> = {
  redes: "Editora Pauta",
  vendas: "Negociador Trato",
  prospeccao: "Negociador Trato",
  chicote: "Negociador Trato",
  estrategia: "Conselho",
  operacao: "Conselho",
  bastidor: "Norte e Revisor",
};

/** Todas as skills: as da pasta skills/ e as instaladas em Atualizações. */
export async function listarSkills(): Promise<SkillLista[]> {
  const lista: SkillLista[] = [];
  for (const area of (await fs.readdir(RAIZ_SKILLS).catch(() => [] as string[])).sort()) {
    for (const slug of (await fs.readdir(path.join(RAIZ_SKILLS, area)).catch(() => [] as string[])).sort()) {
      const md = await fs.readFile(path.join(RAIZ_SKILLS, area, slug, "SKILL.md"), "utf-8").catch(() => null);
      if (!md) continue;
      lista.push({ slug, area, nome: nomeDaAcao(null, slug), descricao: extrairDescricao(md), origem: "vem junto", chefe: CHEFE_DA_AREA[area] ?? "Equipe" });
    }
  }
  for (const s of await prisma.skillInstalada.findMany({ orderBy: { nome: "asc" } })) {
    lista.push({ slug: s.slug, area: "instaladas", nome: s.nome, descricao: s.descricao, origem: "instalada", chefe: s.chefe });
  }
  return lista;
}
