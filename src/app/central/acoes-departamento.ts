"use server";

/**
 * Ações da Central — departamentos. accountId SEMPRE da sessão (contaCentral*; sessão no
 * servidor); ids vindos do cliente só servem para achar registros DENTRO da conta.
 */
import { z } from "zod";

import { contaCentralGeracao, contaCentralLeitura } from "@/app/central/_lib/sessao";
import { mensagemParaDono } from "@/lib/chefes/chamar-modelo";
import { statusPedido, type StatusPedido, type Ticket } from "@/lib/central/dados";
import { departamentoPorSlug } from "@/lib/central/departamentos";
import { codificarTicket, configDoChefe, dispararAcaoCardapio, dispararChefe, dispararSkillDireta } from "@/lib/central/disparar";
import { textosFinais } from "@/lib/central/dados";
import { nomeDaAcao } from "@/lib/central/nome-acao";
import { acaoDaExecucao, acaoDoCardapio, cadeiaDaEntrada, proximaDaExecucao } from "@/lib/chefes/cardapio";
import { departamentoPorChefe } from "@/lib/central/departamentos";
import { prisma } from "@/lib/prisma";
import { acaoDaArea, areaPorSlug } from "@/lib/central/redes-areas";
import { redesConectadas } from "@/lib/redes/contas";

const ticketSchema = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("chefe"), execucaoId: z.string().min(1).max(64) }),
  z.object({ tipo: z.literal("leitura"), chefe: z.enum(["Gerente Rotina", "Inspetor Rastro"]), desde: z.number() }),
]);

export async function pedirAoChefeAcao(
  slug: string,
  pedido: string,
): Promise<{ ticket: Ticket | null; erro: string | null }> {
  let accountId: string;
  try {
    ({ accountId } = await contaCentralGeracao());
  } catch (e) {
    return { ticket: null, erro: mensagemParaDono(e, "Sem acesso agora.") };
  }
  const dep = departamentoPorSlug(String(slug));
  if (!dep) return { ticket: null, erro: "Departamento não encontrado." };
  const texto = String(pedido ?? "").trim().slice(0, 2000);
  if (!dep.leitura && texto.length < 3) return { ticket: null, erro: "Escreva o que você precisa." };
  try {
    const ticket = await dispararChefe(accountId, dep.chefe, texto);
    return { ticket, erro: null };
  } catch (e) {
    console.error("[central] pedir ao chefe", e);
    return { ticket: null, erro: "Não deu para enviar agora. Tente de novo." };
  }
}

export async function statusPedidoAcao(ticket: unknown): Promise<StatusPedido> {
  const { accountId } = await contaCentralLeitura();
  const t = ticketSchema.safeParse(ticket);
  if (!t.success) return { estado: "falhou" };
  return statusPedido(accountId, t.data);
}

/** "Pedir análise agora" no topo do departamento: devolve o ticket já codificado para a URL. */
export async function pedirAnaliseAcao(slug: string): Promise<{ t: string | null; erro: string | null }> {
  const dep = departamentoPorSlug(String(slug));
  if (!dep) return { t: null, erro: "Departamento não encontrado." };
  const pedido = dep.leitura
    ? ""
    : `Faça uma análise de ${dep.nome} para esta semana: o que está funcionando, o que fazer agora e os próximos passos.`;
  const r = await pedirAoChefeAcao(dep.slug, pedido);
  if (!r.ticket) return { t: null, erro: r.erro ?? "Não deu para enviar agora." };
  return { t: codificarTicket(r.ticket), erro: null };
}

/** Botão de uma área das Redes (Instagram, YouTube, X, LinkedIn, TikTok). */
export async function gerarNaAreaAcao(
  slugRede: string,
  acaoId: string,
  texto?: string,
): Promise<{ ticket: Ticket | null; erro: string | null }> {
  let accountId: string;
  try {
    ({ accountId } = await contaCentralGeracao());
  } catch (e) {
    return { ticket: null, erro: mensagemParaDono(e, "Sem acesso agora.") };
  }
  const area = areaPorSlug(String(slugRede));
  const acao = area ? acaoDaArea(area, String(acaoId)) : null;
  if (!area || !acao) return { ticket: null, erro: "Ação não encontrada." };
  if (acao.precisa && !(await redesConectadas(accountId)).has(acao.precisa))
    return { ticket: null, erro: "Conecte esta rede em Conexões para usar." };
  const t = typeof texto === "string" ? texto.trim().slice(0, 12000) : "";
  if (acao.pedeTexto?.obrigatorio && t.length < 3) return { ticket: null, erro: `${acao.pedeTexto.rotulo} para gerar.` };
  try {
    return { ticket: await dispararSkillDireta(accountId, area, acao, t || undefined), erro: null };
  } catch (e) {
    console.error("[central] gerar na área", e);
    return { ticket: null, erro: "Não deu para enviar agora. Tente de novo." };
  }
}

/** Botão do cardápio de um chefe (Trato, Conselho): roda a skill da ação direto. */
export async function gerarDoCardapioAcao(
  chefe: string,
  acaoId: string,
  texto?: string,
): Promise<{ ticket: Ticket | null; erro: string | null }> {
  let accountId: string;
  try {
    ({ accountId } = await contaCentralGeracao());
  } catch (e) {
    return { ticket: null, erro: mensagemParaDono(e, "Sem acesso agora.") };
  }
  const acao = acaoDoCardapio(String(chefe), String(acaoId));
  if (!acao || !configDoChefe(String(chefe))) return { ticket: null, erro: "Ação não encontrada." };
  const t = typeof texto === "string" ? texto.trim().slice(0, 12000) : "";
  if (acao.pedeTexto?.obrigatorio && t.length < 3) return { ticket: null, erro: `${acao.pedeTexto.rotulo} para gerar.` };
  try {
    return { ticket: await dispararAcaoCardapio(accountId, String(chefe), acao, undefined, t || undefined), erro: null };
  } catch (e) {
    console.error("[central] cardápio", e);
    return { ticket: null, erro: "Não deu para enviar agora. Tente de novo." };
  }
}

/**
 * "Próximo passo" de um trabalho pronto: o servidor acha a ação seguinte no
 * cardápio (pode ser de outro chefe) e roda com o trabalho anterior junto.
 * Devolve para onde ir (o departamento do próximo chefe, com o ticket).
 */
export async function continuarTrabalhoAcao(execucaoId: string): Promise<{ href: string | null; erro: string | null }> {
  let accountId: string;
  try {
    ({ accountId } = await contaCentralGeracao());
  } catch (e) {
    return { href: null, erro: mensagemParaDono(e, "Sem acesso agora.") };
  }
  const exec = await prisma.execucaoSkill.findFirst({
    where: { id: String(execucaoId).slice(0, 64), accountId, tipo: "SKILL", status: "CONCLUIDA" },
    select: {
      id: true,
      chefe: true,
      repositorio: true,
      skill: true,
      saida: true,
      titulo: true,
      entrada: true,
      execucaoPai: { select: { entrada: true } },
    },
  });
  if (!exec) return { href: null, erro: "Trabalho não encontrado." };
  const acaoId = (exec.execucaoPai?.entrada as { acao?: string } | null)?.acao ?? null;
  const prox = proximaDaExecucao(exec.chefe, exec.repositorio, exec.skill, acaoId);
  if (!prox) return { href: null, erro: "Este trabalho não tem próximo passo." };
  const atual = acaoDaExecucao(exec.chefe, exec.repositorio, exec.skill, acaoId);
  const saida = (await textosFinais([{ id: exec.id, saida: exec.saida }])).get(exec.id) ?? exec.saida ?? "";
  const cadeia = [
    ...cadeiaDaEntrada(exec.entrada),
    {
      chefe: exec.chefe,
      repositorio: exec.repositorio ?? "",
      skill: exec.skill ?? "",
      rotulo: atual?.rotulo ?? nomeDaAcao(exec.repositorio, exec.skill),
      execucaoId: exec.id,
    },
  ];
  try {
    const ticket = await dispararAcaoCardapio(accountId, prox.chefe, prox.acao, { cadeia, saida });
    const dep = departamentoPorChefe(prox.chefe);
    return { href: `/central/${dep?.slug ?? ""}?t=${codificarTicket(ticket)}`, erro: null };
  } catch (e) {
    console.error("[central] continuar trabalho", e);
    return { href: null, erro: "Não deu para enviar agora. Tente de novo." };
  }
}
