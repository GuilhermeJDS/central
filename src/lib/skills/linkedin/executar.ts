// Só servidor: lê arquivos de vendor/ com fs e chama o modelo da conta (rodar-no-modelo).
// Nunca importar em Client Component.
import { promises as fs } from "fs"
import path from "path"

import type { Credencial, OrigemChave } from "@/lib/ia/credencial-base"
import type { ProvedorIA } from "@/lib/ia/provedores/catalogo"
import { rodarSkillNoModelo } from "@/lib/skills/rodar-no-modelo"

if (typeof window !== "undefined") {
  throw new Error("executarSkillLinkedin só roda no servidor")
}

export const SKILLS_LINKEDIN = [
  "li-audit",
  "li-carousel",
  "li-comment",
  "li-dm",
  "li-human",
  "li-inbox",
  "li-plan",
  "li-post",
  "li-profile",
  "li-reply",
  "li-repurpose",
] as const

export type SkillLinkedin = (typeof SKILLS_LINKEDIN)[number]

export type EntradaSkillLinkedin = {
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

export type ResultadoSkillLinkedin = {
  saida: string
  usoTokens: UsoTokens
  skill: string
  modelo: string
  provedor: ProvedorIA
  origem: OrigemChave
}

// Arquivos de apoio da pasta da skill que vão junto com o SKILL.md.
const EXTENSOES_ANEXO = [".json", ".md", ".csv", ".txt"]

export function raizRepositorioLinkedin(): string {
  return path.join(process.cwd(), "vendor", "skills", "linkedin-agent-skill")
}

export function pastaSkillLinkedin(skill: SkillLinkedin): string {
  return path.join(raizRepositorioLinkedin(), "skills", skill)
}

export function validarSkillLinkedin(skill: string): SkillLinkedin {
  if (!(SKILLS_LINKEDIN as readonly string[]).includes(skill)) {
    throw new Error(`Skill do LinkedIn desconhecida: "${skill}"`)
  }
  return skill as SkillLinkedin
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

async function montarSystemPrompt(skill: SkillLinkedin, voz?: string): Promise<string> {
  const raiz = raizRepositorioLinkedin()
  const pasta = pastaSkillLinkedin(skill)

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

export async function executarSkillLinkedin(
  skill: string,
  entrada: EntradaSkillLinkedin,
): Promise<ResultadoSkillLinkedin> {
  const nome = validarSkillLinkedin(skill)

  const system = await montarSystemPrompt(nome, entrada.voz)
  const r = await rodarSkillNoModelo(system, entrada)
  return { ...r, skill: nome }
}
