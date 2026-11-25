/**
 * Decisão aprovada vira entrega pronta. Ao aprovar no Tinder (Decisões), o
 * chefe produz a peça final a partir do trabalho aprovado e ela cai em
 * "Entregas" do departamento:
 *   - carrossel → slides (texto + sugestão de imagem) para o Editor de carrossel;
 *   - roteiro, post, thread, títulos, thumbnail → a peça em texto, pronta.
 *
 * Roda em segundo plano, pela fila da conta (lib/central/fila), com a chave
 * do cliente, no modelo escolhido para aquele chefe. Cada tentativa fica registrada como execução PRODUCAO
 * (filha da decisão aprovada), com tokens e custo.
 *
 * SEGURANÇA: accountId sempre da sessão (quem chama passa o de contaCentral).
 */
import "server-only";

import { z } from "zod";

import type { Departamento, Prisma } from "@/generated/prisma/client";
import { chamarModelo, extrairJson, mensagemDeErro, mensagemParaDono, usoDe } from "@/lib/chefes/chamar-modelo";
import { fontesDaEntrada } from "@/lib/central/ligacoes";
import { resumirFicha } from "@/lib/chefes/motor";
import { obterFicha } from "@/lib/negocio/ficha";
import { registrarGeracao } from "@/lib/central/estudio/pecas";
import { prisma } from "@/lib/prisma";
import { concluirExecucao, criarExecucao, falharExecucao, marcarRodando } from "@/lib/skills/execucoes";
import {
  ROTULO_TIPO,
  type EtapaProducao,
  type SlideCarrossel,
  type TipoEntrega,
} from "@/lib/central/entregas-tipos";
import { FilaCheia, filaCentral } from "@/lib/central/fila";
import { destravarPresos, PRAZO_FILA_MS, PRAZO_TRABALHO_MS, TIMEOUT_PRODUCAO_MS } from "@/lib/central/producao-trabalho";
import { emSegundoPlano } from "@/lib/central/segundo-plano";

const MAX_TOKENS_PRODUCAO = 6000;


// ---------------------------------------------------------------------------
// Que peça cada skill vira
// ---------------------------------------------------------------------------

const TIPO_DA_SKILL: Record<string, TipoEntrega> = {
  carrossel: "CARROSSEL",
  "roteiro-curto": "ROTEIRO",
  "roteiro-youtube": "ROTEIRO",
  stories: "ROTEIRO",
  legenda: "POST",
  reaproveitar: "POST",
  "titulo-e-capa": "TITULO",
};

const REDE_DO_REPOSITORIO: Record<string, string> = {
  instagram: "INSTAGRAM",
  youtube: "YOUTUBE",
  linkedin: "LINKEDIN",
  x: "X",
  tiktok: "TIKTOK",
};

const formatoSchema = z.enum(["CARROSSEL", "ROTEIRO", "POST", "THREAD", "TITULO", "THUMBNAIL", "TEXTO"]);

/** A área da rede pode fixar o formato e a rede no pedido (ex.: thumbnail, TikTok). */
function lerPedidoDireto(entrada: unknown): { formato: TipoEntrega | null; rede: string | null } {
  if (!entrada || typeof entrada !== "object") return { formato: null, rede: null };
  const e = entrada as { formato?: unknown; rede?: unknown };
  const f = formatoSchema.safeParse(e.formato);
  return { formato: f.success ? f.data : null, rede: typeof e.rede === "string" ? e.rede : null };
}

export function tipoDaEntrega(skill: string | null, entradaPai: unknown): TipoEntrega {
  return lerPedidoDireto(entradaPai).formato ?? (skill ? TIPO_DA_SKILL[skill] : undefined) ?? "TEXTO";
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

const COMO_ENTREGAR: Record<TipoEntrega, string> = {
  CARROSSEL: [
    "Entregue o carrossel final, de 5 a 9 slides: o primeiro é a capa que faz deslizar, o último chama para a ação.",
    "Cada slide tem um título curto (até 8 palavras) e um texto de apoio (até 30 palavras).",
    'Em "imagem", descreva em poucas palavras a foto que combina com o slide (ex.: "close de tesoura cortando cabelo").',
    'Responda SÓ com JSON: {"titulo":"","legenda":"","slides":[{"titulo":"","texto":"","imagem":""}]}',
  ].join("\n"),
  ROTEIRO: "Entregue o roteiro final pronto para gravar: gancho dos 3 primeiros segundos, falas em ordem, texto na tela entre colchetes e a chamada final.",
  POST: "Entregue o post final pronto para colar: texto com quebras de linha, sem explicar o que fez, e no fim as hashtags (se a rede usar).",
  THREAD: "Entregue a thread final: cada post separado por uma linha só com ---, o primeiro é o gancho, até 280 caracteres por post.",
  TITULO: "Entregue 5 títulos prontos, um por linha, o melhor primeiro. Depois uma linha só com --- e o texto curto da thumbnail para o melhor título.",
  THUMBNAIL: "Entregue 3 ideias de thumbnail, cada uma com: texto na imagem (até 4 palavras), o que aparece na foto e as cores. Separe as ideias com uma linha só com ---.",
  TEXTO: "Entregue a versão final, pronta para usar como está (copiar e mandar), sem explicar o que fez.",
};

function promptProducao(chefe: string, tipo: TipoEntrega, slides?: number | null): string {
  const como =
    tipo === "CARROSSEL" && slides
      ? COMO_ENTREGAR.CARROSSEL.replace("de 5 a 9 slides", `com exatamente ${slides} slides`)
      : COMO_ENTREGAR[tipo];
  return [
    `Você é ${chefe}, da equipe de um pequeno negócio brasileiro. O dono aprovou o trabalho abaixo.`,
    `Agora produza a peça final (${ROTULO_TIPO[tipo].toLowerCase()}), pronta para publicar ou usar, em português do Brasil.`,
    "Use o jeito de falar do dono quando ele for informado. Não invente números, preços nem promessas que não estejam no trabalho ou na ficha.",
    "Nada de markdown pesado: sem títulos com #, sem tabelas.",
    "",
    como,
  ].join("\n");
}

const carrosselSchema = z.object({
  titulo: z.string().default(""),
  legenda: z.string().default(""),
  slides: z
    .array(z.object({ titulo: z.string().default(""), texto: z.string().default(""), imagem: z.string().default("") }))
    .min(2)
    .max(12),
});

// ---------------------------------------------------------------------------
// Agendar e produzir
// ---------------------------------------------------------------------------

export type EntregaAgendada = { id: string; tipo: TipoEntrega; departamento: Departamento; chefe: string };

/**
 * Cria (ou reabre) a entrega da decisão aprovada e agenda a produção.
 * Devolve null se a execução não é uma SKILL aprovada desta conta.
 */
export async function agendarProducao(accountId: string, execucaoOrigemId: string): Promise<EntregaAgendada | null> {
  const origem = await prisma.execucaoSkill.findFirst({
    where: { id: execucaoOrigemId, accountId, tipo: "SKILL", decisao: "APROVADA" },
    select: {
      id: true,
      chefe: true,
      departamento: true,
      repositorio: true,
      skill: true,
      titulo: true,
      entrada: true,
      execucaoPai: { select: { entrada: true } },
    },
  });
  if (!origem) return null;
  // Departamentos conectados: a peça herda de onde veio o insumo.
  const fontes = fontesDaEntrada(origem.entrada).map((f) => ({ chefe: f.chefe, titulo: f.titulo }));
  const tipo = tipoDaEntrega(origem.skill, origem.execucaoPai?.entrada);
  const rede =
    lerPedidoDireto(origem.execucaoPai?.entrada).rede ??
    (origem.repositorio ? (REDE_DO_REPOSITORIO[origem.repositorio] ?? null) : null);
  const titulo = (origem.titulo || ROTULO_TIPO[tipo]).slice(0, 160);

  const entrega = await prisma.entregaChefe.upsert({
    where: { execucaoOrigemId: origem.id },
    create: {
      accountId,
      departamento: origem.departamento,
      chefe: origem.chefe,
      execucaoOrigemId: origem.id,
      tipo,
      rede,
      titulo,
      fontes,
      ...naFila(),
    },
    update: naFila(),
    select: { id: true, accountId: true },
  });
  if (entrega.accountId !== accountId) return null;

  agendar(accountId, entrega.id);
  return { id: entrega.id, tipo, departamento: origem.departamento, chefe: origem.chefe };
}

/** Erro com motivo já escrito para o dono (vai direto para o card). */
class ErroProducao extends Error {}

function motivoParaDono(e: unknown): string {
  if (e instanceof ErroProducao || e instanceof FilaCheia) return e.message;
  const m = mensagemDeErro(e);
  if (/cortada/i.test(m))
    return "O modelo parou no meio da peça (limite de tamanho). Tente de novo ou escolha um modelo maior em Conexões.";
  if (/sem texto/i.test(m)) return "O modelo respondeu vazio. Tente de novo.";
  return mensagemParaDono(e, "Não deu para produzir agora. Tente de novo.");
}

/**
 * Campos de um trabalho que acabou de entrar na fila. O prazo cobre a espera
 * na fila; ao começar de verdade, produzir() troca pelo prazo do trabalho.
 */
export function naFila() {
  return {
    status: "NA_FILA",
    erro: null,
    producaoEtapa: null,
    producaoInicio: new Date(),
    producaoPrazo: new Date(Date.now() + PRAZO_FILA_MS + PRAZO_TRABALHO_MS),
  } as const;
}

/**
 * Põe o trabalho na fila da conta (limite por conta + global) e roda depois
 * da resposta; qualquer falha vira ERRO no card.
 */
export function agendar(accountId: string, entregaId: string): void {
  emSegundoPlano(async () => {
    try {
      await filaCentral.entrar(accountId, () => produzir(accountId, entregaId));
    } catch (e) {
      console.error(`[producao] falhou fora do trabalho: ${mensagemDeErro(e)}`);
      await prisma.entregaChefe
        .updateMany({
          where: { id: entregaId, accountId, status: { in: ["NA_FILA", "PRODUZINDO"] } },
          data: { status: "ERRO", producaoEtapa: null, erro: motivoParaDono(e) },
        })
        .catch(() => {});
    }
  });
}

/** Texto final da decisão: o do Revisor, se concluiu; senão o da skill. */
async function textoAprovado(accountId: string, execucaoId: string): Promise<string> {
  const e = await prisma.execucaoSkill.findFirst({
    where: { id: execucaoId, accountId },
    select: { saida: true, filhas: { where: { tipo: "REVISOR", status: "CONCLUIDA" }, select: { saida: true }, take: 1 } },
  });
  return e?.filhas[0]?.saida || e?.saida || "";
}

async function produzir(accountId: string, entregaId: string): Promise<void> {
  const entrega = await prisma.entregaChefe.findFirst({ where: { id: entregaId, accountId } });
  if (!entrega || !["NA_FILA", "PRODUZINDO"].includes(entrega.status)) return;
  const tipo = formatoSchema.catch("TEXTO").parse(entrega.tipo);
  let execId: string | null = null;

  // Só o trabalho mais recente escreve (um "Tentar de novo" troca o execucaoId).
  const etapa = (producaoEtapa: EtapaProducao) =>
    prisma.entregaChefe.updateMany({
      where: { id: entregaId, accountId, ...(execId ? { execucaoId: execId } : {}) },
      data: { status: "PRODUZINDO", producaoEtapa },
    });

  try {
    // A decisão de origem pode não existir mais (ou nunca ter existido, como
    // nas peças de exemplo): sem ela a execução nasce sem pai, em vez de
    // estourar a chave estrangeira e deixar o card preso em "Produzindo…".
    const origem = await prisma.execucaoSkill.findFirst({
      where: { id: entrega.execucaoOrigemId, accountId },
      select: { id: true },
    });
    const exec = await criarExecucao({
      accountId,
      departamento: entrega.departamento,
      chefe: entrega.chefe,
      tipo: "PRODUCAO",
      skill: `producao-${tipo.toLowerCase()}`,
      execucaoPaiId: origem?.id ?? null,
      entrada: { entregaId, tipo },
    });
    execId = exec.id;
    await prisma.entregaChefe.updateMany({
      where: { id: entregaId, accountId },
      data: {
        execucaoId: exec.id,
        status: "PRODUZINDO",
        producaoEtapa: "LENDO",
        producaoPrazo: new Date(Date.now() + PRAZO_TRABALHO_MS),
      },
    });

    await marcarRodando(accountId, exec.id);
    const [ficha, aprovado] = await Promise.all([
      obterFicha(accountId),
      origem ? textoAprovado(accountId, origem.id) : Promise.resolve(entregaComoTexto(entrega)),
    ]);
    if (!aprovado.trim()) throw new ErroProducao("O trabalho aprovado está vazio. Tente de novo a partir da decisão.");
    const mensagem = [
      ficha ? `<ficha>\n${resumirFicha(ficha)}\n</ficha>` : "",
      ficha?.comoFala ? `<como_o_dono_fala>\n${ficha.comoFala}\n</como_o_dono_fala>` : "",
      "<trabalho_aprovado>",
      aprovado.slice(0, 14_000),
      "</trabalho_aprovado>",
    ]
      .filter(Boolean)
      .join("\n");

    await etapa("ESCREVENDO");
    const pedido = pedidoDe(entrega.conteudo);
    const r = await chamarModelo(accountId, promptProducao(entrega.chefe, tipo, pedido?.slides), mensagem, {
      maxTokens: MAX_TOKENS_PRODUCAO,
      timeoutMs: TIMEOUT_PRODUCAO_MS,
      chefe: entrega.chefe,
    });

    await etapa("MONTANDO");
    let dados: Prisma.EntregaChefeUpdateManyMutationInput;
    if (tipo === "CARROSSEL") {
      let json: unknown = null;
      try {
        json = extrairJson(r.texto);
      } catch {
        /* cai no erro abaixo */
      }
      const c = carrosselSchema.safeParse(json);
      if (!c.success)
        throw new ErroProducao(
          "O modelo não devolveu os slides no formato certo. Tente de novo.",
        );
      const slides: SlideCarrossel[] = c.data.slides.map((sl, i) => ({
        id: `s${i + 1}`,
        titulo: sl.titulo.trim(),
        texto: sl.texto.trim(),
        imagem: null,
        imagemDica: sl.imagem.trim(),
      }));
      dados = {
        titulo: (c.data.titulo.trim() || entrega.titulo).slice(0, 160),
        texto: c.data.legenda.trim() || null,
        conteudo: { ...(objeto(entrega.conteudo) ?? {}), slides } as unknown as Prisma.InputJsonValue,
      };
    } else {
      if (!r.texto.trim()) throw new ErroProducao("O modelo devolveu a peça vazia. Tente de novo.");
      dados = { texto: r.texto.trim() };
    }

    await etapa("SALVANDO");
    const { count } = await prisma.entregaChefe.updateMany({
      where: { id: entregaId, accountId, execucaoId: exec.id },
      data: { ...dados, status: "PRONTA", erro: null, producaoEtapa: null, producaoPrazo: null },
    });
    // Estúdio: cada geração vira uma versão (v1, v2…) e passa a ser a principal.
    if (count) await registrarGeracao(accountId, entregaId);
    await concluirExecucao(accountId, exec.id, { saida: r.texto, ...usoDe(r) });
  } catch (e) {
    const mensagemTecnica = mensagemDeErro(e);
    console.error(`[producao] ${entregaId}: ${mensagemTecnica}`);
    if (execId) await falharExecucao(accountId, execId, mensagemTecnica).catch(() => {});
    await prisma.entregaChefe.updateMany({
      where: { id: entregaId, accountId, ...(execId ? { execucaoId: execId } : {}) },
      data: {
        status: "ERRO",
        producaoEtapa: null,
        producaoPrazo: null,
        erro: motivoParaDono(e),
      },
    });
  }
}

/** Pedido de uma peça criada direto no estúdio ("Novo carrossel"). */
type PedidoNovo = { tema: string; slides: number | null; base: string | null };

function pedidoDe(conteudo: unknown): PedidoNovo | null {
  const p = objeto(objeto(conteudo)?.pedido);
  if (!p) return null;
  return {
    tema: typeof p.tema === "string" ? p.tema : "",
    slides: typeof p.slides === "number" ? p.slides : null,
    base: typeof p.base === "string" ? p.base : null,
  };
}

function objeto(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/** Sem decisão de origem: a própria peça (texto ou slides) é o ponto de partida. */
function entregaComoTexto(e: { titulo: string; texto: string | null; conteudo: unknown; descricao: string | null }): string {
  const pedido = pedidoDe(e.conteudo);
  if (pedido)
    return [
      `O dono pediu uma peça nova sobre este tema: ${pedido.tema}`,
      pedido.base ? `\nPartindo desta pauta já aprovada:\n${pedido.base}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  const slides = (objeto(e.conteudo)?.slides as Array<{ titulo?: string; texto?: string }> | undefined) ?? [];
  return [
    `Tema: ${e.titulo}`,
    e.descricao ?? "",
    e.texto ?? "",
    ...slides.map((sl, i) => `Slide ${i + 1}: ${sl.titulo ?? ""} — ${sl.texto ?? ""}`),
  ]
    .filter(Boolean)
    .join("\n");
}

// ---------------------------------------------------------------------------
// Peça nova direto no estúdio (sem passar pelas Decisões)
// ---------------------------------------------------------------------------

export type NovaPeca = {
  tipo: TipoEntrega;
  rede: string;
  tema: string;
  /** Carrossel: quantos slides. */
  slides?: number | null;
  /** Texto da pauta escolhida como ponto de partida. */
  base?: string | null;
  baseTitulo?: string | null;
};

/** Cria a peça já em "Em revisão" e põe o trabalho de produção na fila. */
export async function criarPecaNova(accountId: string, n: NovaPeca): Promise<{ id: string }> {
  const tema = n.tema.trim();
  const titulo = (tema || n.baseTitulo || ROTULO_TIPO[n.tipo]).replace(/\s+/g, " ").slice(0, 160);
  const entrega = await prisma.entregaChefe.create({
    data: {
      accountId,
      departamento: "REDES",
      chefe: "Editora Pauta",
      // Sem decisão de origem: a peça nasce do pedido (id próprio, único).
      execucaoOrigemId: `novo-${crypto.randomUUID()}`,
      tipo: n.tipo,
      rede: n.rede,
      titulo,
      descricao: tema ? tema.slice(0, 400) : null,
      etapa: "EM_REVISAO",
      fontes: n.baseTitulo ? [{ chefe: "Editora Pauta", titulo: n.baseTitulo.slice(0, 160) }] : [],
      conteudo: {
        pedido: { tema: tema || n.baseTitulo || "", slides: n.slides ?? null, base: n.base?.slice(0, 8000) ?? null },
      } as Prisma.InputJsonValue,
      ...naFila(),
    },
    select: { id: true },
  });
  agendar(accountId, entrega.id);
  return entrega;
}

/** "Tentar de novo" numa entrega com erro. */
export async function reproduzirEntrega(accountId: string, entregaId: string): Promise<boolean> {
  await destravarPresos(accountId);
  const { count } = await prisma.entregaChefe.updateMany({
    where: { id: entregaId, accountId, status: { in: ["ERRO", "PRONTA"] } },
    data: { ...naFila(), execucaoId: null },
  });
  if (!count) return false;
  agendar(accountId, entregaId);
  return true;
}
