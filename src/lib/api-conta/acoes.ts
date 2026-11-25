import "server-only";

/**
 * As ações da API da conta. Uma lista só, servida de dois jeitos:
 * REST em /api/conta/v1 e ferramentas MCP em /api/conta/mcp, com os mesmos
 * nomes e parâmetros. O accountId vem SEMPRE da chave; ids recebidos só
 * acham registros dentro da conta.
 */
import { z } from "zod";

import type { ChaveConta } from "@/generated/prisma/client";
import { decidirExecucao } from "@/lib/central/decidir";
import { decisoesPendentes, statusPedido } from "@/lib/central/dados";
import { DEPARTAMENTOS_CENTRAL, departamentoPorSlug } from "@/lib/central/departamentos";
import { codificarTicket, decodificarTicket, dispararChefe } from "@/lib/central/disparar";
import { entregaView, listarEntregas, obterEntrega } from "@/lib/central/entregas";
import { lerMes, listarExecucoes, totaisDoMes } from "@/lib/central/execucoes-painel";
import { centralLiberada, podeGerarChefes } from "@/lib/central/liberacao";
import { prisma } from "@/lib/prisma";

import { escoposDe, type EscopoConta } from "./escopos";
import { envioAgenteSchema, gravarDoAgente } from "@/lib/redes/visao";

const numero = z.coerce.number().int().nonnegative().optional();
const numerosSchema = z.object({
  mes: z.string().regex(/^\d{4}-\d{2}$/, "mes no formato AAAA-MM"),
  /** Faturamento em reais (ex.: 18450.90). */
  receita: z.coerce.number().nonnegative().optional(),
  atendimentos: numero,
  cancelados: numero,
  faltas: numero,
  clientesAtivos: numero,
  clientesNovos: numero,
  clientesSumidos: numero,
  ateDia: z.coerce.number().int().min(1).max(31).optional(),
});

export class ErroConta extends Error {
  constructor(
    readonly status: number,
    readonly codigo: string,
    mensagem: string,
  ) {
    super(mensagem);
  }
}

export type ContextoConta = { accountId: string; chave: ChaveConta };

export type AcaoConta = {
  nome: string;
  descricao: string;
  /** "livre": qualquer chave válida. */
  escopo: EscopoConta | "livre";
  metodo: "GET" | "POST";
  /** Caminho depois de /api/conta/v1; `{id}` vira parâmetro. */
  caminho: string;
  /** Chama o modelo (conta no limite de pesadas). */
  pesada?: boolean;
  entrada: z.ZodObject;
  executar: (ctx: ContextoConta, args: Record<string, unknown>) => Promise<unknown>;
};

const SLUGS = DEPARTAMENTOS_CENTRAL.map((d) => d.slug) as [string, ...string[]];

async function exigirLiberada(accountId: string) {
  if (!(await centralLiberada(accountId)))
    throw new ErroConta(402, "plano_necessario", "Escolha um plano para continuar: o teste da conta acabou.");
}

async function exigirGeracao(accountId: string) {
  await exigirLiberada(accountId);
  if (!(await podeGerarChefes(accountId, { liberado: true })))
    throw new ErroConta(409, "sem_chave_ia", "Conecte a chave de IA da conta em Conexões antes de pedir aos chefes.");
}

const DECISAO: Record<string, "APROVADA" | "PASSADA" | "AJUSTAR"> = {
  aprovar: "APROVADA",
  passar: "PASSADA",
  ajustar: "AJUSTAR",
};

export const ACOES_CONTA: AcaoConta[] = [
  {
    nome: "ler_conta",
    descricao: "Nome da conta, nome e escopos desta chave e a lista de ações que ela alcança. Comece por aqui.",
    escopo: "livre",
    metodo: "GET",
    caminho: "/",
    entrada: z.object({}),
    async executar({ accountId, chave }) {
      const conta = await prisma.account.findUnique({
        where: { id: accountId },
        select: { nome: true, fichaNegocio: { select: { nomeNegocio: true } } },
      });
      return {
        conta: conta?.fichaNegocio?.nomeNegocio || conta?.nome || null,
        chave: { nome: chave.nome, escopos: escoposDe(chave) },
        acoes: ACOES_CONTA.filter((a) => a.escopo === "livre" || escoposDe(chave).includes(a.escopo as EscopoConta)).map((a) => ({
          nome: a.nome,
          metodo: a.metodo,
          caminho: a.caminho,
          descricao: a.descricao,
        })),
      };
    },
  },
  {
    nome: "listar_decisoes",
    descricao: "Entregas dos chefes esperando a sua resposta (aprovar, passar ou ajustar), das mais antigas para as mais novas.",
    escopo: "leitura",
    metodo: "GET",
    caminho: "/decisoes",
    entrada: z.object({ limite: z.coerce.number().int().min(1).max(50).optional() }),
    async executar({ accountId }, a) {
      const { itens, total } = await decisoesPendentes(accountId, (a.limite as number | undefined) ?? 20);
      return { total, decisoes: itens };
    },
  },
  {
    nome: "decidir",
    descricao:
      "Responde uma decisão pendente pelo id: aprovar (o chefe produz a peça final), passar, ou ajustar com o que mudar (o chefe refaz; usa a chave de IA).",
    escopo: "decisoes",
    metodo: "POST",
    caminho: "/decisoes/{id}",
    entrada: z.object({
      id: z.string().min(1).max(64),
      decisao: z.enum(["aprovar", "passar", "ajustar"]),
      ajuste: z.string().max(2000).optional(),
    }),
    async executar({ accountId }, a) {
      const escolha = DECISAO[a.decisao as string]!;
      const ajuste = String(a.ajuste ?? "").trim();
      if (escolha === "AJUSTAR" && ajuste.length < 3)
        throw new ErroConta(400, "parametros_invalidos", "ajuste: conte o que mudar.");
      if (escolha === "AJUSTAR") await exigirGeracao(accountId);
      else await exigirLiberada(accountId);
      const r = await decidirExecucao(accountId, String(a.id), escolha, ajuste);
      if (!r.decidida) throw new ErroConta(404, "nao_encontrada", "Essa decisão não está pendente nesta conta.");
      return { ok: true, decisao: a.decisao, producao: r.producao ?? null, destino: r.destino?.rotulo ?? null };
    },
  },
  {
    nome: "listar_entregas",
    descricao: "Peças prontas que os chefes produziram, das mais novas para as mais antigas. Filtra por departamento.",
    escopo: "leitura",
    metodo: "GET",
    caminho: "/entregas",
    entrada: z.object({
      departamento: z.enum(SLUGS).optional(),
      limite: z.coerce.number().int().min(1).max(50).optional(),
    }),
    async executar({ accountId }, a) {
      const dep = a.departamento ? departamentoPorSlug(String(a.departamento)) : null;
      const itens = await listarEntregas(
        accountId,
        dep ? { departamento: dep.departamento } : {},
        (a.limite as number | undefined) ?? 20,
      );
      return {
        entregas: itens.map((e) => ({
          id: e.id,
          tipo: e.tipo,
          rede: e.rede,
          chefe: e.chefe,
          titulo: e.titulo,
          status: e.status,
          resumo: e.resumo,
          em: e.em,
        })),
      };
    },
  },
  {
    nome: "ler_entrega",
    descricao: "Uma entrega inteira pelo id: texto completo, fontes e situação.",
    escopo: "leitura",
    metodo: "GET",
    caminho: "/entregas/{id}",
    entrada: z.object({ id: z.string().min(1).max(64) }),
    async executar({ accountId }, a) {
      const e = await obterEntrega(accountId, String(a.id));
      if (!e) throw new ErroConta(404, "nao_encontrada", "Entrega não encontrada nesta conta.");
      const v = entregaView(e);
      return { ...v, conteudo: e.conteudo ?? null };
    },
  },
  {
    nome: "ler_execucoes",
    descricao: "Execuções dos chefes no mês (AAAA-MM): totais de custo, tokens, tempo e falhas, e as últimas 50 linhas.",
    escopo: "leitura",
    metodo: "GET",
    caminho: "/execucoes",
    entrada: z.object({ mes: z.string().regex(/^\d{4}-\d{2}$/).optional() }),
    async executar({ accountId }, a) {
      const mes = lerMes(a.mes as string | undefined);
      const [totais, linhas] = await Promise.all([
        totaisDoMes(accountId, { mes }),
        listarExecucoes(accountId, { mes }, 50),
      ]);
      // A saída inteira fica de fora (é longa); ler_entrega traz o texto das peças.
      return { mes, totais, execucoes: linhas.map((l) => ({ ...l, saida: undefined })) };
    },
  },
  {
    nome: "pedir_ao_chefe",
    descricao:
      "Pede trabalho ao chefe de um departamento (redes, vendas, estrategia) ou uma nova leitura (presenca, operacao). Roda em segundo plano com a chave de IA da conta; devolve o ticket para status_pedido.",
    escopo: "pedidos",
    metodo: "POST",
    caminho: "/pedidos",
    pesada: true,
    entrada: z.object({
      departamento: z.enum(SLUGS),
      pedido: z.string().max(2000).optional(),
    }),
    async executar({ accountId }, a) {
      await exigirGeracao(accountId);
      const dep = departamentoPorSlug(String(a.departamento))!;
      const texto = String(a.pedido ?? "").trim();
      if (!dep.leitura && texto.length < 3)
        throw new ErroConta(400, "parametros_invalidos", "pedido: escreva o que você precisa.");
      const ticket = await dispararChefe(accountId, dep.chefe, texto);
      return { ticket: codificarTicket(ticket), chefe: dep.chefe };
    },
  },
  {
    nome: "status_pedido",
    descricao: "Situação de um pedido pelo ticket: preparando, concluida (com o texto), pergunta ou falhou.",
    escopo: "leitura",
    metodo: "GET",
    caminho: "/pedidos/{ticket}",
    entrada: z.object({ ticket: z.string().min(8).max(400) }),
    async executar({ accountId }, a) {
      const t = ticketSchema.safeParse(decodificarTicket(String(a.ticket)));
      if (!t.success) throw new ErroConta(400, "parametros_invalidos", "ticket: inválido.");
      return statusPedido(accountId, t.data);
    },
  },
  // ------------------------------------------------------------------ agente: redes sem API oficial
  {
    nome: "enviar_rede",
    descricao:
      "Manda o que o seu agente leu de uma rede (sem API oficial): perfil, seguidores e os posts com as métricas públicas. Cada envio substitui o anterior daquela rede. A Central mostra tudo em Redes › Contas e os chefes usam nos trabalhos.",
    escopo: "redes",
    metodo: "POST",
    caminho: "/redes",
    entrada: envioAgenteSchema,
    async executar({ accountId, chave }, a) {
      const r = await gravarDoAgente(accountId, envioAgenteSchema.parse(a), chave.nome);
      return { ok: true, ...r };
    },
  },
  // ------------------------------------------------------------------ agente: números do mês
  {
    nome: "informar_numeros",
    descricao:
      "Informa os números de um mês (faturamento em reais, atendimentos ou vendas, cancelados, faltas, clientes ativos, novos e sumidos). O Gerente Rotina, o Conselho e o Negociador Trato leem daqui. Mandar de novo o mesmo mês atualiza.",
    escopo: "numeros",
    metodo: "POST",
    caminho: "/numeros",
    entrada: numerosSchema,
    async executar({ accountId }, a) {
      const d = numerosSchema.parse(a);
      const dados = {
        receitaCentavos: Math.round((d.receita ?? 0) * 100),
        atendimentos: d.atendimentos ?? 0,
        cancelados: d.cancelados ?? 0,
        faltas: d.faltas ?? 0,
        clientesAtivos: d.clientesAtivos ?? 0,
        clientesNovos: d.clientesNovos ?? 0,
        clientesSumidos: d.clientesSumidos ?? 0,
        ateDia: d.ateDia ?? 31,
      };
      await prisma.numeroMes.upsert({ where: { accountId_mes: { accountId, mes: d.mes } }, update: dados, create: { accountId, mes: d.mes, ...dados } });
      return { ok: true, mes: d.mes };
    },
  },
  {
    nome: "ler_numeros",
    descricao: "Os números dos últimos 12 meses informados.",
    escopo: "numeros",
    metodo: "GET",
    caminho: "/numeros",
    entrada: z.object({}),
    async executar({ accountId }) {
      const l = await prisma.numeroMes.findMany({ where: { accountId }, orderBy: { mes: "desc" }, take: 12 });
      return { meses: l.map((m) => ({ mes: m.mes, receita: m.receitaCentavos / 100, atendimentos: m.atendimentos, cancelados: m.cancelados, faltas: m.faltas, clientesAtivos: m.clientesAtivos, clientesNovos: m.clientesNovos, clientesSumidos: m.clientesSumidos, ateDia: m.ateDia })) };
    },
  },
  // ------------------------------------------------------------------ agente: publicação
  {
    nome: "fila_de_publicacao",
    descricao:
      "Peças aprovadas com data no Cronograma que ainda não foram publicadas: rede, quando, o texto pronto e, no carrossel, os slides. Para o agente que publica sozinho (sem Buffer). Depois de publicar, use marcar_publicada.",
    escopo: "publicar",
    metodo: "GET",
    caminho: "/publicar",
    entrada: z.object({}),
    async executar({ accountId }) {
      const l = await prisma.entregaChefe.findMany({
        where: { accountId, etapa: { in: ["APROVADO", "PROGRAMADO"] }, programadaPara: { not: null }, publicadaEm: null },
        orderBy: { programadaPara: "asc" },
        take: 50,
        select: { id: true, rede: true, tipo: true, titulo: true, texto: true, conteudo: true, programadaPara: true, bufferId: true },
      });
      return {
        pecas: l.map((e) => ({
          id: e.id,
          rede: e.rede,
          tipo: e.tipo,
          titulo: e.titulo,
          quando: e.programadaPara?.toISOString() ?? null,
          vencida: !!e.programadaPara && e.programadaPara.getTime() <= Date.now(),
          naFilaDoBuffer: !!e.bufferId,
          texto: e.texto ?? "",
          slides: (e.conteudo as { slides?: unknown } | null)?.slides ?? null,
        })),
      };
    },
  },
  {
    nome: "marcar_publicada",
    descricao: "Marca uma peça como publicada, com o link do post (a peça vai para Publicados e a métrica dela passa a ser lida).",
    escopo: "publicar",
    metodo: "POST",
    caminho: "/publicar/{id}",
    entrada: z.object({ id: z.string().min(1).max(64), link: z.string().url().max(1000).optional(), publicadaEm: z.string().datetime().optional() }),
    async executar({ accountId }, a) {
      const e = await prisma.entregaChefe.findFirst({ where: { id: String(a.id), accountId }, select: { id: true, rede: true, texto: true } });
      if (!e) throw new ErroConta(404, "nao_encontrada", "Peça não encontrada nesta conta.");
      const em = a.publicadaEm ? new Date(String(a.publicadaEm)) : new Date();
      await prisma.entregaChefe.update({
        where: { id: e.id, accountId },
        data: {
          etapa: "PUBLICADO",
          publicadaEm: em,
          ...(a.link ? { vinculo: { rede: e.rede ?? "", id: String(a.link), link: String(a.link), data: em.toISOString(), texto: (e.texto ?? "").slice(0, 300), capa: null } } : {}),
        },
      });
      return { ok: true, id: e.id };
    },
  },
];

const ticketSchema = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("chefe"), execucaoId: z.string().min(1).max(64) }),
  z.object({ tipo: z.literal("leitura"), chefe: z.enum(["Gerente Rotina", "Inspetor Rastro"]), desde: z.number() }),
]);

export function acaoPorNome(nome: string): AcaoConta | undefined {
  return ACOES_CONTA.find((a) => a.nome === nome);
}

/** Acha a ação pelo método e caminho; devolve os parâmetros do caminho. */
export function acaoPorRota(metodo: string, partes: string[]): { acao: AcaoConta; params: Record<string, string> } | null {
  for (const acao of ACOES_CONTA) {
    if (acao.metodo !== metodo) continue;
    const molde = acao.caminho.split("/").filter(Boolean);
    if (molde.length !== partes.length) continue;
    const params: Record<string, string> = {};
    const casa = molde.every((m, i) => {
      const p = /^\{(\w+)\}$/.exec(m);
      if (p) {
        params[p[1]!] = decodeURIComponent(partes[i]!);
        return true;
      }
      return m === partes[i];
    });
    if (casa) return { acao, params };
  }
  return null;
}

export function podeUsar(chave: ChaveConta, acao: AcaoConta): boolean {
  return acao.escopo === "livre" || escoposDe(chave).includes(acao.escopo as EscopoConta);
}

/** Valida os argumentos com o esquema da ação; erro 400 com o primeiro problema. */
export function validar(acao: AcaoConta, bruto: unknown): Record<string, unknown> {
  const r = acao.entrada.safeParse(bruto ?? {});
  if (!r.success) {
    const i = r.error.issues[0];
    throw new ErroConta(400, "parametros_invalidos", `${i?.path.join(".") || "entrada"}: ${i?.message ?? "inválido"}`);
  }
  return r.data as Record<string, unknown>;
}

/** Esquema JSON da entrada (para o MCP). */
export function esquemaJson(acao: AcaoConta): Record<string, unknown> {
  const s = z.toJSONSchema(acao.entrada, { io: "input" }) as Record<string, unknown>;
  delete s.$schema;
  return s;
}
