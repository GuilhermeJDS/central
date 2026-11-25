// Só servidor: lê arquivos de vendor/ com fs e chama o modelo da conta (rodar-no-modelo).
// Nunca importar em Client Component.
import { promises as fs } from "fs"
import path from "path"

import type { Credencial, OrigemChave } from "@/lib/ia/credencial-base"
import type { ProvedorIA } from "@/lib/ia/provedores/catalogo"
import { rodarSkillNoModelo } from "@/lib/skills/rodar-no-modelo"

if (typeof window !== "undefined") {
  throw new Error("executarSkillInstagram só roda no servidor")
}

export const SKILLS_INSTAGRAM = [
  "ig-profile",
  "ig-reel",
  "ig-viral",
  "ig-caption",
  "ig-carousel",
  "ig-story",
  "ig-plan",
  "ig-human",
  "ig-comment",
  "ig-reply",
  "ig-dm",
  "ig-repurpose",
  "ig-audit",
] as const

export type SkillInstagram = (typeof SKILLS_INSTAGRAM)[number]

export type EntradaSkillInstagram = {
  texto: string
  imagens?: Array<{ base64: string; mediaType: string }>
  voz?: string
  /** Chave da conta (lib/ia/credencial). Sem ela: chave do ambiente (.env). */
  credencial?: Credencial
}

export type UsoTokens = {
  entrada: number
  saida: number
  cacheLeitura: number
  cacheEscrita: number
  total: number
}

export type ResultadoSkillInstagram = {
  saida: string
  usoTokens: UsoTokens
  skill: string
  modelo: string
  provedor: ProvedorIA
  origem: OrigemChave
}

export function raizRepositorioInstagram(): string {
  return path.join(process.cwd(), "vendor", "skills", "instagram-agent-skill")
}

export function validarSkillInstagram(skill: string): SkillInstagram {
  if (!(SKILLS_INSTAGRAM as readonly string[]).includes(skill)) {
    throw new Error(`Skill do Instagram desconhecida: "${skill}"`)
  }
  return skill as SkillInstagram
}

async function montarSystemPrompt(skill: SkillInstagram, voz?: string): Promise<string> {
  const raiz = raizRepositorioInstagram()
  const pasta = path.join(raiz, "skills", skill)

  const skillMd = await fs.readFile(path.join(pasta, "SKILL.md"), "utf-8")
  const partes = [skillMd.trim()]

  const jsons = (await fs.readdir(pasta)).filter((f) => f.endsWith(".json")).sort()
  for (const nome of jsons) {
    const conteudo = await fs.readFile(path.join(pasta, nome), "utf-8")
    partes.push(`<arquivo nome="${nome}">\n${conteudo.trim()}\n</arquivo>`)
  }

  const conteudoVoz =
    voz?.trim() || (await fs.readFile(path.join(raiz, "templates", "voice.md"), "utf-8")).trim()
  partes.push(`<arquivo nome="voice.md">\n${conteudoVoz}\n</arquivo>`)

  return partes.join("\n\n")
}

export async function executarSkillInstagram(
  skill: string,
  entrada: EntradaSkillInstagram,
): Promise<ResultadoSkillInstagram> {
  const nome = validarSkillInstagram(skill)

  const system = await montarSystemPrompt(nome, entrada.voz)
  const r = await rodarSkillNoModelo(system, entrada)
  return { ...r, skill: nome }
}
