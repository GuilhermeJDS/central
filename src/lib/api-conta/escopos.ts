/**
 * Escopos de uma chave da conta. Módulo puro: a tela de Conexões usa também.
 * leitura: ler decisões, entregas, execuções e o status dos pedidos.
 * decisoes: aprovar, passar ou pedir ajuste de uma entrega.
 * pedidos: pedir trabalho a um chefe (usa a chave de IA da conta).
 * redes: o agente manda perfil, seguidores e posts das redes (sem API oficial).
 * numeros: o agente informa os números do mês (faturamento, atendimentos…).
 * publicar: o agente lê a fila de peças aprovadas e marca o que publicou.
 */
export const ESCOPOS_CONTA = [
  { id: "leitura", rotulo: "Ler", descricao: "Decisões, entregas, execuções e o status dos pedidos." },
  { id: "decisoes", rotulo: "Decidir", descricao: "Aprovar, passar ou pedir ajuste de uma entrega." },
  { id: "pedidos", rotulo: "Pedir", descricao: "Pedir trabalho a um chefe, com a sua chave de IA." },
  { id: "redes", rotulo: "Redes", descricao: "Mandar perfil, seguidores, posts e métricas das redes, sem API oficial." },
  { id: "numeros", rotulo: "Números", descricao: "Informar os números do mês: faturamento, atendimentos, clientes." },
  { id: "publicar", rotulo: "Publicar", descricao: "Ler a fila de peças aprovadas e marcar o que foi publicado." },
] as const;

export type EscopoConta = (typeof ESCOPOS_CONTA)[number]["id"];

export const IDS_ESCOPO_CONTA: readonly EscopoConta[] = ESCOPOS_CONTA.map((e) => e.id);

export function ehEscopoConta(v: string): v is EscopoConta {
  return (IDS_ESCOPO_CONTA as readonly string[]).includes(v);
}

/** Escopos guardados na chave (coluna JSON: lista de textos). */
export function escoposDe(chave: { escopos: unknown }): EscopoConta[] {
  return Array.isArray(chave.escopos) ? chave.escopos.filter((e): e is EscopoConta => typeof e === "string" && ehEscopoConta(e)) : [];
}
