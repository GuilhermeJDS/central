"use server";

/**
 * Ações da Central — decisões. accountId SEMPRE de contaCentral() (sessão no
 * servidor); ids vindos do cliente só servem para achar registros DENTRO da conta.
 */
import { contaCentral, contaCentralGeracao } from "@/app/central/_lib/sessao";
import { decidirExecucao, decisaoSchema, type ResultadoDecisao } from "@/lib/central/decidir";
import { mensagemParaDono } from "@/lib/chefes/chamar-modelo";
import { prisma } from "@/lib/prisma";

export type { ResultadoDecisao };

export async function decidirAcao(
  execucaoId: string,
  decisao: string,
  ajuste?: string,
): Promise<ResultadoDecisao> {
  const escolha = decisaoSchema.parse(decisao);
  const textoAjuste = String(ajuste ?? "").trim().slice(0, 2000);
  if (escolha === "AJUSTAR" && textoAjuste.length < 3) return { erro: "Conte o que mudar." };
  let accountId: string;
  try {
    // "Quase?" manda o chefe refazer: precisa da chave de IA.
    ({ accountId } = escolha === "AJUSTAR" ? await contaCentralGeracao() : await contaCentral());
  } catch (e) {
    return { erro: mensagemParaDono(e, "Sem acesso agora.") };
  }
  // Sem revalidatePath: a fila anda no cliente e o contador ("3 de 7") se mantém.
  const r = await decidirExecucao(accountId, execucaoId, escolha, textoAjuste);
  return { erro: r.erro, producao: r.producao, destino: r.destino };
}

/**
 * "Voltar" da pilha: devolve para PENDENTE uma decisão de aprovar/passar
 * feita há pouco (30 min). Ajuste não volta: o chefe já começou a refazer.
 */
export async function desfazerDecisaoAcao(execucaoId: string): Promise<{ erro: string | null }> {
  let accountId: string;
  try {
    ({ accountId } = await contaCentral());
  } catch (e) {
    return { erro: mensagemParaDono(e, "Sem acesso agora.") };
  }
  const { count } = await prisma.execucaoSkill.updateMany({
    where: {
      id: String(execucaoId).slice(0, 64),
      accountId,
      tipo: "SKILL",
      decisao: { in: ["APROVADA", "PASSADA"] },
      decididaEm: { gte: new Date(Date.now() - 30 * 60_000) },
    },
    data: { decisao: "PENDENTE", decididaEm: null },
  });
  // Desfez a aprovação: a peça que nasceu dela sai de Entregas.
  if (count) await prisma.entregaChefe.deleteMany({ where: { accountId, execucaoOrigemId: String(execucaoId).slice(0, 64) } });
  return { erro: count ? null : "Essa decisão já não dá para desfazer." };
}
