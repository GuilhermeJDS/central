/**
 * Revisor — BASTIDOR. Passa a saída de cada skill por uma checagem antes de
 * chegar ao dono do negócio.
 *
 * 0) Crash-out (claude-illegal-codes/crash-out), só quando quem chama manda a
 *    evidência (Vendas e Estratégia: números, preços, prazos): cada afirmação
 *    que sustenta a resposta é atacada contra a evidência; o que não se
 *    sustenta sai, o que não dá para confirmar fica marcado "(confira)". A
 *    lista do que caiu fica na entrada da execução do Revisor.
 *
 * a) Checagem em código (sem modelo): termos que o dono não quer (ficha.naoQuer),
 *    marcas de texto de IA (lista do ig-human, só leitura do slop.json — a skill
 *    não é executada), itens ativos da Lista Negra (/admin/lista-negra),
 *    travessão "—" e sinais de fora do Brasil.
 * b) Nada encontrado → registra REVISOR concluída com 0 tokens e devolve igual.
 * c) Com achados → uma chamada corrige SÓ os trechos marcados. Nunca cria
 *    conteúdo novo.
 *
 * SEGURANÇA: o `accountId` sempre vem do servidor (sessão autenticada).
 */
import "server-only";

import { promises as fs } from "fs";
import path from "path";

import {
  MODELO_CHEFES,
  chamarModelo,
  usoDe,
  mensagemDeErro,
} from "@/lib/chefes/chamar-modelo";
import type { Credencial } from "@/lib/ia/credencial";
import { regrasListaNegra, semTravessao } from "@/lib/lista-negra";
import { obterFicha } from "@/lib/negocio/ficha";
import { prisma } from "@/lib/prisma";
import {
  concluirExecucao,
  criarExecucao,
  falharExecucao,
  marcarRodando,
} from "@/lib/skills/execucoes";

const NOME = "Revisor";
/** Léxico de marcas de texto de IA em português (skills/bastidor/tirar-cara-de-ia/*.json). */
const PASTA_IG_HUMAN = path.join(/* turbopackIgnore: true */ process.cwd(), "skills", "bastidor", "tirar-cara-de-ia");
const MAX_TOKENS_REVISOR = 8192;
const TIMEOUT_REVISOR_MS = 120 * 1000;
/** Quantos caracteres de contexto mostrar em volta de cada achado. */
const CONTEXTO = 40;

export type Achado = {
  tipo: "nao_quer" | "marca_ia" | "lista_negra" | "travessao" | "fora_do_brasil";
  termo: string;
  motivo: string;
  trecho: string;
};

type Regra = { tipo: Achado["tipo"]; termo: string; motivo: string; regex: RegExp };

// ---------------------------------------------------------------------------
// Marcas de texto de IA (lidas dos .json do tirar-cara-de-ia, com cache)
// ---------------------------------------------------------------------------

let cacheMarcasIa: Regra[] | null = null;

function escaparRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Termo como palavra inteira, sem diferenciar maiúsculas. */
function regexPalavra(termo: string): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaparRegex(termo)}(?![\\p{L}\\p{N}])`, "giu");
}

/** Converte regex no estilo Python ((?i) no início, \UXXXXXXXX) para JS. */
function regexDoPython(fonte: string): RegExp | null {
  let flags = "gu";
  let corpo = fonte;
  const inline = corpo.match(/^\(\?([a-z]+)\)/);
  if (inline) {
    if (inline[1].includes("i")) flags += "i";
    if (inline[1].includes("m")) flags += "m";
    corpo = corpo.slice(inline[0].length);
  }
  corpo = corpo.replace(/\\U([0-9a-fA-F]{8})/g, (_, hex: string) => `\\u{${hex.replace(/^0+/, "")}}`);
  try {
    return new RegExp(corpo, flags);
  } catch {
    return null;
  }
}

type ItemLexico = { find?: unknown; regex?: unknown; name?: unknown; family?: unknown };

function lerLexico(dados: unknown): Regra[] {
  if (!dados || typeof dados !== "object") return [];
  const d = dados as Record<string, unknown>;
  const regras: Regra[] = [];
  for (const chave of ["words", "phrases"] as const) {
    const lista = Array.isArray(d[chave]) ? (d[chave] as ItemLexico[]) : [];
    for (const item of lista) {
      if (typeof item?.find !== "string" || !item.find.trim()) continue;
      regras.push({
        tipo: "marca_ia",
        termo: item.find,
        motivo: `expressão típica de texto de IA (${typeof item.family === "string" ? item.family : chave})`,
        regex: regexPalavra(item.find),
      });
    }
  }
  const estruturas = Array.isArray(d.structures) ? (d.structures as ItemLexico[]) : [];
  for (const item of estruturas) {
    if (typeof item?.regex !== "string") continue;
    const regex = regexDoPython(item.regex);
    if (!regex) continue;
    const nome = typeof item.name === "string" ? item.name : "estrutura";
    regras.push({ tipo: "marca_ia", termo: nome, motivo: `estrutura típica de texto de IA: ${nome}`, regex });
  }
  return regras;
}

async function marcasDeIa(): Promise<Regra[]> {
  if (cacheMarcasIa) return cacheMarcasIa;
  const arquivos = (await fs.readdir(PASTA_IG_HUMAN)).filter((a) => a.endsWith(".json")).sort();
  const regras: Regra[] = [];
  for (const arquivo of arquivos) {
    try {
      const bruto = await fs.readFile(path.join(PASTA_IG_HUMAN, arquivo), "utf-8");
      regras.push(...lerLexico(JSON.parse(bruto)));
    } catch (e) {
      console.warn(`[revisor] não consegui ler ${arquivo}: ${mensagemDeErro(e)}`);
    }
  }
  cacheMarcasIa = regras;
  return regras;
}

// ---------------------------------------------------------------------------
// Checagem em código
// ---------------------------------------------------------------------------

const REGRAS_FIXAS: Regra[] = [
  { tipo: "travessao", termo: "—", motivo: "travessão (marca de texto de IA)", regex: /—/g },
  {
    tipo: "fora_do_brasil",
    termo: "$",
    motivo: "valor em \"$\" sem \"R$\" (moeda de fora do Brasil)",
    regex: /(?<!R)\$/g,
  },
  { tipo: "fora_do_brasil", termo: "Stripe", motivo: "Stripe (meio de pagamento de fora)", regex: regexPalavra("Stripe") },
  { tipo: "fora_do_brasil", termo: "USD", motivo: "valor em dólar (USD)", regex: regexPalavra("USD") },
  { tipo: "fora_do_brasil", termo: "dollar", motivo: "valor em dólar", regex: /(?<![\p{L}])dollars?(?![\p{L}])/giu },
  { tipo: "fora_do_brasil", termo: "dólar", motivo: "valor em dólar", regex: /(?<![\p{L}])d[óo]lar(?:es)?(?![\p{L}])/giu },
];

function regrasNaoQuer(naoQuer: string | null | undefined): Regra[] {
  if (!naoQuer) return [];
  const termos = naoQuer
    .split(/[,\n;]/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
  return [...new Set(termos.map((t) => t.toLowerCase()))].map((t) => ({
    tipo: "nao_quer" as const,
    termo: t,
    motivo: `o dono não quer "${t}"`,
    regex: regexPalavra(t),
  }));
}

function trechoEmVolta(texto: string, inicio: number, fim: number): string {
  const a = Math.max(0, inicio - CONTEXTO);
  const b = Math.min(texto.length, fim + CONTEXTO);
  return `${a > 0 ? "…" : ""}${texto.slice(a, b)}${b < texto.length ? "…" : ""}`.replace(/\s+/g, " ");
}

/** Itens ativos da Lista Negra que têm regex (REGRA_COPY vai só no prompt). */
async function regrasDaListaNegra(): Promise<Regra[]> {
  return (await regrasListaNegra()).flatMap((i) =>
    i.regex
      ? [
          {
            tipo: "lista_negra" as const,
            termo: i.termo,
            motivo: `Lista Negra${i.motivo ? ` (${i.motivo})` : ""}${
              i.substituicaoSugerida !== null ? `; troque por "${i.substituicaoSugerida}"` : "; tire ou reescreva"
            }`,
            regex: i.regex,
          },
        ]
      : [],
  );
}

/** Checagem sem modelo. Exportada para o script de teste. */
export async function checarTexto(texto: string, naoQuer?: string | null): Promise<Achado[]> {
  const regras = [...regrasNaoQuer(naoQuer), ...REGRAS_FIXAS, ...(await regrasDaListaNegra()), ...(await marcasDeIa())];
  const achados: Achado[] = [];
  const vistos = new Set<string>();
  for (const regra of regras) {
    regra.regex.lastIndex = 0;
    for (const m of texto.matchAll(regra.regex)) {
      if (!m[0]) continue;
      const inicio = m.index ?? 0;
      const chave = `${regra.tipo}:${inicio}:${m[0].length}`;
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      achados.push({
        tipo: regra.tipo,
        termo: regra.termo,
        motivo: regra.motivo,
        trecho: trechoEmVolta(texto, inicio, inicio + m[0].length),
      });
    }
  }
  return achados;
}

// ---------------------------------------------------------------------------
// Correção pelo modelo
// ---------------------------------------------------------------------------

const PROMPT_REVISOR = [
  "Você é o Revisor de um pequeno negócio brasileiro.",
  "Recebe um texto pronto e uma lista de trechos marcados com o motivo de cada marca.",
  "",
  "Regras:",
  "- Corrija SÓ os trechos marcados. Todo o resto do texto fica exatamente igual: mesma ordem, mesma formatação, mesmas quebras de linha.",
  "- Escreva em português do Brasil. Valores em reais (R$).",
  "- Travessão \"—\": troque por vírgula, ponto ou dois-pontos, o que ficar natural.",
  "- Expressão de IA: troque por uma forma simples e direta, do jeito que uma pessoa falaria.",
  "- Termo que o dono não quer: tire ou troque por algo neutro.",
  "- Lista Negra: use a troca indicada; sem troca, tire ou reescreva o trecho sem o termo.",
  "- Sinal de fora do Brasil: troque por equivalente brasileiro (R$, Pix, Mercado Pago). Se for um valor em dólar sem conversão conhecida, tire o valor em vez de inventar um.",
  "- NUNCA invente conteúdo novo: nada de frases, dados, números, promessas ou ideias que não estavam no texto.",
  "",
  "Responda SÓ com o texto final corrigido, completo, sem comentários antes ou depois e sem cercas de código.",
].join("\n");

function mensagemCorrecao(texto: string, achados: Achado[]): string {
  const lista = achados.map((a, i) => `${i + 1}. "${a.trecho}" → ${a.motivo}`).join("\n");
  return ["<trechos_marcados>", lista, "</trechos_marcados>", "", "<texto>", texto, "</texto>"].join("\n");
}

function limparResposta(r: string): string {
  return r
    .replace(/^```[a-z]*\n/i, "")
    .replace(/\n```$/, "")
    .replace(/^<texto>\n?/, "")
    .replace(/\n?<\/texto>$/, "")
    .trim();
}

// ---------------------------------------------------------------------------
// revisar
// ---------------------------------------------------------------------------

/**
 * Revisa a saída de uma execução SKILL. Registra uma execução REVISOR filha
 * dela. Em erro, registra a falha e relança (quem chama decide o que fazer).
 */
export async function revisar(
  accountId: string,
  execucaoSkillId: string,
  texto: string,
  /** Sem chave passada, usa a da conta. */
  credencial?: Credencial,
  /** Com evidência (o que a skill recebeu), roda o crash-out antes. */
  opcoes: { evidencia?: string } = {},
): Promise<string> {
  const exec = await criarExecucao({
    accountId,
    departamento: "BASTIDOR",
    chefe: NOME,
    tipo: "REVISOR",
    execucaoPaiId: execucaoSkillId,
    entrada: { caracteres: texto.length },
  });

  try {
    await marcarRodando(accountId, exec.id);
    const ficha = await obterFicha(accountId);
    let usoCrash = { entrada: 0, saida: 0 };
    if (opcoes.evidencia) {
      const c = await crashOut(accountId, texto, opcoes.evidencia, credencial);
      texto = c.texto;
      usoCrash = c.uso;
      await prisma.execucaoSkill.updateMany({
        where: { id: exec.id, accountId },
        data: { entrada: { caracteres: texto.length, crashOut: { cortes: c.cortes } } },
      });
    }
    const achados = await checarTexto(texto, ficha?.naoQuer);

    if (!achados.length) {
      if (usoCrash.entrada) {
        await concluirExecucao(accountId, exec.id, {
          saida: texto,
          modelo: MODELO_CHEFES,
          tokensEntrada: usoCrash.entrada,
          tokensSaida: usoCrash.saida,
        });
        return texto;
      }
      await concluirExecucao(accountId, exec.id, {
        saida: texto,
        modelo: MODELO_CHEFES,
        tokensEntrada: 0,
        tokensSaida: 0,
      });
      return texto;
    }

    const r = await chamarModelo(accountId, PROMPT_REVISOR, mensagemCorrecao(texto, achados), {
      maxTokens: MAX_TOKENS_REVISOR,
      timeoutMs: TIMEOUT_REVISOR_MS,
      credencial,
    });
    const corrigido = semTravessao(limparResposta(r.texto));
    if (!corrigido) throw new Error("Revisor devolveu texto vazio");

    const u = usoDe(r);
    await concluirExecucao(accountId, exec.id, {
      saida: corrigido,
      ...u,
      tokensEntrada: (u.tokensEntrada ?? 0) + usoCrash.entrada,
      tokensSaida: (u.tokensSaida ?? 0) + usoCrash.saida,
    });
    return corrigido;
  } catch (e) {
    await falharExecucao(accountId, exec.id, mensagemDeErro(e));
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Crash-out (anti-alucinação), com a evidência que a skill recebeu
// ---------------------------------------------------------------------------

const PASTA_CRASH_OUT = path.join(/* turbopackIgnore: true */ process.cwd(), "skills", "bastidor", "checar-fatos", "SKILL.md");
let crashOutMd: string | null = null;

const ADAPTACAO_CRASH_OUT = [
  "Aqui não há ferramentas: a única evidência é o bloco <evidencia> (o que a skill recebeu: ficha do negócio, números do sistema, trabalho anterior).",
  "Ataque cada afirmação que sustenta o texto (números, preços, prazos, porcentagens, nomes, fatos sobre o mercado):",
  "- está na evidência ou é conta direta dela: fica;",
  "- é sugestão, estimativa ou exemplo claramente apresentado como tal: fica;",
  "- é apresentada como fato e não dá para confirmar: fica, mas com \"(confira)\" logo depois;",
  "- contradiz a evidência: corrija pelo número da evidência ou apague.",
  "Mantenha o idioma (português do Brasil), o formato, os títulos internos e o tamanho do texto. Não acrescente conteúdo novo nem uma linha \"TÍTULO:\" no começo.",
  "Responda com o texto final, depois uma linha só com ===CORTES=== e depois a lista curta do que foi corrigido ou apagado (uma linha por item; \"nada\" se nada caiu).",
].join("\n");

async function crashOut(
  accountId: string,
  texto: string,
  evidencia: string,
  credencial?: Credencial,
): Promise<{ texto: string; cortes: string[]; uso: { entrada: number; saida: number } }> {
  crashOutMd ??= await fs.readFile(PASTA_CRASH_OUT, "utf-8");
  const r = await chamarModelo(
    accountId,
    `${crashOutMd.trim()}\n\n<adaptacao>\n${ADAPTACAO_CRASH_OUT}\n</adaptacao>`,
    `<evidencia>\n${evidencia.slice(0, 20000)}\n</evidencia>\n\n<texto>\n${texto}\n</texto>`,
    { maxTokens: MAX_TOKENS_REVISOR, timeoutMs: TIMEOUT_REVISOR_MS, credencial },
  );
  const [corpo, lista = ""] = r.texto.split(/^===CORTES===\s*$/m);
  // Linha de título no começo não é do texto (o motor já separou o título).
  const final = limparResposta(corpo ?? "").replace(/^\s*T[ÍI]TULO:[^\n]*\n+/i, "").trim();
  const u = usoDe(r);
  const uso = { entrada: u.tokensEntrada ?? 0, saida: u.tokensSaida ?? 0 };
  // Resposta quebrada ou encolhida demais: fica o original (melhor que perder o trabalho).
  if (!final || final.length < texto.length * 0.5) return { texto, cortes: ["crash-out descartado: resposta incompleta"], uso };
  const cortes = lista
    .split("\n")
    .map((l) => l.replace(/^[-*\d.)\s]+/, "").trim())
    .filter((l) => l && !/^nada\.?$/i.test(l))
    .slice(0, 20);
  return { texto: final, cortes, uso };
}
