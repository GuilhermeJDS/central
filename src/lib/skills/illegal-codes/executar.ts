// Só servidor: lê arquivos de vendor/ com fs e chama o modelo da conta (rodar-no-modelo).
// Nunca importar em Client Component.
import { promises as fs } from "fs"
import path from "path"

import type { Credencial, OrigemChave } from "@/lib/ia/credencial-base"
import type { ProvedorIA } from "@/lib/ia/provedores/catalogo"
import { rodarSkillNoModelo } from "@/lib/skills/rodar-no-modelo"

if (typeof window !== "undefined") {
  throw new Error("executarSkillIllegalCodes só roda no servidor")
}

export const SKILLS_ILLEGAL_CODES = [
  "67",
  "aura-farming",
  "china-maxing",
  "crash-out",
  "larp",
] as const

export type SkillIllegalCodes = (typeof SKILLS_ILLEGAL_CODES)[number]

export type EntradaSkillIllegalCodes = {
  texto: string
  imagens?: Array<{ base64: string; mediaType: string }>
  voz?: string
  /** Chave da conta (lib/ia/credencial). Sem ela: chave da Korely. */
  credencial?: Credencial
}

export type UsoTokens = {
  entrada: number
  saida: number
  cacheLeitura: number
  cacheEscrita: number
  total: number
}

export type ResultadoSkillIllegalCodes = {
  saida: string
  usoTokens: UsoTokens
  skill: string
  modelo: string
  provedor: ProvedorIA
  origem: OrigemChave
}

// Arquivos de apoio da pasta da skill que vão junto com o SKILL.md.
const EXTENSOES_ANEXO = [".json", ".md", ".csv", ".txt"]

export function raizRepositorioIllegalCodes(): string {
  return path.join(process.cwd(), "vendor", "skills", "claude-illegal-codes")
}

export function pastaSkillIllegalCodes(skill: SkillIllegalCodes): string {
  return path.join(raizRepositorioIllegalCodes(), skill)
}

export function validarSkillIllegalCodes(skill: string): SkillIllegalCodes {
  if (!(SKILLS_ILLEGAL_CODES as readonly string[]).includes(skill)) {
    throw new Error(`Skill do claude-illegal-codes desconhecida: "${skill}"`)
  }
  return skill as SkillIllegalCodes
}

async function listarAnexos(pasta: string, relativo = ""): Promise<string[]> {
  const entradas = await fs.readdir(path.join(pasta, relativo), { withFileTypes: true })
  const encontrados: string[] = []
  for (const e of entradas) {
    if (e.name.startsWith(".")) continue
    const caminho = relativo ? `${relativo}/${e.name}` : e.name
    if (e.isDirectory()) {
      encontrados.push(...(await listarAnexos(pasta, caminho)))
    } else if (caminho !== "SKILL.md" && EXTENSOES_ANEXO.includes(path.extname(e.name))) {
      encontrados.push(caminho)
    }
  }
  return encontrados.sort()
}

async function montarSystemPrompt(skill: SkillIllegalCodes, voz?: string): Promise<string> {
  const pasta = pastaSkillIllegalCodes(skill)

  const skillMd = await fs.readFile(path.join(pasta, "SKILL.md"), "utf-8")
  const partes = [skillMd.trim()]

  let temVoz = false
  for (const nome of await listarAnexos(pasta)) {
    if (path.basename(nome) === "voice.md") {
      temVoz = true
      if (voz?.trim()) {
        partes.push(`<arquivo nome="${nome}">\n${voz.trim()}\n</arquivo>`)
        continue
      }
    }
    const conteudo = await fs.readFile(path.join(pasta, nome), "utf-8")
    partes.push(`<arquivo nome="${nome}">\n${conteudo.trim()}\n</arquivo>`)
  }

  // Este repositório não tem voice.md fora da pasta da skill: a voz só entra se vier na chamada
  // (e substitui o voice.md da própria skill, quando ele existir).
  if (voz?.trim() && !temVoz) {
    partes.push(`<arquivo nome="voice.md">\n${voz.trim()}\n</arquivo>`)
  }

  return partes.join("\n\n")
}

export async function executarSkillIllegalCodes(
  skill: string,
  entrada: EntradaSkillIllegalCodes,
): Promise<ResultadoSkillIllegalCodes> {
  const nome = validarSkillIllegalCodes(skill)

  const system = await montarSystemPrompt(nome, entrada.voz)
  const r = await rodarSkillNoModelo(system, entrada)
  return { ...r, skill: nome }
}
