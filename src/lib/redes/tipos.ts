/**
 * Tipos normalizados dos coletores das redes (só servidor) e o erro padrão.
 *
 * ErroRede nunca carrega o token: a mensagem é montada aqui, e qualquer texto
 * vindo da API passa por `limpar` antes (que mascara os segredos).
 */
import { CATALOGO_REDES, type RedeConectavel } from "@/lib/redes/catalogo";

export type MotivoErroRede =
  | "token_invalido"
  | "token_vencido"
  | "sem_permissao"
  | "conta_nao_profissional"
  | "nao_encontrado"
  | "limite"
  | "entrada"
  | "indisponivel";

export class ErroRede extends Error {
  readonly rede: RedeConectavel;
  readonly motivo: MotivoErroRede;
  constructor(rede: RedeConectavel, motivo: MotivoErroRede, mensagem: string) {
    super(`${CATALOGO_REDES[rede].nome}: ${mensagem}`);
    this.name = "ErroRede";
    this.rede = rede;
    this.motivo = motivo;
  }
}

/** O token deixou de valer (a conexão precisa ser trocada). */
export function tokenCaiu(e: unknown): boolean {
  return e instanceof ErroRede && (e.motivo === "token_invalido" || e.motivo === "token_vencido");
}

export type ContaExterna = {
  id: string;
  nome: string;
  /** null = a rede não informa (ou não vence). */
  expiraEm: Date | null;
};

export type ResultadoTeste = { ok: true; conta: ContaExterna; motivo: null } | { ok: false; conta: null; motivo: string };

/** O que os coletores recebem para ler (já decifrado, só na memória). */
export type Conexao = {
  token: string;
  /** YouTube: token OAuth. */
  refresh: string | null;
  contaExternaId: string;
};

export type Perfil = {
  id: string;
  nome: string;
  usuario: string | null;
  seguidores: number | null;
  publicacoes: number | null;
  link: string | null;
  descricao?: string | null;
};

export type Metricas = Partial<
  Record<"visualizacoes" | "curtidas" | "comentarios" | "compartilhamentos" | "salvamentos" | "alcance", number>
>;

export type Publicacao = {
  id: string;
  texto: string;
  link: string | null;
  /** ISO. */
  data: string | null;
  formato: string | null;
  duracaoSegundos?: number | null;
  /** Miniatura do post (quando a rede manda). */
  imagem?: string | null;
  /** Nas buscas (virais): quem publicou e quantos seguidores tem. */
  autor?: string | null;
  seguidoresAutor?: number | null;
  metricas: Metricas;
};

export type Metrica = { nome: string; valor: number };

export function numero(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

/** Tira os campos sem número (métricas que a API não mandou). */
export function metricas(m: Partial<Record<keyof Metricas, unknown>>): Metricas {
  const out: Metricas = {};
  for (const [k, v] of Object.entries(m) as Array<[keyof Metricas, unknown]>) {
    const n = numero(v);
    if (n !== null) out[k] = n;
  }
  return out;
}
