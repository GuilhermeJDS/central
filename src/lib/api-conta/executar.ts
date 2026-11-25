import "server-only";

import { limiteEstourado } from "@/lib/limite-taxa";

import { ErroConta, podeUsar, validar, type AcaoConta, type ContextoConta } from "./acoes";
import { chaveContaDoCabecalho } from "./chaves";

/** Por chave, por minuto. Pedidos aos chefes contam nas duas. */
export const LIMITE_CONTA_POR_MINUTO = 60;
export const LIMITE_CONTA_PESADAS_POR_MINUTO = 6;
const MINUTO = 60_000;

/** Chave do `Authorization: Bearer cen_…`; sem ela, 401. */
export async function autenticarConta(req: Request): Promise<ContextoConta> {
  const chave = await chaveContaDoCabecalho(req.headers.get("authorization"));
  if (!chave)
    throw new ErroConta(401, "chave_invalida", "Mande a chave da conta em Authorization: Bearer cen_… (Central › Conexões › API e MCP).");
  return { accountId: chave.accountId, chave };
}

/** Escopo, limite de taxa, validação e execução. */
export async function executarAcaoConta(ctx: ContextoConta, acao: AcaoConta, bruto: unknown): Promise<unknown> {
  if (!podeUsar(ctx.chave, acao))
    throw new ErroConta(403, "sem_escopo", `Esta chave não tem o escopo "${acao.escopo}" para ${acao.nome}.`);
  if (limiteEstourado("api-conta", ctx.chave.id, LIMITE_CONTA_POR_MINUTO, MINUTO))
    throw new ErroConta(429, "limite", `Limite de ${LIMITE_CONTA_POR_MINUTO} chamadas por minuto. Tente de novo em instantes.`);
  if (acao.pesada && limiteEstourado("api-conta-pesada", ctx.accountId, LIMITE_CONTA_PESADAS_POR_MINUTO, MINUTO))
    throw new ErroConta(429, "limite", `Limite de ${LIMITE_CONTA_PESADAS_POR_MINUTO} pedidos aos chefes por minuto.`);
  const args = validar(acao, bruto);
  return acao.executar(ctx, args);
}
