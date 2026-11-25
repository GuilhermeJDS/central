"use server";

/**
 * Ações da Central — ficha. accountId SEMPRE de contaCentral() (sessão no
 * servidor); ids vindos do cliente só servem para achar registros DENTRO da conta.
 */
import { revalidatePath } from "next/cache";
import { z, ZodError } from "zod";

import { contaCentral, contaCentralGeracao } from "@/app/central/_lib/sessao";
import { chamarModelo, extrairJson, mensagemParaDono, usoDe } from "@/lib/chefes/chamar-modelo";
import { salvarFicha, type DadosFichaNegocio } from "@/lib/negocio/ficha";
import { deEtiquetas } from "@/lib/negocio/ficha-etiquetas";
import { concluirExecucao, criarExecucao, falharExecucao, marcarRodando } from "@/lib/skills/execucoes";

export type EstadoFicha = {
  ok: boolean;
  erros: Record<string, string>;
  mensagem: string;
  /** O que foi enviado: o formulário volta com isso (React limpa o form após a ação). */
  valores?: Record<string, string>;
};

const CAMPOS_FICHA = [
  "nomeNegocio",
  "cidade",
  "oQueVende",
  "paraQuem",
  "objetivo",
  "objetivoOutro",
  "instagram",
  "site",
  "google",
  "youtube",
  "linkedin",
  "x",
  "comoFala",
  "naoQuer",
] as const;

const MENSAGEM_CAMPO: Record<string, string> = {
  nomeNegocio: "Escreva o nome do negócio.",
  cidade: "Escreva a cidade.",
  oQueVende: "Conte o que você vende.",
  paraQuem: "Conte para quem você vende.",
  objetivo: "Escolha um objetivo.",
  objetivoOutro: "Conte qual é o objetivo.",
};

export async function salvarFichaAcao(_prev: EstadoFicha, form: FormData): Promise<EstadoFicha> {
  const { accountId } = await contaCentral();
  const dados: Record<string, string> = {};
  for (const c of CAMPOS_FICHA) dados[c] = String(form.get(c) ?? "");
  try {
    // origem não vem do formulário: preenchida à mão é MANUAL.
    await salvarFicha(accountId, { ...dados, origem: "MANUAL" } as DadosFichaNegocio);
  } catch (e) {
    if (e instanceof ZodError) {
      const erros: Record<string, string> = {};
      for (const i of e.issues) {
        const campo = String(i.path[0] ?? "");
        if (campo && !erros[campo]) erros[campo] = MENSAGEM_CAMPO[campo] ?? "Confira este campo.";
      }
      return { ok: false, erros, mensagem: "Faltou alguma coisa. Veja os campos marcados.", valores: dados };
    }
    console.error("[central] salvar ficha", e);
    return { ok: false, erros: {}, mensagem: "Não deu para salvar agora. Tente de novo.", valores: dados };
  }
  revalidatePath("/central", "layout");
  return { ok: true, erros: {}, mensagem: "Ficha salva.", valores: dados };
}

/** Prontuário: grava a ficha inteira (o cliente manda tudo a cada campo salvo). */
export async function salvarFichaDadosAcao(dados: Record<string, string>): Promise<EstadoFicha> {
  const form = new FormData();
  for (const c of CAMPOS_FICHA) form.set(c, typeof dados[c] === "string" ? dados[c] : "");
  return salvarFichaAcao({ ok: false, erros: {}, mensagem: "" }, form);
}

// ---------------------------------------------------------------------------
// Colar contexto: a IA distribui um texto livre nos capítulos da ficha
// ---------------------------------------------------------------------------

const LIMITE_COLADO = 20_000;

export type CampoProposta = "nomeNegocio" | "cidade" | "site" | "objetivo" | "objetivoOutro" | "oQueVende" | "paraQuem" | "comoFala" | "naoQuer";
export type ResultadoContexto = { ok: true; proposta: Partial<Record<CampoProposta, string>> } | { ok: false; erro: string };

const texto = (max: number) => z.string().trim().max(max).optional().catch(undefined);
const respostaSchema = z.object({
  nomeNegocio: texto(120),
  cidade: texto(120),
  site: texto(300),
  objetivo: z.enum(["MAIS_CLIENTES", "MAIS_VENDAS", "ORGANIZAR", "OUTRO"]).optional().catch(undefined),
  objetivoOutro: texto(240),
  servicos: z.array(z.string().trim().max(160)).max(40).optional().catch(undefined),
  publicos: z.array(z.string().trim().max(160)).max(20).optional().catch(undefined),
  comoFala: texto(4000),
  naoQuer: texto(4000),
});

const SISTEMA_CONTEXTO = `Você organiza a ficha de um pequeno negócio brasileiro. Recebe a ficha atual e um texto que o dono colou (normalmente um resumo que ele pediu ao ChatGPT ou ao Claude sobre a empresa).
Distribua o que o texto diz nos campos da ficha. Regras:
- Só inclua um campo se o texto trouxer informação nova ou melhor para ele. Não invente nada que o texto não diga.
- servicos: a lista COMPLETA de serviços/produtos (os atuais que continuam valendo + os novos), cada item curto (2 a 6 palavras), sem preço.
- publicos: a lista COMPLETA de públicos, cada item curto (até 8 palavras).
- comoFala: como o negócio fala com os clientes (tom, jeito), em 1 a 3 frases.
- naoQuer: o que o negócio não quer de jeito nenhum (palavras, temas, promessas), em 1 a 3 frases.
- objetivo: só se o texto deixar claro; um de MAIS_CLIENTES, MAIS_VENDAS, ORGANIZAR, OUTRO (com objetivoOutro).
- Português do Brasil, sem emoji, sem markdown.
Responda SÓ com um objeto JSON com as chaves que mudarem, entre: nomeNegocio, cidade, site, objetivo, objetivoOutro, servicos, publicos, comoFala, naoQuer.`;

export async function distribuirContextoFichaAcao(atual: Record<string, string>, colado: string): Promise<ResultadoContexto> {
  const t = typeof colado === "string" ? colado.trim() : "";
  if (t.length < 40) return { ok: false, erro: "Cole um texto um pouco maior sobre o negócio." };
  if (t.length > LIMITE_COLADO) return { ok: false, erro: "O texto é grande demais. Cole até 20 mil caracteres." };
  let accountId: string;
  try {
    ({ accountId } = await contaCentralGeracao());
  } catch (e) {
    return { ok: false, erro: mensagemParaDono(e, "Sem acesso agora.") };
  }
  const ficha = Object.fromEntries(
    (["nomeNegocio", "cidade", "site", "objetivo", "objetivoOutro", "oQueVende", "paraQuem", "comoFala", "naoQuer"] as const).map((c) => [
      c,
      typeof atual?.[c] === "string" ? atual[c].slice(0, 4000) : "",
    ]),
  );
  const ex = await criarExecucao({
    accountId,
    departamento: "DIRETORIA",
    chefe: "Norte",
    tipo: "CHEFE",
    skill: "ficha-colar-contexto",
    entrada: { caracteres: t.length },
  });
  try {
    await marcarRodando(accountId, ex.id);
    const r = await chamarModelo(
      accountId,
      SISTEMA_CONTEXTO,
      `FICHA ATUAL:\n${JSON.stringify(ficha, null, 1)}\n\nTEXTO COLADO:\n${t}`,
      { maxTokens: 2000, timeoutMs: 90_000, chefe: "Norte" },
    );
    const bruto = respostaSchema.parse(extrairJson(r.texto));
    const proposta: Partial<Record<CampoProposta, string>> = {};
    for (const c of ["nomeNegocio", "cidade", "site", "objetivo", "objetivoOutro", "comoFala", "naoQuer"] as const) {
      const v = bruto[c];
      if (v && v !== ficha[c]) proposta[c] = v;
    }
    if (bruto.servicos?.length) {
      const v = deEtiquetas(bruto.servicos);
      if (v !== ficha.oQueVende) proposta.oQueVende = v;
    }
    if (bruto.publicos?.length) {
      const v = deEtiquetas(bruto.publicos);
      if (v !== ficha.paraQuem) proposta.paraQuem = v;
    }
    await concluirExecucao(accountId, ex.id, {
      saida: JSON.stringify(proposta, null, 1),
      titulo: "Contexto colado na ficha",
      ...usoDe(r),
    });
    return { ok: true, proposta };
  } catch (e) {
    await falharExecucao(accountId, ex.id, e instanceof Error ? e.message : String(e)).catch(() => {});
    return { ok: false, erro: mensagemParaDono(e, "Não deu para ler o texto agora. Tente de novo daqui a pouco.") };
  }
}
