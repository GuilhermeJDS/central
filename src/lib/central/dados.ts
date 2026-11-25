/**
 * Leituras da Central. Tudo filtra pelo accountId da sessão (exigirCentral).
 * Nada aqui chama o modelo.
 */
import "server-only";

import type { ExecucaoSkill } from "@/generated/prisma/client";
import { mensagemParaDono } from "@/lib/chefes/chamar-modelo";
import type { AcaoDaSemana } from "@/lib/chefes/norte";
import type { ComparacaoVizinhos, InsightRastro } from "@/lib/chefes/inspetor-rastro";
import type { InsightRotina } from "@/lib/chefes/gerente-rotina";
import {
  DEPARTAMENTOS_CENTRAL,
  departamentoPorChefe,
  type InfoDepartamento,
} from "@/lib/central/departamentos";
import { toDateKeyBR } from "@/lib/agenda-date";
import { fontesDaEntrada } from "@/lib/central/ligacoes";
import type { TipoEntrega } from "@/lib/central/entregas-tipos";
import { hrefDaPeca } from "@/lib/central/estudio/secoes";
import { cadeiaDaEntrada, proximaDaExecucao } from "@/lib/chefes/cardapio";
import { nomeDaAcao, semIdDeSkill } from "@/lib/central/nome-acao";
import { prisma } from "@/lib/prisma";

const DIA_MS = 86_400_000;
/** Chefes que leem números → a ação registrada na entrada. */
const LEITURAS: Record<string, string> = { "Gerente Rotina": "lerRotina", "Inspetor Rastro": "compararVizinhos" };
/** Execução parada em NA_FILA/RODANDO há mais que isso = falhou (ex.: servidor reiniciou). */
const LIMITE_PREPARANDO_MS = 15 * 60 * 1000;

// ---------------------------------------------------------------------------
// Texto
// ---------------------------------------------------------------------------

/** Tira marcas de markdown de uma linha. */
function limparLinha(l: string): string {
  return l
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+[.)])\s+/, "")
    .replace(/[*_`~]+/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .trim();
}

export function cortar(t: string, max: number): string {
  const s = t.replace(/\s+/g, " ").trim();
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

/** Primeira linha com texto de verdade (pula cercas, linhas de separador e vazias). */
export function primeiraFrase(texto: string | null | undefined, max = 140): string {
  for (const bruta of (texto ?? "").split(/\r?\n/)) {
    if (/^\s*(```|---+|\*\*\*+|___+)\s*$/.test(bruta)) continue;
    const l = limparLinha(bruta);
    if (l.length >= 3) return cortar(l, max);
  }
  return "";
}

function lerJson<T>(texto: string | null): T | null {
  if (!texto) return null;
  try {
    return JSON.parse(texto) as T;
  } catch {
    return null;
  }
}

function acaoDaEntrada(entrada: unknown): string | null {
  if (entrada && typeof entrada === "object" && "acao" in entrada) {
    const a = (entrada as { acao: unknown }).acao;
    return typeof a === "string" ? a : null;
  }
  return null;
}

function pedidoDaEntrada(entrada: unknown): string | null {
  if (entrada && typeof entrada === "object" && "pedido" in entrada) {
    const p = (entrada as { pedido: unknown }).pedido;
    return typeof p === "string" ? p : null;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Semana
// ---------------------------------------------------------------------------

/** Segunda-feira 00:00 em São Paulo (UTC-3, sem horário de verão). */
export function inicioDaSemana(agora = new Date()): Date {
  const sp = new Date(agora.getTime() - 3 * 3_600_000);
  const diaSemana = (sp.getUTCDay() + 6) % 7; // 0 = segunda
  const meiaNoite = Date.UTC(sp.getUTCFullYear(), sp.getUTCMonth(), sp.getUTCDate() - diaSemana);
  return new Date(meiaNoite + 3 * 3_600_000);
}

export function saudacao(agora = new Date()): string {
  const hora = Number(
    new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "numeric", hourCycle: "h23" }).format(
      agora,
    ),
  );
  if (hora >= 5 && hora < 12) return "Bom dia";
  if (hora >= 12 && hora < 18) return "Boa tarde";
  return "Boa noite";
}

// ---------------------------------------------------------------------------
// Norte
// ---------------------------------------------------------------------------

export type AcaoAtual = {
  execucaoId: string;
  acao: AcaoDaSemana;
  fontes: Array<{ chefe: string; titulo: string }>;
  decisao: ExecucaoSkill["decisao"];
  /** "A equipe faz" disparou um pedido ao chefe (execução filha). */
  equipeFaz: boolean;
};

/** Máximo de ações do Norte por semana (o placar vai até 5). */
export const MAX_ACOES_SEMANA = 5;

/** Todas as ações do Norte desta semana (desde segunda), da mais antiga para a mais nova. */
export async function acoesDaSemana(accountId: string): Promise<AcaoAtual[]> {
  const linhas = await prisma.execucaoSkill.findMany({
    where: {
      accountId,
      departamento: "DIRETORIA",
      chefe: "Norte",
      tipo: "CHEFE",
      status: "CONCLUIDA",
      acao: "acaoDaSemana",
      concluidaEm: { gte: inicioDaSemana() },
    },
    orderBy: { concluidaEm: "asc" },
    take: 12,
    select: {
      id: true,
      saida: true,
      entrada: true,
      decisao: true,
      decididaEm: true,
      escolha: true,
      _count: { select: { filhas: true } },
    },
  });
  const acoes: AcaoAtual[] = [];
  for (const e of linhas) {
    const acao = lerJson<AcaoDaSemana>(e.saida);
    if (!acao?.titulo) continue;
    let equipeFaz = e.decisao === "APROVADA" && (e.escolha === "equipe" || (e.escolha === null && e._count.filhas > 0));
    // Ações antigas (sem "escolha"): Gerente Rotina e Inspetor Rastro fazem leitura própria.
    if (!equipeFaz && e.escolha === null && e.decisao === "APROVADA" && e.decididaEm && LEITURAS[acao.chefe]) {
      equipeFaz =
        (await prisma.execucaoSkill.count({
          where: {
            accountId,
            chefe: acao.chefe,
            acao: LEITURAS[acao.chefe],
            criadaEm: { gte: new Date(e.decididaEm.getTime() - 5_000), lte: new Date(e.decididaEm.getTime() + 60_000) },
          },
        })) > 0;
    }
    const fontes = fontesDaEntrada(e.entrada).map((f) => ({ chefe: f.chefe, titulo: f.titulo }));
    acoes.push({ execucaoId: e.id, acao, fontes, decisao: e.decisao, equipeFaz });
  }
  return acoes;
}

/**
 * 0–5: ações do Norte desta semana já feitas ("A equipe faz" ou "Eu faço").
 * "Agora não" (PASSADA) e as ações ainda abertas não contam.
 */
export async function ceuDaSemana(accountId: string): Promise<number> {
  const n = await prisma.execucaoSkill.count({
    where: {
      accountId,
      chefe: "Norte",
      tipo: "CHEFE",
      acao: "acaoDaSemana",
      concluidaEm: { gte: inicioDaSemana() },
      decisao: "APROVADA",
    },
  });
  return Math.min(n, MAX_ACOES_SEMANA);
}

const WHERE_PENDENTE = { tipo: "SKILL", status: "CONCLUIDA", decisao: "PENDENTE" } as const;

export async function contarPendentes(accountId: string): Promise<number> {
  return prisma.execucaoSkill.count({ where: { accountId, ...WHERE_PENDENTE } });
}

// ---------------------------------------------------------------------------
// Pulso
// ---------------------------------------------------------------------------

export type EstadoDepartamento = InfoDepartamento & {
  /** Trabalhos concluídos desde `desde` (o período da tela). */
  entregas: number;
  estado: "ativo" | "parado";
  ultimaEm: Date | null;
  /** Trabalhos por dia nos últimos 7 dias (do mais antigo a hoje): o mini-gráfico do card. */
  semana: number[];
};

/** Dia (fuso de São Paulo) de uma data, para agrupar a semana. */
const chaveDiaSP = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" });

export async function pulso(accountId: string, desde = new Date(Date.now() - 7 * DIA_MS)): Promise<EstadoDepartamento[]> {
  const limite = new Date(Date.now() - 14 * DIA_MS);
  const where = {
    accountId,
    status: "CONCLUIDA" as const,
    departamento: { in: DEPARTAMENTOS_CENTRAL.map((d) => d.departamento) },
  };
  const topo = { ...where, execucaoPaiId: null, tipo: { not: "REVISOR" as const } };
  const agora = Date.now();
  const dias7 = Array.from({ length: 7 }, (_, i) => chaveDiaSP.format(new Date(agora - (6 - i) * DIA_MS)));
  const [ultimas, periodo, daSemana] = await Promise.all([
    prisma.execucaoSkill.groupBy({ by: ["departamento"], where, _max: { concluidaEm: true } }),
    // Trabalhos = execuções de topo (o pedido ou a leitura), sem contar skills filhas e revisores.
    prisma.execucaoSkill.groupBy({
      by: ["departamento"],
      where: { ...topo, concluidaEm: { gte: desde } },
      _count: { _all: true },
    }),
    prisma.execucaoSkill.findMany({
      where: { ...topo, concluidaEm: { gte: new Date(agora - 7 * DIA_MS) } },
      select: { departamento: true, concluidaEm: true },
    }),
  ]);
  return DEPARTAMENTOS_CENTRAL.map((d) => {
    const ultimaEm = ultimas.find((u) => u.departamento === d.departamento)?._max.concluidaEm ?? null;
    const entregas = periodo.find((u) => u.departamento === d.departamento)?._count._all ?? 0;
    const semana = dias7.map(
      (dia) => daSemana.filter((x) => x.departamento === d.departamento && x.concluidaEm && chaveDiaSP.format(x.concluidaEm) === dia).length,
    );
    return { ...d, ultimaEm, entregas, semana, estado: ultimaEm && ultimaEm >= limite ? "ativo" : "parado" };
  });
}

// ---------------------------------------------------------------------------
// Departamento
// ---------------------------------------------------------------------------

export type ResultadoDepartamento =
  | { tipo: "texto"; execucaoId: string; em: Date; frase: string; texto: string }
  | {
      tipo: "presenca";
      execucaoId: string;
      em: Date;
      frase: string;
      comparacao: ComparacaoVizinhos | null;
      insights: InsightRastro[];
    }
  | { tipo: "rotina"; execucaoId: string; em: Date; frase: string; insights: InsightRotina[] };

/** Texto final de uma SKILL: o do Revisor, quando ele concluiu; senão o da skill. */
export async function textosFinais(execs: Array<{ id: string; saida: string | null }>): Promise<Map<string, string>> {
  const revisores = await prisma.execucaoSkill.findMany({
    where: { execucaoPaiId: { in: execs.map((e) => e.id) }, tipo: "REVISOR", status: "CONCLUIDA" },
    select: { execucaoPaiId: true, saida: true },
  });
  const mapa = new Map<string, string>();
  for (const e of execs) {
    const rev = revisores.find((r) => r.execucaoPaiId === e.id)?.saida;
    mapa.set(e.id, rev || e.saida || "");
  }
  return mapa;
}

export async function ultimoResultado(
  accountId: string,
  info: InfoDepartamento,
): Promise<ResultadoDepartamento | null> {
  if (info.departamento === "PRESENCA") {
    const e = await prisma.execucaoSkill.findFirst({
      where: {
        accountId,
        chefe: info.chefe,
        status: "CONCLUIDA",
        acao: "compararVizinhos",
      },
      orderBy: { concluidaEm: "desc" },
      select: { id: true, saida: true, concluidaEm: true, criadaEm: true },
    });
    if (!e) return null;
    const s = lerJson<{ status: string; comparacao?: ComparacaoVizinhos; insights?: InsightRastro[] }>(e.saida);
    const em = e.concluidaEm ?? e.criadaEm;
    if (s?.status === "concluida") {
      const insights = s.insights ?? [];
      return {
        tipo: "presenca",
        execucaoId: e.id,
        em,
        frase: insights[0]?.titulo ?? "Comparação com os vizinhos pronta.",
        comparacao: s.comparacao ?? null,
        insights,
      };
    }
    const frase =
      s?.status === "nao_encontrado"
        ? "Não achamos o seu negócio no Google Maps."
        : s?.status === "sem_vizinhos"
          ? "Não achamos concorrentes por perto para comparar."
          : "Leitura feita.";
    return { tipo: "presenca", execucaoId: e.id, em, frase, comparacao: null, insights: [] };
  }

  if (info.departamento === "OPERACAO") {
    const e = await prisma.execucaoSkill.findFirst({
      where: {
        accountId,
        chefe: info.chefe,
        status: "CONCLUIDA",
        acao: "lerRotina",
      },
      orderBy: { concluidaEm: "desc" },
      select: { id: true, saida: true, concluidaEm: true, criadaEm: true },
    });
    if (!e) return null;
    const s = lerJson<{ status: string; insights?: InsightRotina[] }>(e.saida);
    const insights = s?.insights ?? [];
    const frase =
      s?.status === "sem_dados"
        ? "Ainda não há agendamentos suficientes para ler a rotina."
        : insights[0]?.titulo ?? "Leitura da rotina pronta.";
    return { tipo: "rotina", execucaoId: e.id, em: e.concluidaEm ?? e.criadaEm, frase, insights };
  }

  const e = await prisma.execucaoSkill.findFirst({
    where: { accountId, departamento: info.departamento, tipo: "SKILL", status: "CONCLUIDA" },
    orderBy: { concluidaEm: "desc" },
    select: { id: true, saida: true, concluidaEm: true, criadaEm: true },
  });
  if (!e) return null;
  const texto = (await textosFinais([e])).get(e.id) ?? "";
  return {
    tipo: "texto",
    execucaoId: e.id,
    em: e.concluidaEm ?? e.criadaEm,
    frase: primeiraFrase(texto) || "Resultado pronto.",
    texto,
  };
}

// ---------------------------------------------------------------------------
// Decisões
// ---------------------------------------------------------------------------

export type DecisaoPendente = {
  id: string;
  chefe: string;
  departamento: string;
  titulo: string;
  porQue: string;
  conteudo: string;
};

export async function decisoesPendentes(accountId: string, limite = 30): Promise<{
  itens: DecisaoPendente[];
  total: number;
}> {
  const [execs, total] = await Promise.all([
    prisma.execucaoSkill.findMany({
      where: { accountId, ...WHERE_PENDENTE },
      orderBy: { concluidaEm: "asc" },
      take: limite,
      select: {
        id: true,
        chefe: true,
        saida: true,
        titulo: true,
        execucaoPai: { select: { entrada: true } },
      },
    }),
    contarPendentes(accountId),
  ]);
  const textos = await textosFinais(execs);
  const itens = execs.map((e) => {
    const conteudo = textos.get(e.id) ?? "";
    const pedido = pedidoDaEntrada(e.execucaoPai?.entrada);
    return {
      id: e.id,
      chefe: e.chefe,
      departamento: departamentoPorChefe(e.chefe)?.nome ?? "",
      titulo: e.titulo || "Trabalho pronto",
      porQue: pedido ? `Você pediu: ${cortar(pedido, 140)}` : "",
      conteudo,
    };
  });
  return { itens, total };
}

// ---------------------------------------------------------------------------
// Linha do tempo
// ---------------------------------------------------------------------------

export type EventoLinha = {
  id: string;
  em: Date;
  chefe: string;
  linha: string;
  tipo: "resultado" | "decisao" | "marco";
  departamentoSlug: string | null;
  /** Decisões: qual foi (a linha do gráfico conta as aprovadas). */
  decisao?: "APROVADA" | "PASSADA" | "AJUSTAR";
  marco?: "publicado" | "venda" | "contrato";
  /** Link para a peça (ou para onde ela está). */
  href?: string | null;
};

const ROTULO_DECISAO = {
  APROVADA: "Você aprovou",
  PASSADA: "Você passou",
  AJUSTAR: "Você pediu ajuste",
} as const;

function linhaDeResultado(
  e: { chefe: string; tipo: string; entrada: unknown; saida: string | null; titulo: string | null },
  texto: string,
): string | null {
  if (e.tipo === "SKILL") return e.titulo || primeiraFrase(texto) || "Trabalho pronto.";
  const acao = acaoDaEntrada(e.entrada);
  if (e.chefe === "Norte" && acao === "acaoDaSemana") {
    const a = lerJson<AcaoDaSemana>(e.saida);
    return a?.titulo ? `Ação da semana: ${a.titulo}` : null;
  }
  if (acao === "lerRotina") {
    const s = lerJson<{ status: string; insights?: InsightRotina[] }>(e.saida);
    if (s?.status === "sem_dados") return "Leu a rotina: poucos agendamentos para tirar conclusão.";
    return s?.insights?.[0]?.titulo ?? "Leu a rotina.";
  }
  if (acao === "compararVizinhos") {
    const s = lerJson<{ status: string; insights?: InsightRastro[] }>(e.saida);
    if (s?.status === "nao_encontrado") return "Não achou o negócio no Google Maps.";
    if (s?.status === "sem_vizinhos") return "Não achou concorrentes por perto.";
    return s?.insights?.[0]?.titulo ?? "Comparou com os vizinhos no Google.";
  }
  return null;
}

export async function linhaDoTempo(accountId: string, limite = 80): Promise<EventoLinha[]> {
  const [concluidas, decididas] = await Promise.all([
    prisma.execucaoSkill.findMany({
      where: {
        accountId,
        status: "CONCLUIDA",
        OR: [
          { tipo: "SKILL" },
          { tipo: "CHEFE", acao: "acaoDaSemana" },
          { tipo: "CHEFE", acao: "lerRotina" },
          { tipo: "CHEFE", acao: "compararVizinhos" },
        ],
      },
      orderBy: { concluidaEm: "desc" },
      take: limite,
      select: { id: true, chefe: true, tipo: true, entrada: true, saida: true, titulo: true, concluidaEm: true, criadaEm: true },
    }),
    prisma.execucaoSkill.findMany({
      where: { accountId, decididaEm: { not: null }, decisao: { not: "PENDENTE" } },
      orderBy: { decididaEm: "desc" },
      take: limite,
      select: { id: true, chefe: true, tipo: true, saida: true, titulo: true, decisao: true, decididaEm: true },
    }),
  ]);

  const skills = concluidas.filter((e) => e.tipo === "SKILL");
  const textos = await textosFinais([...skills, ...decididas.filter((d) => d.tipo === "SKILL")]);

  let entregasPorOrigem: Map<string, { id: string; tipo: string; departamento: string }> | null = null;
  let pendentesIds: Set<string> | null = null;
  const eventos: EventoLinha[] = [];
  for (const e of concluidas) {
    const linha = linhaDeResultado(e, textos.get(e.id) ?? "");
    if (!linha) continue;
    eventos.push({
      id: `r-${e.id}`,
      em: e.concluidaEm ?? e.criadaEm,
      chefe: e.chefe,
      linha,
      tipo: "resultado",
      departamentoSlug: departamentoPorChefe(e.chefe)?.slug ?? null,
      href: await hrefDoTrabalho(e.id),
    });
  }
  for (const d of decididas) {
    if (!d.decididaEm || !d.decisao || d.decisao === "PENDENTE") continue;
    const sobre =
      d.tipo === "SKILL"
        ? d.titulo || primeiraFrase(textos.get(d.id), 100)
        : (lerJson<AcaoDaSemana>(d.saida)?.titulo ?? "");
    eventos.push({
      id: `d-${d.id}`,
      em: d.decididaEm,
      chefe: d.chefe,
      linha: sobre ? `${ROTULO_DECISAO[d.decisao]}: ${sobre}` : `${ROTULO_DECISAO[d.decisao]}.`,
      tipo: "decisao",
      decisao: d.decisao,
      departamentoSlug: departamentoPorChefe(d.chefe)?.slug ?? null,
      href: await hrefDoTrabalho(d.id),
    });
  }
  return eventos.sort((a, b) => b.em.getTime() - a.em.getTime()).slice(0, limite);

  // Para onde a peça foi: a entrega (estúdio ou Entregas); pendente, a pilha.
  async function hrefDoTrabalho(execId: string): Promise<string | null> {
    if (!entregasPorOrigem) {
      const ids = [...concluidas.map((x) => x.id), ...decididas.map((x) => x.id)];
      const ents = await prisma.entregaChefe.findMany({
        where: { accountId, execucaoOrigemId: { in: ids } },
        select: { id: true, tipo: true, departamento: true, execucaoOrigemId: true },
      });
      entregasPorOrigem = new Map(ents.map((x) => [x.execucaoOrigemId, x]));
      pendentesIds = new Set(
        [...concluidas, ...decididas].filter((x) => x.tipo === "SKILL").map((x) => x.id),
      );
      for (const d of decididas) pendentesIds.delete(d.id);
    }
    const ent = entregasPorOrigem.get(execId);
    if (ent) return ent.departamento === "REDES" ? hrefDaPeca({ id: ent.id, tipo: ent.tipo as TipoEntrega }, null) : `/central/entregas/${ent.id}`;
    if (pendentesIds?.has(execId)) return "/central/decisoes";
    return null;
  }
}

/**
 * Marcos da linha do tempo: post publicado (peça do estúdio com data de
 * publicação) e contrato fechado (o contrato do Negociador Trato aprovado
 * por você). Vendas não entram: a versão aberta não tem caixa próprio.
 */
export async function marcosLinha(accountId: string, desde: Date): Promise<EventoLinha[]> {
  const [publicadas, contratos] = await Promise.all([
    prisma.entregaChefe.findMany({
      where: { accountId, publicadaEm: { gte: desde } },
      select: { id: true, tipo: true, titulo: true, chefe: true, publicadaEm: true, rede: true },
      take: 200,
    }),
    prisma.execucaoSkill.findMany({
      where: {
        accountId,
        tipo: "SKILL",
        decisao: "APROVADA",
        decididaEm: { gte: desde },
        execucaoPai: { acao: "cardapio-contrato" },
      },
      select: { id: true, chefe: true, titulo: true, decididaEm: true },
      take: 100,
    }),
  ]);
  const ents = contratos.length
    ? await prisma.entregaChefe.findMany({
        where: { accountId, execucaoOrigemId: { in: contratos.map((c) => c.id) } },
        select: { id: true, execucaoOrigemId: true },
      })
    : [];
  const entDe = new Map(ents.map((e) => [e.execucaoOrigemId, e.id]));
  return [
    ...publicadas.map((p) => ({
      id: `p-${p.id}`,
      em: p.publicadaEm!,
      chefe: p.chefe,
      linha: `Publicado${p.rede ? ` no ${p.rede === "X" ? "X" : p.rede.charAt(0) + p.rede.slice(1).toLowerCase()}` : ""}: ${p.titulo}`,
      tipo: "marco" as const,
      marco: "publicado" as const,
      departamentoSlug: "redes",
      href: hrefDaPeca({ id: p.id, tipo: p.tipo as TipoEntrega }, null),
    })),
    ...contratos.map((c) => ({
      id: `c-${c.id}`,
      em: c.decididaEm!,
      chefe: c.chefe,
      linha: `Contrato fechado: ${c.titulo ?? "contrato aprovado"}`,
      tipo: "marco" as const,
      marco: "contrato" as const,
      departamentoSlug: "vendas",
      href: entDe.has(c.id) ? `/central/entregas/${entDe.get(c.id)}` : null,
    })),
  ];
}

// ---------------------------------------------------------------------------
// Status de um pedido em segundo plano
// ---------------------------------------------------------------------------

export type Ticket =
  | { tipo: "chefe"; execucaoId: string }
  | { tipo: "leitura"; chefe: string; desde: number };

export type StatusPedido =
  | { estado: "preparando" }
  /** `texto`/`execucaoId`: o trabalho pronto (pedido livre); leitura volta sem texto. */
  | { estado: "concluida"; texto?: string; execucaoId?: string }
  | { estado: "pergunta"; pergunta: string }
  | { estado: "outro_departamento" }
  /** `mensagem`: motivo que pode ir para o dono (chave, provedor, formato). */
  | { estado: "falhou"; mensagem?: string };

/** Falha com o motivo claro quando o erro gravado é de chave/provedor/formato. */
function falhou(erro: string | null | undefined): StatusPedido {
  if (!erro) return { estado: "falhou" };
  const m = mensagemParaDono(new Error(erro), "");
  return m ? { estado: "falhou", mensagem: m } : { estado: "falhou" };
}

function parado(e: { status: string; criadaEm: Date }): boolean {
  return (e.status === "NA_FILA" || e.status === "RODANDO") && Date.now() - e.criadaEm.getTime() > LIMITE_PREPARANDO_MS;
}

export async function statusPedido(accountId: string, ticket: Ticket): Promise<StatusPedido> {
  if (ticket.tipo === "leitura") {
    const e = await prisma.execucaoSkill.findFirst({
      where: {
        accountId,
        chefe: ticket.chefe,
        tipo: "CHEFE",
        acao: LEITURAS[ticket.chefe] ?? "",
        criadaEm: { gte: new Date(ticket.desde - 5_000) },
      },
      orderBy: { criadaEm: "desc" },
      select: { status: true, criadaEm: true, erro: true },
    });
    if (!e) return Date.now() - ticket.desde > LIMITE_PREPARANDO_MS ? { estado: "falhou" } : { estado: "preparando" };
    if (e.status === "CONCLUIDA") return { estado: "concluida" };
    if (e.status === "ERRO" || e.status === "RECUSADA" || parado(e)) return falhou(e.erro);
    return { estado: "preparando" };
  }

  const chefe = await prisma.execucaoSkill.findFirst({
    where: { id: ticket.execucaoId, accountId, tipo: "CHEFE" },
    select: { status: true, saida: true, criadaEm: true, erro: true },
  });
  if (!chefe) return { estado: "falhou" };
  if (chefe.status === "ERRO" || chefe.status === "RECUSADA" || parado(chefe)) return falhou(chefe.erro);
  if (chefe.status !== "CONCLUIDA") return { estado: "preparando" };

  const decisao = lerJson<{ acao?: string; pergunta?: string }>(chefe.saida);
  if (decisao?.acao === "perguntar") return { estado: "pergunta", pergunta: decisao.pergunta ?? "" };
  if (decisao?.acao === "outro_departamento") return { estado: "outro_departamento" };

  const skill = await prisma.execucaoSkill.findFirst({
    where: { execucaoPaiId: ticket.execucaoId, accountId, tipo: "SKILL" },
    select: {
      id: true,
      saida: true,
      status: true,
      criadaEm: true,
      concluidaEm: true,
      erro: true,
      filhas: { where: { tipo: "REVISOR" }, select: { status: true }, take: 1 },
    },
  });
  if (!skill) return { estado: "preparando" };
  if (skill.status === "ERRO" || skill.status === "RECUSADA" || parado(skill)) return falhou(skill.erro);
  if (skill.status !== "CONCLUIDA") return { estado: "preparando" };
  const revisor = skill.filhas[0];
  // O Revisor nasce logo depois da skill; espera uns segundos por ele.
  if (!revisor && Date.now() - (skill.concluidaEm?.getTime() ?? 0) < 10_000) return { estado: "preparando" };
  if (revisor && (revisor.status === "NA_FILA" || revisor.status === "RODANDO")) return { estado: "preparando" };
  const texto = (await textosFinais([{ id: skill.id, saida: skill.saida }])).get(skill.id);
  return { estado: "concluida", texto: texto ? texto.slice(0, 20_000) : undefined, execucaoId: skill.id };
}

// ---------------------------------------------------------------------------
// Painel: decisões com estado, entregas, atendimentos por dia
// ---------------------------------------------------------------------------

export type DecisaoComEstado = DecisaoPendente & {
  decisao: "PENDENTE" | "APROVADA" | "PASSADA" | "AJUSTAR";
  em: Date;
  fontes: Array<{ chefe: string; titulo: string }>;
  cadeia: Array<{ chefe: string; rotulo: string; quem: string }>;
  proxima: { chefe: string; rotulo: string } | null;
};

/** Trabalhos prontos dos chefes (pendentes e já decididos), mais novos primeiro. */
export async function todasDecisoes(accountId: string, limite = 60): Promise<DecisaoComEstado[]> {
  const execs = await prisma.execucaoSkill.findMany({
    where: { accountId, tipo: "SKILL", status: "CONCLUIDA", decisao: { not: null } },
    orderBy: { concluidaEm: "desc" },
    take: limite,
    select: {
      id: true,
      chefe: true,
      saida: true,
      titulo: true,
      decisao: true,
      concluidaEm: true,
      criadaEm: true,
      entrada: true,
      repositorio: true,
      skill: true,
      execucaoPai: { select: { entrada: true } },
    },
  });
  const textos = await textosFinais(execs);
  return execs.map((e) => {
    const acaoId = (e.execucaoPai?.entrada as { acao?: string } | null)?.acao ?? null;
    const prox = proximaDaExecucao(e.chefe, e.repositorio, e.skill, acaoId);
    const conteudo = textos.get(e.id) ?? "";
    const pedido = pedidoDaEntrada(e.execucaoPai?.entrada);
    return {
      id: e.id,
      chefe: e.chefe,
      departamento: departamentoPorChefe(e.chefe)?.nome ?? "",
      titulo: e.titulo || "Trabalho pronto",
      porQue: pedido ? `Você pediu: ${cortar(pedido, 140)}` : "",
      conteudo,
      decisao: e.decisao ?? "PENDENTE",
      em: e.concluidaEm ?? e.criadaEm,
      fontes: fontesDaEntrada(e.entrada).map((f) => ({ chefe: f.chefe, titulo: f.titulo })),
      cadeia: cadeiaDaEntrada(e.entrada).map((x) => ({ chefe: x.chefe, rotulo: semIdDeSkill(x.rotulo || nomeDaAcao(x.repositorio, x.skill)), quem: x.chefe })),
      proxima: prox ? { chefe: prox.chefe, rotulo: prox.acao.rotulo } : null,
    };
  });
}

export type Entrega = { id: string; titulo: string; em: Date; decisao: ExecucaoSkill["decisao"] };

/** Últimos trabalhos prontos de um departamento. */
export async function entregasDepartamento(accountId: string, info: InfoDepartamento, limite = 6): Promise<Entrega[]> {
  const execs = await prisma.execucaoSkill.findMany({
    where: { accountId, departamento: info.departamento, tipo: "SKILL", status: "CONCLUIDA" },
    orderBy: { concluidaEm: "desc" },
    take: limite,
    select: { id: true, saida: true, titulo: true, decisao: true, concluidaEm: true, criadaEm: true },
  });
  const textos = await textosFinais(execs);
  return execs.map((e) => ({
    id: e.id,
    titulo: e.titulo || primeiraFrase(textos.get(e.id), 90) || "Trabalho pronto",
    em: e.concluidaEm ?? e.criadaEm,
    decisao: e.decisao,
  }));
}

/** Já aprovou alguma coisa na Central (primeiro passo cumprido). */
export async function jaAprovou(accountId: string): Promise<boolean> {
  return (await prisma.execucaoSkill.count({ where: { accountId, decisao: "APROVADA" } })) > 0;
}

/**
 * Atendimentos por dia: vinham de uma agenda externa. A versão aberta guarda os
 * números por mês (numeros_mes), então não há série diária: null = sem série.
 */
export async function atendimentosPorDia(
  _accountId: string,
  _dias: number,
): Promise<{ dias: Array<{ data: string; total: number }>; total: number; anterior: number } | null> {
  return null;
}
