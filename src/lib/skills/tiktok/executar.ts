// Só servidor: lê arquivos de vendor/skills/tiktok com fs e chama o modelo da conta (rodar-no-modelo).
// Nunca importar em Client Component.
import { promises as fs } from "fs"
import path from "path"

import type { Credencial, OrigemChave } from "@/lib/ia/credencial-base"
import type { ProvedorIA } from "@/lib/ia/provedores/catalogo"
import { rodarSkillNoModelo } from "@/lib/skills/rodar-no-modelo"

if (typeof window !== "undefined") {
  throw new Error("executarSkillTiktok só roda no servidor")
}

export const SKILLS_TIKTOK = ["tt-ideias", "tt-ganchos", "tt-roteiro", "tt-fotos", "tt-legenda"] as const

export type SkillTiktok = (typeof SKILLS_TIKTOK)[number]

export type EntradaSkillTiktok = {
  texto: string
  imagens?: Array<{ base64: string; mediaType: string }>
  voz?: string
  /** Chave da conta (lib/ia/credencial). Sem ela: chave da Korely. */
  credencial?: Credencial
}

export type ResultadoSkillTiktok = {
  saida: string
  usoTokens: { entrada: number; saida: number; cacheLeitura: number; cacheEscrita: number; total: number }
  skill: string
  modelo: string
  provedor: ProvedorIA
  origem: OrigemChave
}

// Arquivos de apoio da pasta da skill que vão junto com o SKILL.md.
const EXTENSOES_ANEXO = [".json", ".md"]

export function raizRepositorioTiktok(): string {
  return path.join(process.cwd(), "vendor", "skills", "tiktok")
}

export function validarSkillTiktok(skill: string): SkillTiktok {
  if (!(SKILLS_TIKTOK as readonly string[]).includes(skill)) {
    throw new Error(`Skill do TikTok desconhecida: "${skill}"`)
  }
  return skill as SkillTiktok
}

async function montarSystemPrompt(skill: SkillTiktok, voz?: string): Promise<string> {
  const raiz = raizRepositorioTiktok()
  const pasta = path.join(raiz, "skills", skill)

  const partes = [(await fs.readFile(path.join(pasta, "SKILL.md"), "utf-8")).trim()]
  const anexos = (await fs.readdir(pasta))
    .filter((f) => f !== "SKILL.md" && EXTENSOES_ANEXO.includes(path.extname(f)))
    .sort()
  for (const nome of anexos) {
    const conteudo = await fs.readFile(path.join(pasta, nome), "utf-8")
    partes.push(`<arquivo nome="${nome}">\n${conteudo.trim()}\n</arquivo>`)
  }

  const conteudoVoz = voz?.trim() || (await fs.readFile(path.join(raiz, "templates", "voice.md"), "utf-8")).trim()
  partes.push(`<arquivo nome="voice.md">\n${conteudoVoz}\n</arquivo>`)

  return partes.join("\n\n")
}

export async function executarSkillTiktok(skill: string, entrada: EntradaSkillTiktok): Promise<ResultadoSkillTiktok> {
  const nome = validarSkillTiktok(skill)
  const system = await montarSystemPrompt(nome, entrada.voz)
  const r = await rodarSkillNoModelo(system, entrada)
  return { ...r, skill: nome }
}
