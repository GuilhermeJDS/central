/**
 * Cada bloco da Central vem daqui: dado real quando a conta tem, senão o
 * exemplo (components/central/exemplo.ts). Tudo filtra pelo accountId da
 * sessão; sem conta, nada vai ao banco além da própria sessão.
 *
 * Toda conta vê os próprios dados, liberada ou não. Sem liberação (trial
 * vencido / sem plano pago) `travado` liga e os botões de gerar, aprovar e
 * pedir abrem "Escolha um plano para continuar". Sem conta: tudo em exemplo.
 */
import "server-only";

import { cache } from "react";

import { sessaoCentral } from "@/app/central/_lib/sessao";
import {
  ACOES_EXEMPLO,
  CEU_EXEMPLO,
  FICHA_EXEMPLO,
  NEGOCIO_EXEMPLO,
  PRIMEIRO_NOME_EXEMPLO,
  VIZINHOS_EXEMPLO,
  analiseExemplo,
  decisoesExemplo,
  entregasExemplo,
  linhaExemplo,
  numerosExemplo,
  pulsoExemplo,
  serieExemplo,
} from "@/components/central/exemplo";
import type {
  AcaoNorteView,
  AnaliseView,
  DecisaoView,
  EntregaView,
  EstadoDecisao,
  EventoView,
  FichaView,
  Fonte,
  NumeroView,
  Periodo,
  PulsoView,
  SerieView,
  VizinhosView,
} from "@/components/central/tipos";
import {
  acoesDaSemana,
  MAX_ACOES_SEMANA,
  atendimentosPorDia,
  ceuDaSemana,
  cortar,
  entregasDepartamento,
  linhaDoTempo,
  marcosLinha,
  pulso,
  todasDecisoes,
  ultimoResultado,
} from "@/lib/central/dados";
import { departamentoPorChefe, departamentoPorSlug, type InfoDepartamento } from "@/lib/central/departamentos";
import { calcularNumeros } from "@/lib/chefes/gerente-rotina";
import type { ComparacaoVizinhos } from "@/lib/chefes/inspetor-rastro";
import { obterFicha } from "@/lib/negocio/ficha";

const DIA_MS = 86_400_000;

const real = <T>(dado: T): Fonte<T> => ({ dado, exemplo: false });
const exemplo = <T>(dado: T): Fonte<T> => ({ dado, exemplo: true });

// ---------------------------------------------------------------------------
// Período
// ---------------------------------------------------------------------------

export function lerPeriodo(p: string | undefined): Periodo {
  return p === "14" ? 14 : p === "30" ? 30 : 7;
}

const fmtCurta = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
const fmtLonga = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "numeric", month: "long" });

/** Agora em ms (fora do corpo dos componentes, que precisam ser puros). */
export function agoraMs(): number {
  return Date.now();
}

/** Início do período em ms (para filtrar listas por data). */
export function inicioDoPeriodo(dias: Periodo): number {
  return Date.now() - dias * DIA_MS;
}

export function faixaPeriodo(dias: Periodo, agora = new Date()): string {
  return `${fmtCurta.format(new Date(agora.getTime() - (dias - 1) * DIA_MS))} a ${fmtCurta.format(agora)}`;
}

// ---------------------------------------------------------------------------
// Contexto (sessão + ficha)
// ---------------------------------------------------------------------------

export type ContextoCentral = {
  /** Conta da sessão (null sem conta: tudo em exemplo). Liberada ou não. */
  accountId: string | null;
  /** Conta da sessão, liberada ou não (Projetos e Contratar usam esta). */
  contaId: string | null;
  /** Sem trial vigente nem plano pago (ou sem conta): vê, mas não gera. */
  travado: boolean;
  primeiroNome: string;
  nomeNegocio: string;
  cidade: string;
  temFicha: boolean;
  admin: boolean;
  ficha: Fonte<FichaView>;
};

/** null = sem acesso (o layout já mostra o aviso). */
export const contexto = cache(async (): Promise<ContextoCentral | null> => {
  const s = await sessaoCentral();
  if (s.estado !== "ok") return null;
  const accountId = s.accountId;
  const f = accountId ? await obterFicha(accountId) : null;
  const ficha: Fonte<FichaView> = f
    ? real({
        nomeNegocio: f.nomeNegocio,
        cidade: f.cidade,
        oQueVende: f.oQueVende,
        paraQuem: f.paraQuem,
        objetivo: f.objetivo,
        objetivoOutro: f.objetivoOutro ?? "",
        instagram: f.instagram ?? "",
        site: f.site ?? "",
        google: f.google ?? "",
        youtube: f.youtube ?? "",
        linkedin: f.linkedin ?? "",
        x: f.x ?? "",
        comoFala: f.comoFala ?? "",
        naoQuer: f.naoQuer ?? "",
      })
    : exemplo(FICHA_EXEMPLO);
  return {
    accountId,
    contaId: s.accountId,
    // Admin sem conta própria vê o exemplo sem trava; os outros sem liberação veem o aviso de plano.
    travado: !s.liberado && !(s.admin && !s.accountId),
    primeiroNome: s.primeiroNome || PRIMEIRO_NOME_EXEMPLO,
    nomeNegocio: f?.nomeNegocio || s.nomeConta || NEGOCIO_EXEMPLO.nome,
    cidade: f?.cidade || (accountId ? "" : NEGOCIO_EXEMPLO.cidade),
    temFicha: !!f,
    admin: s.admin,
    ficha,
  };
});

// ---------------------------------------------------------------------------
// Início
// ---------------------------------------------------------------------------

export type NorteView = { acoes: AcaoNorteView[]; ceu: number; podeMais: boolean };

export async function blocoNorte(c: ContextoCentral): Promise<Fonte<NorteView>> {
  if (!c.accountId) return exemplo({ acoes: ACOES_EXEMPLO, ceu: CEU_EXEMPLO, podeMais: false });
  const [lista, ceu] = await Promise.all([acoesDaSemana(c.accountId), ceuDaSemana(c.accountId)]);
  if (!lista.length) return exemplo({ acoes: ACOES_EXEMPLO, ceu: CEU_EXEMPLO, podeMais: false });
  return real({
    ceu,
    podeMais: c.temFicha && lista.length < MAX_ACOES_SEMANA,
    acoes: lista.map((atual) => {
      const dep = departamentoPorChefe(atual.acao.chefe);
      return {
        execucaoId: atual.execucaoId,
        chefe: atual.acao.chefe,
        departamentoNome: dep?.nome ?? "Diretoria",
        slug: dep?.slug ?? null,
        titulo: atual.acao.titulo,
        porQue: atual.acao.porQue,
        decisao: atual.decisao,
        equipeFaz: atual.equipeFaz,
        fontes: atual.fontes,
      };
    }),
  });
}

function vizinhosDe(c: ComparacaoVizinhos): VizinhosView {
  return {
    voce: { nota: c.negocio.nota, avaliacoes: c.negocio.totalAvaliacoes },
    vizinhos: c.vizinhos.slice(0, 3).map((v, i) => ({ nome: `Vizinho ${i + 1}`, nota: v.nota, avaliacoes: v.totalAvaliacoes })),
  };
}

const presencaReal = cache(async (accountId: string) => {
  const info = departamentoPorSlug("presenca");
  return info ? ultimoResultado(accountId, info) : null;
});

export async function blocoVizinhos(c: ContextoCentral): Promise<Fonte<VizinhosView>> {
  if (!c.accountId) return exemplo(VIZINHOS_EXEMPLO);
  const r = await presencaReal(c.accountId);
  if (r?.tipo === "presenca" && r.comparacao && r.comparacao.vizinhos.length) return real(vizinhosDe(r.comparacao));
  return exemplo(VIZINHOS_EXEMPLO);
}

export async function blocoSerie(c: ContextoCentral, dias: Periodo): Promise<Fonte<SerieView>> {
  if (!c.accountId) return exemplo(serieExemplo(dias));
  const s = await atendimentosPorDia(c.accountId, dias);
  if (!s || (s.total === 0 && s.anterior === 0)) return exemplo(serieExemplo(dias));
  return real({ dias: s.dias, total: s.total, anterior: s.anterior || null });
}

const ESTADO: Record<string, EstadoDecisao> = {
  PENDENTE: "pendente",
  APROVADA: "aprovada",
  PASSADA: "passada",
  AJUSTAR: "ajuste",
};

/** Todas as decisões (pendentes primeiro). Compartilhado entre barra lateral e páginas. */
export const blocoDecisoes = cache(async (): Promise<Fonte<DecisaoView[]>> => {
  const c = await contexto();
  if (!c?.accountId) return exemplo(decisoesExemplo());
  const lista = await todasDecisoes(c.accountId);
  if (!lista.length) return exemplo(decisoesExemplo());
  return real(
    lista.map((d) => ({
      id: d.id,
      chefe: d.chefe,
      departamento: d.departamento,
      slug: departamentoPorChefe(d.chefe)?.slug ?? null,
      titulo: d.titulo,
      porQue: d.porQue,
      conteudo: d.conteudo,
      estado: ESTADO[d.decisao] ?? "pendente",
      em: d.em.toISOString(),
      fontes: d.fontes,
      cadeia: d.cadeia,
      proxima: d.proxima,
    })),
  );
});

export async function blocoPulso(c: ContextoCentral, dias: Periodo = 7): Promise<Fonte<PulsoView>> {
  if (!c.accountId) return exemplo(pulsoExemplo());
  const [estados, decisoes] = await Promise.all([pulso(c.accountId, new Date(inicioDoPeriodo(dias))), blocoDecisoes()]);
  if (!estados.some((e) => e.ultimaEm)) return exemplo(pulsoExemplo());
  const pend = decisoes.exemplo ? [] : decisoes.dado.filter((d) => d.estado === "pendente");
  return real(
    estados.map((e) => ({
      slug: e.slug,
      nome: e.nome,
      chefe: e.chefe,
      estado: e.estado,
      ultima: e.ultimaEm?.toISOString() ?? null,
      entregas: e.entregas,
      pendentes: pend.filter((d) => d.slug === e.slug).length,
      semana: e.semana,
    })),
  );
}

/** Dias de histórico que a Linha do tempo carrega (as setas andam dentro disso). */
export const DIAS_HISTORICO_LINHA = 120;

export async function blocoLinha(c: ContextoCentral): Promise<Fonte<EventoView[]>> {
  if (!c.accountId) return exemplo(linhaExemplo());
  const desde = new Date(Date.now() - DIAS_HISTORICO_LINHA * 86_400_000);
  const [eventos, marcos] = await Promise.all([linhaDoTempo(c.accountId, 800), marcosLinha(c.accountId, desde)]);
  const todos = [...eventos.filter((e) => e.em >= desde), ...marcos];
  if (!todos.length) return exemplo(linhaExemplo());
  return real(
    todos.map((e) => ({
      id: e.id,
      em: e.em.toISOString(),
      chefe: e.chefe,
      linha: e.linha,
      tipo: e.tipo,
      slug: departamentoPorChefe(e.chefe)?.slug ?? null,
      decisao: e.decisao,
      marco: e.marco,
      href: e.href ?? null,
    })),
  );
}

// ---------------------------------------------------------------------------
// Departamento
// ---------------------------------------------------------------------------

const fmtNota = (v: number | null) =>
  v === null ? "—" : v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function variacao(atual: number, antes: number | null): number | null {
  if (!antes) return null;
  return Math.round(((atual - antes) / antes) * 1000) / 10;
}

/** Linhas de lista ("- ", "1. ") de um markdown, sem marcas. */
function itensDeLista(texto: string, max = 3): string[] {
  return texto
    .split(/\r?\n/)
    .filter((l) => /^\s{0,3}([-*+]|\d+[.)])\s+/.test(l))
    .map((l) => cortar(l.replace(/^\s{0,3}([-*+]|\d+[.)])\s+/, "").replace(/[*_`~]+/g, ""), 140))
    .filter((l) => l.length > 2)
    .slice(0, max);
}

function semMarcas(texto: string): string {
  return texto
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+[.)])\s+/, "").replace(/[*_`~]+/g, "").trim())
    .filter((l) => l.length > 2 && !/^(```|---+)$/.test(l))
    .slice(1)
    .join(" ");
}

export async function blocoAnalise(
  c: ContextoCentral,
  info: InfoDepartamento,
  dias: Periodo,
): Promise<Fonte<AnaliseView>> {
  const periodoExemplo = faixaPeriodo(dias);
  if (!c.accountId) return exemplo(analiseExemplo(info.slug, periodoExemplo));
  const r = info.slug === "presenca" ? await presencaReal(c.accountId) : await ultimoResultado(c.accountId, info);
  if (!r) return exemplo(analiseExemplo(info.slug, periodoExemplo));

  const decisoes = await blocoDecisoes();
  const pendentes = decisoes.exemplo
    ? []
    : decisoes.dado.filter((d) => d.estado === "pendente" && d.slug === info.slug).map((d) => d.titulo).slice(0, 3);
  const periodo = `Leitura de ${fmtLonga.format(r.em)}`;

  if (r.tipo === "presenca" || r.tipo === "rotina") {
    const funcionando: string[] = [];
    if (r.tipo === "presenca" && r.comparacao) {
      const { negocio, mediaNotaVizinhos, mediaAvaliacoesVizinhos } = r.comparacao;
      if (negocio.nota !== null && mediaNotaVizinhos !== null && negocio.nota >= mediaNotaVizinhos)
        funcionando.push(`Nota ${fmtNota(negocio.nota)}, acima da média dos vizinhos (${fmtNota(mediaNotaVizinhos)}).`);
      if (negocio.totalAvaliacoes !== null && mediaAvaliacoesVizinhos !== null && negocio.totalAvaliacoes >= mediaAvaliacoesVizinhos)
        funcionando.push(`${negocio.totalAvaliacoes} avaliações, mais que a média dos vizinhos (${mediaAvaliacoesVizinhos}).`);
      if (negocio.temSite) funcionando.push("O perfil no Google leva para o seu site.");
    }
    return real({
      periodo,
      frase: r.frase,
      paragrafo: r.insights[0]?.porQuePesa ?? "",
      funcionando,
      fazer: r.insights.map((i) => i.oQueFazer).slice(0, 3),
      proximos: pendentes,
    });
  }

  return real({
    periodo,
    frase: r.frase,
    paragrafo: cortar(semMarcas(r.texto), 360),
    funcionando: [],
    fazer: itensDeLista(r.texto),
    proximos: pendentes,
    textoCompleto: r.texto,
  });
}

export async function blocoNumeros(
  c: ContextoCentral,
  info: InfoDepartamento,
  dias: Periodo,
): Promise<Fonte<NumeroView[]>> {
  if (!c.accountId) return exemplo(numerosExemplo(info.slug, dias));

  if (info.slug === "presenca") {
    const r = await presencaReal(c.accountId);
    if (r?.tipo === "presenca" && r.comparacao) {
      const { negocio, mediaNotaVizinhos, mediaAvaliacoesVizinhos, vizinhos } = r.comparacao;
      return real([
        {
          rotulo: "Nota no Google",
          valor: fmtNota(negocio.nota),
          variacao: negocio.nota !== null && mediaNotaVizinhos !== null ? variacao(negocio.nota, mediaNotaVizinhos) : null,
          base: `vizinhos: ${fmtNota(mediaNotaVizinhos)}`,
        },
        {
          rotulo: "Avaliações",
          valor: negocio.totalAvaliacoes === null ? "—" : negocio.totalAvaliacoes.toLocaleString("pt-BR"),
          variacao: negocio.totalAvaliacoes !== null ? variacao(negocio.totalAvaliacoes, mediaAvaliacoesVizinhos) : null,
          base: `vizinhos: ${mediaAvaliacoesVizinhos ?? "—"}`,
        },
        { rotulo: "Vizinhos comparados", valor: String(vizinhos.length), variacao: null, base: "no raio do Maps" },
        { rotulo: "Vizinhos com site", valor: String(r.comparacao.vizinhosComSite), variacao: null, base: negocio.temSite ? "você tem site" : "você ainda não tem" },
      ]);
    }
  }

  if (info.slug === "operacao") {
    const { numeros: n, agendamentos60, semUnidade } = await calcularNumeros(c.accountId);
    if (!semUnidade && agendamentos60 > 0) {
      const base = (v: number) => `30 dias antes: ${v.toLocaleString("pt-BR")}`;
      return real([
        { rotulo: "Atendimentos · 30 dias", valor: n.atendimentos30.toLocaleString("pt-BR"), variacao: variacao(n.atendimentos30, n.atendimentosAnteriores30), base: base(n.atendimentosAnteriores30) },
        { rotulo: "Faltas · 30 dias", valor: String(n.faltas30), variacao: variacao(n.faltas30, n.faltasAnteriores30), menosEMelhor: true, base: base(n.faltasAnteriores30) },
        { rotulo: "Cancelamentos · 30 dias", valor: String(n.cancelados30), variacao: variacao(n.cancelados30, n.canceladosAnteriores30), menosEMelhor: true, base: base(n.canceladosAnteriores30) },
        {
          rotulo: "Receita do mês",
          valor: `R$ ${Math.round(n.receitaMesAtual).toLocaleString("pt-BR")}`,
          variacao: variacao(n.receitaMesAtual, n.receitaMesAnteriorMesmoPeriodo),
          base: `mesmo período antes: R$ ${Math.round(n.receitaMesAnteriorMesmoPeriodo).toLocaleString("pt-BR")}`,
        },
      ]);
    }
  }

  return exemplo(numerosExemplo(info.slug, dias));
}

export async function blocoEntregas(c: ContextoCentral, info: InfoDepartamento): Promise<Fonte<EntregaView[]>> {
  if (!c.accountId) return exemplo(entregasExemplo(info.slug));
  const lista = await entregasDepartamento(c.accountId, info);
  if (!lista.length) return exemplo(entregasExemplo(info.slug));
  return real(
    lista.map((e) => ({
      id: e.id,
      titulo: e.titulo,
      tipo: "Entrega",
      em: e.em.toISOString(),
      estado: e.decisao ? (ESTADO[e.decisao] ?? "pronto") : "pronto",
    })),
  );
}
