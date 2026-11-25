/**
 * Leitura das entregas (peças prontas) da Central. Tudo filtra pelo
 * accountId da sessão.
 */
import "server-only";

import type { Departamento, EntregaChefe } from "@/generated/prisma/client";
import { cortar } from "@/lib/central/dados";
import type {
  EntregaChefeView,
  FonteEntrega,
  SlideCarrossel,
  StatusEntrega,
  TipoEntrega,
} from "@/lib/central/entregas-tipos";
import { trabalhoDe } from "@/lib/central/entregas-tipos";
import { destravarPresos } from "@/lib/central/producao-trabalho";
import { cadeiaDaEntrada, proximaDaExecucao } from "@/lib/chefes/cardapio";
import { nomeDaAcao, semIdDeSkill } from "@/lib/central/nome-acao";
import { prisma } from "@/lib/prisma";

export function slidesDe(conteudo: unknown): SlideCarrossel[] {
  if (!conteudo || typeof conteudo !== "object") return [];
  const s = (conteudo as { slides?: unknown }).slides;
  return Array.isArray(s) ? (s as SlideCarrossel[]) : [];
}

export function fontesDe(f: unknown): FonteEntrega[] {
  return Array.isArray(f)
    ? f
        .filter((x): x is FonteEntrega => !!x && typeof x === "object" && typeof (x as FonteEntrega).chefe === "string")
        .map((x) => ({ chefe: x.chefe, titulo: String(x.titulo ?? "") }))
    : [];
}

export function entregaView(e: EntregaChefe): EntregaChefeView {
  const tipo = e.tipo as TipoEntrega;
  const slides = slidesDe(e.conteudo);
  const resumo =
    tipo === "CARROSSEL" && slides.length
      ? `${slides.length} slides · ${cortar(slides[0].titulo, 80)}`
      : cortar((e.texto ?? "").replace(/^-{3,}$/gm, " "), 140);
  return {
    id: e.id,
    tipo,
    rede: e.rede,
    chefe: e.chefe,
    titulo: e.titulo,
    status: e.status as StatusEntrega,
    erro: e.erro ? semIdDeSkill(e.erro) : null,
    trabalho: trabalhoDe(e),
    resumo,
    texto: tipo === "CARROSSEL" ? undefined : (e.texto ?? "").slice(0, 40_000) || undefined,
    em: e.criadaEm.toISOString(),
    fontes: fontesDe(e.fontes),
    origemId: e.execucaoOrigemId,
  };
}

export async function listarEntregas(
  accountId: string,
  filtro: { departamento?: Departamento; rede?: string } = {},
  limite = 24,
): Promise<EntregaChefeView[]> {
  await destravarPresos(accountId);
  const linhas = await prisma.entregaChefe.findMany({
    where: { accountId, ...(filtro.departamento ? { departamento: filtro.departamento } : {}), ...(filtro.rede ? { rede: filtro.rede } : {}) },
    orderBy: { criadaEm: "desc" },
    take: limite,
  });
  const views = linhas.map(entregaView);
  // Corrente e próximo passo vêm da execução aprovada que originou a peça.
  const origens = await prisma.execucaoSkill.findMany({
    where: { accountId, id: { in: linhas.map((l) => l.execucaoOrigemId) } },
    select: { id: true, chefe: true, repositorio: true, skill: true, entrada: true, execucaoPai: { select: { entrada: true } } },
  });
  const porId = new Map(origens.map((o) => [o.id, o]));
  return views.map((v) => {
    const o = v.origemId ? porId.get(v.origemId) : undefined;
    if (!o) return v;
    const prox = proximaDaExecucao(o.chefe, o.repositorio, o.skill, (o.execucaoPai?.entrada as { acao?: string } | null)?.acao ?? null);
    return {
      ...v,
      cadeia: cadeiaDaEntrada(o.entrada).map((x) => ({ chefe: x.chefe, rotulo: semIdDeSkill(x.rotulo || nomeDaAcao(x.repositorio, x.skill)), quem: x.chefe })),
      proxima: prox ? { chefe: prox.chefe, rotulo: prox.acao.rotulo } : null,
    };
  });
}

export async function obterEntrega(accountId: string, id: string): Promise<EntregaChefe | null> {
  await destravarPresos(accountId);
  return prisma.entregaChefe.findFirst({ where: { id: id.slice(0, 64), accountId } });
}
