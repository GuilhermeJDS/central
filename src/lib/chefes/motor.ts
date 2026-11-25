/**
 * Motor dos chefes: o chefe (Haiku) lê o pedido, escolhe UMA skill do seu
 * cardápio e a skill (executar do repositório) faz o trabalho.
 *
 * SEGURANÇA: o `accountId` sempre vem de quem chama no servidor (sessão
 * autenticada), NUNCA do corpo da requisição. O chefe só roda skills da lista
 * da própria config: qualquer escolha fora dela vira erro.
 */
import "server-only";

import { promises as fs } from "fs";
import path from "path";
import { z } from "zod";

import type { Departamento, FichaNegocio, Prisma } from "@/generated/prisma/client";
import { chamarModelo, usoDe, extrairJson, mensagemDeErro } from "@/lib/chefes/chamar-modelo";
import { dadosParaSkill, SKILLS_VIRAIS, temaDeBusca } from "@/lib/chefes/dados-redes";
import { insumosPara } from "@/lib/central/ligacoes";
import { AREAS_REDES } from "@/lib/central/redes-areas";
import { CARDAPIO, chipsDoChefe } from "@/lib/chefes/cardapio";
import { rotear } from "@/lib/chefes/norte";
import { revisar } from "@/lib/chefes/revisor";
import { acharSkill, executorDeSkills, extrairDescricao } from "@/lib/skills/executar";
import { garantirTitulo, PEDIDO_TITULO_LINHA, separarTitulo } from "@/lib/chefes/titulo";
import { credencialDaConta, type Credencial, type OrigemChave } from "@/lib/ia/credencial";
import type { ProvedorIA } from "@/lib/ia/provedores/catalogo";
import { obterFicha } from "@/lib/negocio/ficha";
import { prisma } from "@/lib/prisma";
import { CATALOGO_REDES, type RedeConectavel } from "@/lib/redes/catalogo";
import { redesConectadas } from "@/lib/redes/contas";
import {
  concluirExecucao,
  criarExecucao,
  falharExecucao,
  marcarRodando,
  ultimasExecucoes,
} from "@/lib/skills/execucoes";

// ---------------------------------------------------------------------------
// Tipos da config de cada chefe
// ---------------------------------------------------------------------------

export type EntradaExecutar = {
  texto: string;
  imagens?: Array<{ base64: string; mediaType: string }>;
  voz?: string;
  credencial?: Credencial;
};

export type ResultadoExecutar = {
  saida: string;
  usoTokens: { entrada: number; saida: number; cacheLeitura: number; cacheEscrita: number };
  modelo: string;
  provedor: ProvedorIA;
  origem: OrigemChave;
};

export type FuncaoExecutar = (skill: string, entrada: EntradaExecutar) => Promise<ResultadoExecutar>;

export type RepositorioChefe = {
  /** Área em skills/ (ex.: "redes"). Só informativo: o executor acha a skill pelo nome. */
  pastaSkills: string;
  /** Skills que este chefe pode rodar neste repositório. */
  skills: readonly string[];
  /**
   * Skills que só entram no cardápio com uma destas redes conectadas
   * (Configurações → Conexões). As demais rodam com ou sem conexão.
   */
  conexoes?: Partial<Record<string, readonly RedeConectavel[]>>;
  executar: FuncaoExecutar;
};

export type ConfigChefe = {
  nome: string;
  departamento: Departamento;
  /** Mapa repositório → skills permitidas + função executar. */
  repositorios: Record<string, RepositorioChefe>;
  /** Regras extras do chefe na hora de escolher a skill (ex.: o que é dele e não vai para outro departamento). */
  regras?: readonly string[];
  /** Dados reais do negócio para a skill (números do banco), quando servem a ela. */
  dados?: (accountId: string, repositorio: string, skill: string) => Promise<string | null>;
};

/** Um elo da corrente de trabalho ("veio do Conselho → Whale"). */
export type EloCadeia = { chefe: string; repositorio: string; skill: string; rotulo: string; execucaoId: string };

/** Trabalho anterior que continua nesta skill (encadeamento). */
export type Anterior = { cadeia: EloCadeia[]; saida: string };

export type ResultadoChefe =
  | { status: "concluida"; execucaoId: string; saida: string }
  | { status: "pergunta"; pergunta: string }
  /** `chefe`: quem o Norte indicou (null se o Norte falhou). O dono confirma antes. */
  | { status: "outro_departamento"; chefe: string | null }
  | { status: "sem_ficha" }
  | { status: "erro"; mensagem: string };

export type ImagemPedido = { base64: string; mediaType: string };

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const MAX_TOKENS_CHEFE = 1024;
const TIMEOUT_CHEFE_MS = 60 * 1000;

export const CABECALHO_SKILL =
  "Responda em português do Brasil, contexto brasileiro, valores em reais.";

// ---------------------------------------------------------------------------
// Cardápio (description do frontmatter de cada SKILL.md, com cache)
// ---------------------------------------------------------------------------

const cacheDescricoes = new Map<string, string>();

/** Descrição da skill (frontmatter do SKILL.md em skills/ ou da instalada). */
export async function descricaoSkill(_pastaSkills: string, skill: string): Promise<string> {
  const emCache = cacheDescricoes.get(skill);
  if (emCache !== undefined) return emCache;
  const achada = await acharSkill(skill);
  const descricao = achada ? extrairDescricao(achada.skillMd) : "";
  cacheDescricoes.set(skill, descricao);
  return descricao;
}

/** A skill tem as conexões de que precisa? */
function conexaoOk(repo: RepositorioChefe, skill: string, conectadas: Set<RedeConectavel>): boolean {
  const precisa = repo.conexoes?.[skill];
  return !precisa || precisa.some((r) => conectadas.has(r));
}

/** Nome em português de cada skill (cardápio do chefe e áreas das Redes): ajuda o chefe a escolher. */
function nomesEmPortugues(chefe: string): Map<string, string[]> {
  const m = new Map<string, string[]>();
  const add = (repo: string, skill: string, txt: string) => {
    const k = `${repo}/${skill}`;
    m.set(k, [...(m.get(k) ?? []), txt]);
  };
  for (const a of CARDAPIO[chefe] ?? []) add(a.repositorio, a.skill, `${a.rotulo} (${a.sai})`);
  if (chefe === "Editora Pauta")
    for (const area of AREAS_REDES) for (const a of area.acoes) add(a.repositorio, a.skill, `${area.nome} › ${a.rotulo} (${a.sai})`);
  return m;
}

async function montarCardapio(config: ConfigChefe, conectadas: Set<RedeConectavel>): Promise<string> {
  const blocos: string[] = [];
  const pt = nomesEmPortugues(config.nome);
  for (const [repositorio, repo] of Object.entries(config.repositorios)) {
    const skills = repo.skills.filter((s) => conexaoOk(repo, s, conectadas));
    if (!skills.length) continue;
    const itens = await Promise.all(
      skills.map(async (s) => {
        const nomes = pt.get(`${repositorio}/${s}`);
        const desc = (await descricaoSkill(repo.pastaSkills, s)).slice(0, 420);
        return `- ${s}${nomes ? ` [${[...new Set(nomes)].join("; ")}]` : ""}: ${desc}`;
      }),
    );
    blocos.push(`repositorio "${repositorio}":\n${itens.join("\n")}`);
  }
  return blocos.join("\n\n");
}

// ---------------------------------------------------------------------------
// Contexto
// ---------------------------------------------------------------------------

const OBJETIVO_TEXTO: Record<FichaNegocio["objetivo"], string> = {
  MAIS_CLIENTES: "conseguir mais clientes",
  MAIS_VENDAS: "vender mais",
  ORGANIZAR: "organizar o negócio",
  OUTRO: "outro",
};

export function resumirFicha(f: FichaNegocio): string {
  const redes = (
    [
      ["Instagram", f.instagram],
      ["Site", f.site],
      ["Google", f.google],
      ["YouTube", f.youtube],
      ["LinkedIn", f.linkedin],
      ["X", f.x],
    ] as const
  )
    .filter(([, v]) => v)
    .map(([n, v]) => `${n}: ${v}`);
  const objetivo = f.objetivo === "OUTRO" ? f.objetivoOutro ?? "outro" : OBJETIVO_TEXTO[f.objetivo];
  return [
    `Negócio: ${f.nomeNegocio} (${f.cidade})`,
    `O que vende: ${f.oQueVende}`,
    `Para quem: ${f.paraQuem}`,
    `Objetivo: ${objetivo}`,
    redes.length ? `Redes: ${redes.join(" | ")}` : null,
    f.naoQuer ? `Não quer de jeito nenhum: ${f.naoQuer}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

async function resumoUltimas(accountId: string, departamento: Departamento): Promise<string> {
  const ultimas = await ultimasExecucoes(accountId, departamento, 5);
  if (!ultimas.length) return "(nenhuma ainda)";
  return ultimas
    .map((e) => {
      const data = e.criadaEm.toISOString().slice(0, 10);
      const quem = e.skill ? `${e.repositorio}/${e.skill}` : `chefe ${e.chefe}`;
      const trecho = (e.saida ?? "").replace(/\s+/g, " ").slice(0, 200);
      return `- ${data} ${quem}: ${trecho}`;
    })
    .join("\n");
}

// ---------------------------------------------------------------------------
// Decisão do chefe
// ---------------------------------------------------------------------------

const decisaoSchema = z.object({
  acao: z.enum(["rodar", "perguntar", "outro_departamento"]),
  repositorio: z.string().default(""),
  skill: z.string().default(""),
  entrada: z.string().default(""),
  pergunta: z.string().default(""),
  /** Tema/hashtag do nicho para as skills que buscam virais. */
  busca: z.string().default(""),
});

type Decisao = z.infer<typeof decisaoSchema>;

function promptChefe(config: ConfigChefe, cardapio: string): string {
  return [
    `Você é ${config.nome}, chefe do departamento ${config.departamento} de um pequeno negócio brasileiro.`,
    "Sua única tarefa é decidir qual skill do cardápio atende o pedido do dono.",
    "",
    "Regras:",
    "- Escolha UMA skill do cardápio abaixo (use exatamente o nome do repositório e da skill).",
    "- Se faltar um dado essencial para a skill fazer um bom trabalho, use acao \"perguntar\" e escreva UMA pergunta curta e simples em português.",
    `- Se o assunto não é do departamento ${config.departamento}, use acao "outro_departamento".`,
    "- Em \"entrada\", reescreva o pedido de forma clara e completa para a skill, com o que a ficha e o histórico dizem de útil.",
    "- Evite repetir o que já foi feito nas últimas execuções.",
    "- Os dados reais das redes conectadas (perfil, publicações, métricas) e os números do negócio entram sozinhos na skill: não pergunte por eles.",
    "- Prefira rodar com o que a ficha diz a perguntar; pergunte só se sem o dado a entrega sairia errada.",
    ...(config.regras ?? []).map((r) => `- ${r}`),
    `- Em "busca", para skills que procuram o que está bombando (${[...SKILLS_VIRAIS].join(", ")}), escreva o tema ou a hashtag do nicho em 1 a 3 palavras, em português (ex.: "limpeza de pele", "estética facial"). Nas outras, deixe vazio.`,
    "",
    "Responda SÓ com um JSON, sem texto antes ou depois, sem cercas de código:",
    '{"acao":"rodar"|"perguntar"|"outro_departamento","repositorio":"","skill":"","entrada":"","pergunta":"","busca":""}',
    "",
    "Cardápio:",
    cardapio,
  ].join("\n");
}

function lerDecisao(texto: string): Decisao {
  const r = decisaoSchema.safeParse(extrairJson(texto));
  if (!r.success) throw new Error(`JSON do chefe fora do formato: ${r.error.message}`);
  return r.data;
}

function skillPermitida(
  config: ConfigChefe,
  repositorio: string,
  skill: string,
  conectadas: Set<RedeConectavel>,
): boolean {
  if (!Object.prototype.hasOwnProperty.call(config.repositorios, repositorio)) return false;
  const repo = config.repositorios[repositorio];
  return repo.skills.includes(skill) && conexaoOk(repo, skill, conectadas);
}

async function gravarEntradaSkill(accountId: string, id: string, entrada: Prisma.InputJsonValue): Promise<void> {
  await prisma.execucaoSkill.updateMany({ where: { id, accountId }, data: { entrada } });
}

// ---------------------------------------------------------------------------
// Norte afina o pedido (Promptmaster)
// ---------------------------------------------------------------------------

/** Pedido curto e solto (e que não é um chip pronto): vale o Norte afinar antes. */
function pedidoVago(config: ConfigChefe, pedido: string): boolean {
  const p = pedido.trim();
  if (!p || p.split(/\s+/).length > 7) return false;
  const chips = chipsDoChefe(config.nome).map((c) => c.toLowerCase());
  return !chips.includes(p.toLowerCase());
}

/**
 * O Norte passa o pedido pela skill afinar-pedido (skills/bastidor):
 * reescreve o pedido cru num pedido claro para o chefe, sem inventar o que o
 * dono não disse. Fica registrado como execução do Norte; se falhar, segue o
 * pedido original.
 */
async function afinarPedido(
  accountId: string,
  config: ConfigChefe,
  pedido: string,
  fichaResumida: string,
  credencial: Credencial,
): Promise<{ afinado: string; elo: EloCadeia } | null> {
  const exec = await criarExecucao({
    accountId,
    departamento: "DIRETORIA",
    chefe: "Norte",
    tipo: "CHEFE",
    repositorio: "bastidor",
    skill: "afinar-pedido",
    entrada: { acao: "afinarPedido", para: config.nome, pedido },
  });
  try {
    await marcarRodando(accountId, exec.id);
    const r = await executorDeSkills()("afinar-pedido", {
      texto: [
        `${CABECALHO_SKILL} Não responda o pedido: só reescreva.`,
        `Reescreva o pedido do dono abaixo num pedido claro e completo para o chefe ${config.nome} (${config.departamento}), em português, em até 5 linhas: o que entregar, para quem, em que formato. Use a ficha; não invente fatos que o dono não disse. Responda só com o pedido reescrito.`,
        "",
        "<ficha>",
        fichaResumida,
        "</ficha>",
        "",
        "<pedido_cru>",
        pedido,
        "</pedido_cru>",
      ].join("\n"),
      credencial,
    });
    const afinado = r.saida.trim().slice(0, 1500);
    await concluirExecucao(accountId, exec.id, {
      saida: afinado,
      modelo: r.modelo,
      provedor: r.provedor,
      origem: r.origem,
      tokensEntrada: r.usoTokens.entrada,
      tokensSaida: r.usoTokens.saida,
    });
    if (!afinado) return null;
    return {
      afinado,
      elo: { chefe: "Norte", repositorio: "bastidor", skill: "afinar-pedido", rotulo: "Pedido afinado", execucaoId: exec.id },
    };
  } catch (e) {
    await falharExecucao(accountId, exec.id, mensagemDeErro(e));
    return null;
  }
}

// ---------------------------------------------------------------------------
// rodarChefe
// ---------------------------------------------------------------------------

export async function rodarChefe(
  config: ConfigChefe,
  accountId: string,
  pedido: string,
  imagens?: ImagemPedido[],
  /**
   * Execução CHEFE já criada por quem chama (ex.: Central, que devolve o id
   * para a tela acompanhar enquanto o chefe roda em segundo plano).
   */
  opcoes: { execucaoChefeId?: string } = {},
): Promise<ResultadoChefe> {
  // a) execução do chefe
  const execChefe = opcoes.execucaoChefeId
    ? { id: opcoes.execucaoChefeId }
    : await criarExecucao({
        accountId,
        departamento: config.departamento,
        chefe: config.nome,
        tipo: "CHEFE",
        entrada: { pedido, imagens: imagens?.length ?? 0 },
      });

  // b) ficha
  const ficha = await obterFicha(accountId);
  if (!ficha) {
    await falharExecucao(accountId, execChefe.id, "Negócio sem ficha preenchida.");
    return { status: "sem_ficha" };
  }
  const fichaResumida = resumirFicha(ficha);

  // c–f) decisão do chefe
  let decisao: Decisao;
  let credencial: Credencial;
  let conectadas = new Set<RedeConectavel>();
  let afinado: Awaited<ReturnType<typeof afinarPedido>> = null;
  try {
    await marcarRodando(accountId, execChefe.id);
    credencial = await credencialDaConta(accountId, config.nome);
    // Pedido curto e solto: o Norte afina antes (Promptmaster).
    if (pedidoVago(config, pedido) && !imagens?.length) {
      afinado = await afinarPedido(accountId, config, pedido, fichaResumida, credencial);
    }
    conectadas = await redesConectadas(accountId);
    const cardapio = await montarCardapio(config, conectadas);
    const mensagem = [
      "<ficha>",
      fichaResumida,
      "</ficha>",
      "",
      "<ultimas_execucoes>",
      await resumoUltimas(accountId, config.departamento),
      "</ultimas_execucoes>",
      "",
      "<pedido>",
      pedido,
      imagens?.length ? `(o dono mandou ${imagens.length} imagem(ns) junto)` : "",
      "</pedido>",
      ...(afinado ? ["", "<pedido_afinado_pelo_norte>", afinado.afinado, "</pedido_afinado_pelo_norte>"] : []),
    ].join("\n");

    const r = await chamarModelo(accountId, promptChefe(config, cardapio), mensagem, {
      maxTokens: MAX_TOKENS_CHEFE,
      timeoutMs: TIMEOUT_CHEFE_MS,
      credencial,
    });
    decisao = lerDecisao(r.texto);

    if (decisao.acao === "rodar") {
      if (!skillPermitida(config, decisao.repositorio, decisao.skill, conectadas)) {
        throw new Error(
          `Chefe escolheu skill fora da lista: "${decisao.repositorio}/${decisao.skill}"`,
        );
      }
      if (!decisao.entrada.trim()) throw new Error("Chefe escolheu rodar sem entrada");
    }
    if (decisao.acao === "perguntar" && !decisao.pergunta.trim()) {
      throw new Error("Chefe escolheu perguntar sem pergunta");
    }

    await concluirExecucao(accountId, execChefe.id, {
      saida: JSON.stringify(decisao),
      ...usoDe(r),
    });
  } catch (e) {
    const mensagem = mensagemDeErro(e);
    await falharExecucao(accountId, execChefe.id, mensagem);
    return { status: "erro", mensagem };
  }

  if (decisao.acao === "perguntar") return { status: "pergunta", pergunta: decisao.pergunta };
  if (decisao.acao === "outro_departamento") {
    // O Norte indica o chefe certo; não encadeia (o dono confirma antes).
    let chefe: string | null = null;
    try {
      chefe = (await rotear(accountId, pedido, config.nome)).chefe;
    } catch (e) {
      console.error(`[motor] Norte não conseguiu rotear: ${mensagemDeErro(e)}`);
    }
    return { status: "outro_departamento", chefe };
  }

  return executarSkillEscolhida(config, accountId, {
    execucaoChefeId: execChefe.id,
    ficha,
    fichaResumida,
    credencial,
    conectadas,
    decisao,
    imagens,
    // A corrente mostra que o Norte afinou o pedido antes ("veio de Norte · Pedido afinado").
    anterior: afinado ? { cadeia: [afinado.elo], saida: afinado.afinado } : undefined,
  });
}

type SkillEscolhida = {
  execucaoChefeId: string;
  ficha: FichaNegocio;
  fichaResumida: string;
  credencial: Credencial;
  conectadas: Set<RedeConectavel>;
  decisao: Pick<Decisao, "repositorio" | "skill" | "entrada" | "busca">;
  imagens?: ImagemPedido[];
  /** Trabalho anterior que continua aqui (encadeamento). */
  anterior?: Anterior;
};

/** g–h) Roda a skill já escolhida (pelo chefe ou pelo botão da área da rede) e o Revisor. */
async function executarSkillEscolhida(
  config: ConfigChefe,
  accountId: string,
  { execucaoChefeId, ficha, fichaResumida, credencial, conectadas, decisao, imagens, anterior }: SkillEscolhida,
): Promise<ResultadoChefe> {
  // g) execução da skill, com os dados reais das redes conectadas
  const repo = config.repositorios[decisao.repositorio];
  const busca = temaDeBusca(decisao.busca, ficha);
  const execSkill = await criarExecucao({
    accountId,
    departamento: config.departamento,
    chefe: config.nome,
    tipo: "SKILL",
    repositorio: decisao.repositorio,
    skill: decisao.skill,
    execucaoPaiId: execucaoChefeId,
    entrada: {
      entrada: decisao.entrada,
      imagens: imagens?.length ?? 0,
      ...(anterior ? { cadeia: anterior.cadeia } : {}),
    },
  });

  let resultado: ResultadoExecutar;
  /** O que a skill recebeu: vira a evidência do crash-out no Revisor. */
  let evidencia = "";
  try {
    await marcarRodando(accountId, execSkill.id);
    const [dados, insumos, doNegocio] = await Promise.all([
      dadosParaSkill(accountId, decisao.repositorio, decisao.skill, conectadas, busca),
      // Departamentos conectados: o que o chefe anterior produziu entra aqui.
      insumosPara(accountId, config.nome),
      config.dados ? config.dados(accountId, decisao.repositorio, decisao.skill).catch(() => null) : Promise.resolve(null),
    ]);
    // Só o resumo na execução (redes lidas, busca, avisos), nunca o dado bruto.
    await gravarEntradaSkill(accountId, execSkill.id, {
      entrada: decisao.entrada,
      imagens: imagens?.length ?? 0,
      redes: dados.redesLidas,
      busca: dados.busca,
      avisos: dados.avisos,
      fontes: insumos.fontes,
      numerosDoNegocio: !!doNegocio,
      ...(anterior ? { cadeia: anterior.cadeia } : {}),
    });
    if (SKILLS_VIRAIS.has(decisao.skill) && !dados.achouVirais) {
      const redes = (repo.conexoes?.[decisao.skill] ?? []).map((r) => CATALOGO_REDES[r].nome).join(", ");
      throw new Error(
        dados.avisos[0] ??
          `Não achei posts sobre "${busca}" agora${redes ? ` (${redes})` : ""}. Tente outro tema ou mais tarde.`,
      );
    }
    const texto = [
      CABECALHO_SKILL,
      "",
      "Sobre o negócio:",
      fichaResumida,
      "",
      decisao.entrada,
      ...(dados.bloco
        ? [
            "",
            "<dados_reais_das_redes>",
            "Lidos agora pelas APIs oficiais. Use estes números e textos; não invente outros. Os dados já estão aqui: não peça para rodar scripts nem para colar dados.",
            dados.bloco,
            "</dados_reais_das_redes>",
          ]
        : []),
      ...(dados.avisos.length ? ["", `Leituras que falharam: ${dados.avisos.join(" | ")}`] : []),
      ...(doNegocio
        ? ["", "<numeros_do_negocio>", "Tirados agora do sistema do negócio. Use estes números; não invente outros.", doNegocio, "</numeros_do_negocio>"]
        : []),
      ...(anterior
        ? [
            "",
            `<trabalho_anterior origem="${anterior.cadeia.map((e) => `${e.chefe} · ${e.rotulo}`).join(" → ")}">`,
            "Continue a partir deste trabalho: use o que ele decidiu (oferta, preço, público, números) sem contradizer.",
            anterior.saida.slice(0, 12000),
            "</trabalho_anterior>",
          ]
        : []),
      ...(insumos.bloco ? ["", "Do trabalho dos outros departamentos (use quando ajudar):", insumos.bloco] : []),
      "",
      PEDIDO_TITULO_LINHA,
    ].join("\n");
    // A evidência é o que a skill recebeu, sem o pedido de título (o crash-out recolocava a linha "TÍTULO:").
    evidencia = texto.replace(PEDIDO_TITULO_LINHA, "").trim();
    resultado = await repo.executar(decisao.skill, {
      texto,
      voz: ficha.comoFala ?? undefined,
      imagens,
      credencial,
    });
    // O título vem na primeira linha; a saída guarda só o resultado.
    const { titulo, corpo } = separarTitulo(resultado.saida);
    if (!corpo) throw new Error("A skill respondeu só o título, sem o resultado.");
    resultado = { ...resultado, saida: corpo };
    const u = resultado.usoTokens;
    await concluirExecucao(accountId, execSkill.id, {
      saida: corpo,
      titulo,
      modelo: resultado.modelo,
      provedor: resultado.provedor,
      origem: resultado.origem,
      tokensEntrada: u.entrada + u.cacheLeitura + u.cacheEscrita,
      tokensSaida: u.saida,
    });
    await garantirTitulo(accountId, execSkill.id, titulo, corpo, credencial);
  } catch (e) {
    const mensagem = mensagemDeErro(e);
    await falharExecucao(accountId, execSkill.id, mensagem);
    return { status: "erro", mensagem };
  }

  // h) Revisor (execução REVISOR filha da SKILL). Se falhar, o erro fica
  //    registrado na execução do Revisor e a saída original é devolvida.
  let saida = resultado.saida;
  try {
    // Vendas e Estratégia têm número, preço e prazo: o crash-out ataca cada um contra a evidência.
    const comCrashOut = config.departamento === "VENDAS" || config.departamento === "ESTRATEGIA";
    saida = await revisar(accountId, execSkill.id, resultado.saida, credencial, comCrashOut ? { evidencia } : {});
  } catch (e) {
    console.error(`[motor] Revisor falhou, devolvendo saída original: ${mensagemDeErro(e)}`);
  }
  return { status: "concluida", execucaoId: execSkill.id, saida };
}

/**
 * Botão de uma área das Redes: roda a skill pedida direto, sem o chefe
 * escolher. Mesma trava do cardápio (skill da lista + conexão exigida).
 * A execução CHEFE (criada por quem chama) fica concluída com a decisão
 * "rodar", para a Central acompanhar como um pedido normal.
 */
export async function rodarSkillDireta(
  config: ConfigChefe,
  accountId: string,
  pedido: { repositorio: string; skill: string; entrada: string; busca?: string },
  execucaoChefeId: string,
  anterior?: Anterior,
): Promise<ResultadoChefe> {
  const ficha = await obterFicha(accountId);
  if (!ficha) {
    await falharExecucao(accountId, execucaoChefeId, "Negócio sem ficha preenchida.");
    return { status: "sem_ficha" };
  }
  let credencial: Credencial;
  let conectadas: Set<RedeConectavel>;
  const decisao = { acao: "rodar" as const, pergunta: "", busca: pedido.busca ?? "", ...pedido };
  try {
    await marcarRodando(accountId, execucaoChefeId);
    credencial = await credencialDaConta(accountId, config.nome);
    conectadas = await redesConectadas(accountId);
    if (!skillPermitida(config, pedido.repositorio, pedido.skill, conectadas))
      throw new Error(`Skill fora da lista ou sem a conexão: "${pedido.repositorio}/${pedido.skill}"`);
    await concluirExecucao(accountId, execucaoChefeId, {
      saida: JSON.stringify(decisao),
      modelo: "direto",
      origem: "cliente",
      tokensEntrada: 0,
      tokensSaida: 0,
    });
  } catch (e) {
    const mensagem = mensagemDeErro(e);
    await falharExecucao(accountId, execucaoChefeId, mensagem);
    return { status: "erro", mensagem };
  }
  return executarSkillEscolhida(config, accountId, {
    execucaoChefeId,
    ficha,
    fichaResumida: resumirFicha(ficha),
    credencial,
    conectadas,
    decisao,
    anterior,
  });
}
