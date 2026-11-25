"use server";

/**
 * Ações da Central — Norte. accountId SEMPRE de contaCentral() (sessão no
 * servidor); ids vindos do cliente só servem para achar registros DENTRO da conta.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { contaCentral, contaCentralGeracao } from "@/app/central/_lib/sessao";
import { mensagemParaDono } from "@/lib/chefes/chamar-modelo";
import { departamentoPorChefe } from "@/lib/central/departamentos";
import { chefeAtendePedido, codificarTicket, dispararChefe } from "@/lib/central/disparar";
import { acaoDaSemana, type AcaoDaSemana } from "@/lib/chefes/norte";
import { acoesDaSemana, inicioDaSemana, MAX_ACOES_SEMANA } from "@/lib/central/dados";
import { prisma } from "@/lib/prisma";

export async function gerarAcaoDaSemanaAcao(): Promise<{ erro: string | null }> {
  let accountId: string;
  try {
    ({ accountId } = await contaCentralGeracao());
  } catch (e) {
    return { erro: mensagemParaDono(e, "Sem acesso agora.") };
  }
  const semana = await acoesDaSemana(accountId);
  if (semana.length >= MAX_ACOES_SEMANA) return { erro: `A semana já tem ${MAX_ACOES_SEMANA} ações.` };
  const r = await acaoDaSemana(
    accountId,
    semana.map((a) => a.acao.titulo),
  );
  if (r.status === "sem_ficha") return { erro: "Preencha a ficha primeiro." };
  if (r.status === "erro")
    return {
      erro: mensagemParaDono(
        new Error(r.mensagem),
        "O Norte não conseguiu pensar na semana agora. Tente de novo daqui a pouco.",
      ),
    };
  revalidatePath("/central");
  return { erro: null };
}

const escolhaNorteSchema = z.enum(["korely", "eu", "agora_nao"]);

export type ResultadoNorte = {
  erro: string | null;
  /** "Korely, faz": onde acompanhar o pedido que foi para o chefe. */
  acompanhar?: string | null;
};

export async function decidirNorteAcao(execucaoId: string, escolha: string): Promise<ResultadoNorte> {
  const opcao = escolhaNorteSchema.parse(escolha);
  let accountId: string;
  try {
    // "Korely faz" chama o modelo: precisa da chave de IA.
    ({ accountId } = opcao === "korely" ? await contaCentralGeracao() : await contaCentral());
  } catch (e) {
    return { erro: mensagemParaDono(e, "Sem acesso agora.") };
  }
  const exec = await prisma.execucaoSkill.findFirst({
    where: {
      id: String(execucaoId).slice(0, 64),
      accountId,
      chefe: "Norte",
      tipo: "CHEFE",
      status: "CONCLUIDA",
      acao: "acaoDaSemana",
    },
    select: { id: true, saida: true, decisao: true },
  });
  if (!exec?.saida) return { erro: "Ação não encontrada." };
  if (exec.decisao && exec.decisao !== "PENDENTE") return { erro: "Essa ação já foi decidida. Recarregue a página." };
  const acao = JSON.parse(exec.saida) as AcaoDaSemana;

  const { count } = await prisma.execucaoSkill.updateMany({
    where: { id: exec.id, accountId, OR: [{ decisao: null }, { decisao: "PENDENTE" }] },
    data: {
      decisao: opcao === "agora_nao" ? "PASSADA" : "APROVADA",
      decididaEm: new Date(),
      escolha: opcao === "agora_nao" ? null : opcao,
    },
  });
  if (count === 0) return { erro: null };

  if (opcao !== "korely") {
    revalidatePath("/central");
    return { erro: null };
  }

  // A Korely faz: o pedido vai para o chefe (em segundo plano) e o card
  // continua no Início, com "Mudar de ideia" e o link para acompanhar.
  const dep = departamentoPorChefe(acao.chefe);
  const ticket = await dispararChefe(
    accountId,
    acao.chefe,
    acao.pedidoParaChefe,
    chefeAtendePedido(acao.chefe) ? exec.id : undefined,
  );
  revalidatePath("/central", "layout");
  return { erro: null, acompanhar: dep ? `/central/${dep.slug}?t=${codificarTicket(ticket)}` : null };
}

/**
 * "Mudar de ideia": a ação volta a ficar aberta. Só nesta semana. Se a Korely
 * já tinha mandado o pedido ao chefe, ele segue (o trabalho vira uma decisão
 * normal na pilha); o que volta é a escolha.
 */
export async function desfazerNorteAcao(execucaoId: string): Promise<{ erro: string | null }> {
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
      chefe: "Norte",
      tipo: "CHEFE",
      decisao: { in: ["APROVADA", "PASSADA"] },
      concluidaEm: { gte: inicioDaSemana() },
    },
    data: { decisao: "PENDENTE", decididaEm: null, escolha: null },
  });
  revalidatePath("/central");
  return { erro: count ? null : "Essa ação já não dá para mudar." };
}
