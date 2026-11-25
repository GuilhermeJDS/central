/**
 * Pedidos aos chefes em segundo plano: cria a execução, põe o trabalho na
 * fila da conta (lib/central/fila: limite por conta + global, roda depois da
 * resposta) e devolve um ticket para a tela consultar o status.
 *
 * SEGURANÇA: accountId sempre da sessão (quem chama passa o de exigirCentral).
 */
import "server-only";

import { CONSELHO } from "@/lib/chefes/conselho";
import { EDITORA_PAUTA } from "@/lib/chefes/editora-pauta";
import { compararVizinhos } from "@/lib/chefes/inspetor-rastro";
import { lerRotina } from "@/lib/chefes/gerente-rotina";
import { mensagemDeErro } from "@/lib/chefes/chamar-modelo";
import type { AcaoCardapio } from "@/lib/chefes/cardapio";
import { rodarChefe, rodarSkillDireta, type Anterior, type ConfigChefe } from "@/lib/chefes/motor";
import { NEGOCIADOR_TRATO } from "@/lib/chefes/negociador-trato";
import type { Ticket } from "@/lib/central/dados";
import type { AcaoRede, AreaRede } from "@/lib/central/redes-areas";
import { FilaCheia, filaCentral } from "@/lib/central/fila";
import { emSegundoPlano } from "@/lib/central/segundo-plano";
import { criarExecucao, falharExecucao } from "@/lib/skills/execucoes";

const CONFIGS: Record<string, ConfigChefe> = {
  [EDITORA_PAUTA.nome]: EDITORA_PAUTA,
  [NEGOCIADOR_TRATO.nome]: NEGOCIADOR_TRATO,
  [CONSELHO.nome]: CONSELHO,
};

/**
 * Põe o trabalho na fila da conta (limite por conta + global) e roda depois
 * da resposta. Fila cheia: a execução falha com o motivo para o dono.
 */
function naFila(accountId: string, rotulo: string, execucaoId: string | null, trabalho: () => Promise<unknown>): void {
  emSegundoPlano(async () => {
    try {
      await filaCentral.entrar(accountId, trabalho);
    } catch (e) {
      console.error(`[central] ${rotulo} falhou: ${mensagemDeErro(e)}`);
      if (execucaoId && e instanceof FilaCheia) await falharExecucao(accountId, execucaoId, e.message).catch(() => {});
    }
  });
}

export function codificarTicket(t: Ticket): string {
  return Buffer.from(JSON.stringify(t)).toString("base64url");
}

/** Ticket vindo da URL; quem consulta valida o formato de novo. */
export function decodificarTicket(s: string | undefined): unknown {
  if (!s) return null;
  try {
    return JSON.parse(Buffer.from(s, "base64url").toString("utf-8"));
  } catch {
    return null;
  }
}

export function chefeAtendePedido(chefe: string): boolean {
  return Object.prototype.hasOwnProperty.call(CONFIGS, chefe);
}

/**
 * Dispara o chefe. Para chefes de pedido livre, cria a execução CHEFE aqui
 * (opcionalmente filha de `execucaoPaiId`). Gerente Rotina e Inspetor Rastro
 * não recebem pedido livre: fazem uma nova leitura.
 */
export async function dispararChefe(
  accountId: string,
  chefe: string,
  pedido: string,
  execucaoPaiId?: string,
): Promise<Ticket> {
  const config = CONFIGS[chefe];
  if (config) {
    const exec = await criarExecucao({
      accountId,
      departamento: config.departamento,
      chefe: config.nome,
      tipo: "CHEFE",
      execucaoPaiId: execucaoPaiId ?? null,
      entrada: { pedido, imagens: 0, origem: "central" },
    });
    naFila(accountId, chefe, exec.id, () => rodarChefe(config, accountId, pedido, undefined, { execucaoChefeId: exec.id }));
    return { tipo: "chefe", execucaoId: exec.id };
  }

  const desde = Date.now();
  if (chefe === "Gerente Rotina") {
    naFila(accountId, "Gerente Rotina", null, () => lerRotina(accountId));
    return { tipo: "leitura", chefe, desde };
  }
  if (chefe === "Inspetor Rastro") {
    naFila(accountId, "Inspetor Rastro", null, () => compararVizinhos(accountId, { ignorarCache: true }));
    return { tipo: "leitura", chefe, desde };
  }
  throw new Error(`Chefe desconhecido: ${chefe}`);
}

/**
 * Botão de uma área das Redes: a Editora Pauta roda a skill da rede direto.
 * O formato e a rede ficam na entrada (a produção usa ao aprovar).
 */
/** O pedido da ação com o texto que o dono colou (comentários, rascunho, transcrição). */
export function pedidoComTexto(pedido: string, texto?: string): string {
  const t = texto?.trim();
  return t ? `${pedido}\n\n<texto_do_dono>\n${t.slice(0, 12000)}\n</texto_do_dono>` : pedido;
}

export async function dispararSkillDireta(accountId: string, area: AreaRede, acao: AcaoRede, texto?: string): Promise<Ticket> {
  const exec = await criarExecucao({
    accountId,
    departamento: EDITORA_PAUTA.departamento,
    chefe: EDITORA_PAUTA.nome,
    tipo: "CHEFE",
    entrada: {
      pedido: `${area.nome}: ${acao.rotulo}`,
      imagens: 0,
      origem: "area",
      rede: area.rede,
      acao: `area-${area.slug}-${acao.id}`,
      repositorio: acao.repositorio,
      skill: acao.skill,
      ...(acao.formato ? { formato: acao.formato } : {}),
    },
  });
  naFila(accountId, `área ${area.slug}/${acao.id}`, exec.id, () =>
    rodarSkillDireta(
      EDITORA_PAUTA,
      accountId,
      { repositorio: acao.repositorio, skill: acao.skill, entrada: pedidoComTexto(acao.pedido, texto), busca: acao.busca },
      exec.id,
    ),
  );
  return { tipo: "chefe", execucaoId: exec.id };
}

export function configDoChefe(chefe: string): ConfigChefe | null {
  return Object.prototype.hasOwnProperty.call(CONFIGS, chefe) ? CONFIGS[chefe] : null;
}

/**
 * Uma ação do cardápio (Trato, Conselho): roda a skill direto, sem o chefe
 * escolher. Com `anterior`, continua um trabalho (encadeamento) e a corrente
 * fica gravada na execução.
 */
export async function dispararAcaoCardapio(
  accountId: string,
  chefe: string,
  acao: AcaoCardapio,
  anterior?: Anterior,
  texto?: string,
): Promise<Ticket> {
  const config = configDoChefe(chefe);
  if (!config) throw new Error(`Chefe sem cardápio: ${chefe}`);
  const exec = await criarExecucao({
    accountId,
    departamento: config.departamento,
    chefe: config.nome,
    tipo: "CHEFE",
    entrada: {
      pedido: anterior ? `${acao.rotulo} (a partir de: ${anterior.cadeia.at(-1)?.rotulo ?? "trabalho anterior"})` : acao.rotulo,
      imagens: 0,
      origem: anterior ? "cadeia" : "cardapio",
      acao: `cardapio-${acao.id}`,
      repositorio: acao.repositorio,
      skill: acao.skill,
      ...(acao.formato ? { formato: acao.formato } : {}),
      ...(anterior ? { cadeia: anterior.cadeia } : {}),
    },
  });
  naFila(accountId, `cardápio ${chefe}/${acao.id}`, exec.id, () =>
    rodarSkillDireta(
      config,
      accountId,
      { repositorio: acao.repositorio, skill: acao.skill, entrada: pedidoComTexto(acao.pedido, texto) },
      exec.id,
      anterior,
    ),
  );
  return { tipo: "chefe", execucaoId: exec.id };
}
