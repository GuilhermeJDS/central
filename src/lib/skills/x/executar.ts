// Só servidor: lê arquivos de vendor/ com fs e chama o modelo da conta (rodar-no-modelo).
// Nunca importar em Client Component.
import { promises as fs } from "fs"
import path from "path"

import type { Credencial, OrigemChave } from "@/lib/ia/credencial-base"
import type { ProvedorIA } from "@/lib/ia/provedores/catalogo"
import { rodarSkillNoModelo } from "@/lib/skills/rodar-no-modelo"

if (typeof window !== "undefined") {
  throw new Error("executarSkillX só roda no servidor")
}

export const SKILLS_X = [
  "x-audit",
  "x-comment",
  "x-dm",
  "x-human",
  "x-plan",
  "x-post",
  "x-profile",
  "x-reply",
  "x-repurpose",
  "x-thread",
  "x-viral",
] as const

export type SkillX = (typeof SKILLS_X)[number]

export type EntradaSkillX = {
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

export type ResultadoSkillX = {
  saida: string
  usoTokens: UsoTokens
  skill: string
  modelo: string
  provedor: ProvedorIA
  origem: OrigemChave
}

// Arquivos de apoio da pasta da skill que vão junto com o SKILL.md.
const EXTENSOES_ANEXO = [".json", ".md", ".csv", ".txt"]

export function raizRepositorioX(): string {
  return path.join(process.cwd(), "vendor", "skills", "x-agent-skill")
}

export function pastaSkillX(skill: SkillX): string {
  return path.join(raizRepositorioX(), "skills", skill)
}

export function validarSkillX(skill: string): SkillX {
  if (!(SKILLS_X as readonly string[]).includes(skill)) {
    throw new Error(`Skill do X desconhecida: "${skill}"`)
  }
  return skill as SkillX
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

async function montarSystemPrompt(skill: SkillX, voz?: string): Promise<string> {
  const raiz = raizRepositorioX()
  const pasta = pastaSkillX(skill)

  const skillMd = await fs.readFile(path.join(pasta, "SKILL.md"), "utf-8")
  const partes = [skillMd.trim()]

  for (const nome of await listarAnexos(pasta)) {
    const conteudo = await fs.readFile(path.join(pasta, nome), "utf-8")
    partes.push(`<arquivo nome="${nome}">\n${conteudo.trim()}\n</arquivo>`)
  }

  const conteudoVoz =
    voz?.trim() || (await fs.readFile(path.join(raiz, "templates", "voice.md"), "utf-8")).trim()
  partes.push(`<arquivo nome="voice.md">\n${conteudoVoz}\n</arquivo>`)

  return partes.join("\n\n")
}

export async function executarSkillX(
  skill: string,
  entrada: EntradaSkillX,
): Promise<ResultadoSkillX> {
  const nome = validarSkillX(skill)

  const system = await montarSystemPrompt(nome, entrada.voz)
  const r = await rodarSkillNoModelo(system, entrada)
  return { ...r, skill: nome }
}
