/**
 * Peças do estúdio de Redes: as entregas da Editora Pauta com etapa,
 * versões, comentários e o post vinculado. Tudo filtra pelo accountId da
 * sessão; ids vindos da tela só acham registros DENTRO da conta.
 */
import "server-only";

import type { EntregaChefe, Prisma } from "@/generated/prisma/client";
import { IDS_FONTE, type MarcaCarrossel } from "@/lib/central/carrossel";
import { cortar } from "@/lib/central/dados";
import { slidesDe } from "@/lib/central/entregas";
import { trabalhoDe, type StatusEntrega, type TipoEntrega, type TrabalhoView } from "@/lib/central/entregas-tipos";
import { destravarPresos } from "@/lib/central/producao-trabalho";
import { marcaDoCliente } from "@/lib/central/marca";
import type { SlideEstudio } from "@/lib/central/estudio/slide";
import { etapaDe, type PecaView, type VinculoPost } from "@/lib/central/estudio/tipos";
import { prisma } from "@/lib/prisma";

export function marcaDoConteudo(conteudo: unknown, padrao: MarcaCarrossel): MarcaCarrossel {
  const m = (conteudo as { marca?: Partial<MarcaCarrossel> } | null)?.marca;
  if (!m) return padrao;
  return {
    fundo: m.fundo ?? padrao.fundo,
    texto: m.texto ?? padrao.texto,
    destaque: m.destaque ?? padrao.destaque,
    fonte: m.fonte && IDS_FONTE.includes(m.fonte) ? m.fonte : padrao.fonte,
    formato: m.formato === "1x1" ? "1x1" : "4x5",
  };
}

export function vinculoDe(v: unknown): VinculoPost | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.rede !== "string") return null;
  return {
    rede: o.rede,
    id: o.id,
    link: typeof o.link === "string" ? o.link : null,
    data: typeof o.data === "string" ? o.data : null,
    texto: typeof o.texto === "string" ? o.texto : "",
    capa: typeof o.capa === "string" ? o.capa : null,
  };
}

// ---------------------------------------------------------------------------
// Versões
// ---------------------------------------------------------------------------

/**
 * Registra o que acabou de ser gerado como nova versão principal (v1 na
 * primeira geração, v2, v3… nas seguintes).
 */
export async function registrarGeracao(accountId: string, entregaId: string): Promise<void> {
  const e = await prisma.entregaChefe.findFirst({
    where: { id: entregaId, accountId, status: "PRONTA" },
    select: { id: true, conteudo: true, texto: true, _count: { select: { versoes: true } } },
  });
  if (!e) return;
  const numero = await proximoNumero(accountId, e.id);
  const v = await prisma.versaoEntrega.create({
    data: {
      accountId,
      entregaId: e.id,
      numero,
      origem: "GERACAO",
      descricao: numero === 1 ? "Primeira versão da Editora Pauta" : "Nova geração da Editora Pauta",
      conteudo: (e.conteudo ?? undefined) as Prisma.InputJsonValue | undefined,
      texto: e.texto,
    },
  });
  await prisma.entregaChefe.update({ where: { id: e.id, accountId }, data: { versaoPrincipalId: v.id } });
}

async function proximoNumero(accountId: string, entregaId: string): Promise<number> {
  const ultima = await prisma.versaoEntrega.findFirst({
    where: { entregaId, accountId },
    orderBy: { numero: "desc" },
    select: { numero: true },
  });
  return (ultima?.numero ?? 0) + 1;
}

/** Peças prontas de antes do estúdio ganham a v1 com o conteúdo atual. */
async function garantirVersaoInicial(accountId: string, entregas: EntregaChefe[]): Promise<void> {
  const sem = entregas.filter((e) => e.status === "PRONTA" && !e.versaoPrincipalId);
  for (const e of sem) {
    const existente = await prisma.versaoEntrega.findFirst({ where: { entregaId: e.id, accountId }, orderBy: { numero: "desc" } });
    const v =
      existente ??
      (await prisma.versaoEntrega.create({
        data: {
          accountId,
          entregaId: e.id,
          numero: 1,
          origem: "GERACAO",
          descricao: "Primeira versão da Editora Pauta",
          conteudo: (e.conteudo ?? undefined) as Prisma.InputJsonValue | undefined,
          texto: e.texto,
        },
      }));
    await prisma.entregaChefe.update({ where: { id: e.id, accountId }, data: { versaoPrincipalId: v.id } });
    e.versaoPrincipalId = v.id;
  }
}

export async function salvarNovaVersao(
  accountId: string,
  entregaId: string,
  dados: { descricao: string; conteudo?: Prisma.InputJsonValue; texto?: string | null; principal?: boolean },
): Promise<{ id: string; numero: number } | null> {
  const e = await prisma.entregaChefe.findFirst({ where: { id: entregaId, accountId }, select: { id: true } });
  if (!e) return null;
  // Duas gravações juntas: tenta o número seguinte de novo se colidir.
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const numero = await proximoNumero(accountId, e.id);
    try {
      const v = await prisma.versaoEntrega.create({
        data: {
          accountId,
          entregaId: e.id,
          numero,
          origem: "EDICAO",
          descricao: dados.descricao.slice(0, 160),
          conteudo: dados.conteudo,
          texto: dados.texto ?? null,
        },
      });
      if (dados.principal !== false) await tornarPrincipal(accountId, e.id, v.id);
      return { id: v.id, numero };
    } catch (err) {
      if ((err as { code?: string }).code !== "P2002") throw err;
    }
  }
  return null;
}

/** Faz da versão a principal: a entrega passa a ter o conteúdo dela. */
export async function tornarPrincipal(accountId: string, entregaId: string, versaoId: string): Promise<boolean> {
  const v = await prisma.versaoEntrega.findFirst({ where: { id: versaoId, entregaId, accountId } });
  if (!v) return false;
  await prisma.entregaChefe.updateMany({
    where: { id: entregaId, accountId },
    data: {
      versaoPrincipalId: v.id,
      conteudo: (v.conteudo ?? undefined) as Prisma.InputJsonValue | undefined,
      texto: v.texto,
    },
  });
  return true;
}

// ---------------------------------------------------------------------------
// Biblioteca
// ---------------------------------------------------------------------------

function pecaView(e: EntregaChefe & { _count: { versoes: number } }, marca: MarcaCarrossel): PecaView {
  const tipo = e.tipo as TipoEntrega;
  const slides = slidesDe(e.conteudo) as SlideEstudio[];
  const vinculo = vinculoDe(e.vinculo);
  return {
    id: e.id,
    tipo,
    rede: e.rede,
    titulo: e.titulo,
    etapa: etapaDe(e.etapa),
    producao: e.status as StatusEntrega,
    trabalho: trabalhoDe(e),
    versoes: e._count.versoes,
    em: e.criadaEm.toISOString(),
    programadaPara: e.programadaPara?.toISOString() ?? null,
    publicadaEm: e.publicadaEm?.toISOString() ?? null,
    capa: slides.length ? { slide: slides[0], total: slides.length, marca: marcaDoConteudo(e.conteudo, marca) } : null,
    resumo: cortar((e.texto ?? "").replace(/[#*_`>]+/g, " ").replace(/\s+/g, " "), 220),
    imagemPost: vinculo?.capa ?? null,
    vinculado: !!vinculo,
  };
}

export async function listarPecas(
  accountId: string,
  filtro: { tipos?: TipoEntrega[]; rede?: string | null; etapas?: string[]; comData?: boolean } = {},
  limite = 120,
): Promise<PecaView[]> {
  await destravarPresos(accountId);
  const linhas = await prisma.entregaChefe.findMany({
    where: {
      accountId,
      departamento: "REDES",
      ...(filtro.tipos ? { tipo: { in: filtro.tipos } } : {}),
      ...(filtro.rede ? { rede: filtro.rede } : {}),
      ...(filtro.etapas ? { etapa: { in: filtro.etapas } } : {}),
    },
    orderBy: { criadaEm: "desc" },
    take: limite,
    include: { _count: { select: { versoes: true } } },
  });
  await garantirVersaoInicial(accountId, linhas);
  const marca = await marcaDoCliente(accountId);
  return linhas.map((l) => pecaView({ ...l, _count: { versoes: Math.max(l._count.versoes, l.versaoPrincipalId ? 1 : 0) } }, marca));
}

// ---------------------------------------------------------------------------
// Peça aberta (visualizador)
// ---------------------------------------------------------------------------

export type VersaoView = {
  id: string;
  numero: number;
  descricao: string;
  origem: "GERACAO" | "EDICAO";
  em: string;
  principal: boolean;
  /** Carrossel: slides + marca. */
  conteudo: { slides: SlideEstudio[]; marca: MarcaCarrossel } | null;
  texto: string | null;
};

export type ComentarioPeca = {
  id: string;
  versaoId: string;
  slide: number;
  x: number;
  y: number;
  texto: string;
  autor: string;
  resolvido: boolean;
  em: string;
};

export type PecaDetalhe = {
  id: string;
  tipo: TipoEntrega;
  rede: string | null;
  titulo: string;
  descricao: string;
  /** Carrossel: a legenda. Outras peças: o texto da versão principal. */
  texto: string;
  etapa: PecaView["etapa"];
  producao: StatusEntrega;
  trabalho: TrabalhoView;
  erro: string | null;
  em: string;
  programadaPara: string | null;
  publicadaEm: string | null;
  vinculo: VinculoPost | null;
  versoes: VersaoView[];
  comentarios: ComentarioPeca[];
};

export async function obterPecaDetalhe(accountId: string, entregaId: string): Promise<PecaDetalhe | null> {
  await destravarPresos(accountId);
  const e = await prisma.entregaChefe.findFirst({
    where: { id: entregaId.slice(0, 64), accountId, departamento: "REDES" },
    include: { _count: { select: { versoes: true } } },
  });
  if (!e) return null;
  await garantirVersaoInicial(accountId, [e]);
  const [versoes, marca] = await Promise.all([
    prisma.versaoEntrega.findMany({
      where: { entregaId: e.id, accountId },
      orderBy: { numero: "desc" },
      include: { comentarios: { orderBy: { criadoEm: "asc" } } },
    }),
    marcaDoCliente(accountId),
  ]);
  return {
    id: e.id,
    tipo: e.tipo as TipoEntrega,
    rede: e.rede,
    titulo: e.titulo,
    descricao: e.descricao ?? "",
    texto: e.texto ?? "",
    etapa: etapaDe(e.etapa),
    producao: e.status as StatusEntrega,
    trabalho: trabalhoDe(e),
    erro: e.erro,
    em: e.criadaEm.toISOString(),
    programadaPara: e.programadaPara?.toISOString() ?? null,
    publicadaEm: e.publicadaEm?.toISOString() ?? null,
    vinculo: vinculoDe(e.vinculo),
    versoes: versoes.map((v) => {
      const slides = slidesDe(v.conteudo) as SlideEstudio[];
      return {
        id: v.id,
        numero: v.numero,
        descricao: v.descricao,
        origem: v.origem === "GERACAO" ? "GERACAO" : "EDICAO",
        em: v.criadaEm.toISOString(),
        principal: v.id === e.versaoPrincipalId,
        conteudo: slides.length ? { slides, marca: marcaDoConteudo(v.conteudo, marca) } : null,
        texto: v.texto,
      };
    }),
    comentarios: versoes.flatMap((v) =>
      v.comentarios.map((c) => ({
        id: c.id,
        versaoId: c.versaoId,
        slide: c.slide,
        x: c.x,
        y: c.y,
        texto: c.texto,
        autor: c.autor,
        resolvido: c.resolvido,
        em: c.criadoEm.toISOString(),
      })),
    ),
  };
}

/** Pautas prontas (posts, threads, textos) que podem servir de base para uma peça nova. */
export async function pautasBase(accountId: string): Promise<import("@/lib/central/estudio/nova-peca").PautaBase[]> {
  const linhas = await prisma.entregaChefe.findMany({
    where: { accountId, departamento: "REDES", status: "PRONTA", tipo: { in: ["POST", "THREAD", "TEXTO", "ROTEIRO"] } },
    orderBy: { criadaEm: "desc" },
    take: 30,
    select: { id: true, titulo: true, texto: true, rede: true },
  });
  return linhas.map((l) => ({
    id: l.id,
    titulo: l.titulo,
    rede: l.rede,
    resumo: cortar((l.texto ?? "").replace(/[#*_`>]+/g, " ").replace(/\s+/g, " "), 120),
  }));
}
