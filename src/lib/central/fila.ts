/**
 * Fila de produção da Central: tudo que chama o modelo em segundo plano
 * (produção de peça, pedido ao chefe, ação de área/cardápio) passa por aqui.
 *
 * - Limite por conta: uma conta não ocupa mais que `porConta` vagas ao mesmo
 *   tempo; o resto espera a vez dela.
 * - Limite global: o servidor não roda mais que `global` trabalhos juntos.
 *   Cada trabalho passa quase todo o tempo esperando o provedor (chave do
 *   cliente), por isso o padrão é alto (128): no teste de carga (npm run
 *   carga:central) 100 contas ao mesmo tempo esperam ~0,5 s no p95; com 24
 *   esperavam 14 s.
 * - Rodízio justo: quando abre vaga, a próxima é da conta que está há mais
 *   tempo sem rodar (uma conta com 30 pedidos não passa na frente das outras).
 * - Teto de espera por conta: passou de `maxEsperando`, o pedido é recusado
 *   com motivo para o dono, em vez de crescer sem fim.
 *
 * Em memória: o PM2 roda uma instância só. Se o processo cair, o que estava
 * esperando vira ERRO pelo prazo (producao-trabalho.destravarPresos).
 * A fila só guarda a conta como chave de vez; cada trabalho já leva o
 * accountId da sessão e nunca enxerga o de outra conta.
 */

export class FilaCheia extends Error {
  constructor() {
    super("Os chefes já têm muitos pedidos seus na fila. Espere alguns terminarem e tente de novo.");
    this.name = "FilaCheia";
  }
}

type Tarefa = { iniciar: () => void };

export type EstatisticasFila = {
  rodando: number;
  esperando: number;
  picoRodando: number;
  picoPorConta: number;
  concluidas: number;
};

export class FilaPorConta {
  private rodando = 0;
  private readonly rodandoDaConta = new Map<string, number>();
  /** Ordem de inserção = ordem do rodízio (conta servida vai para o fim). */
  private readonly esperandoDaConta = new Map<string, Tarefa[]>();
  private picoRodando = 0;
  private picoPorConta = 0;
  private concluidas = 0;

  constructor(
    readonly porConta: number,
    readonly global: number,
    readonly maxEsperando: number,
  ) {
    if (porConta < 1 || global < 1) throw new Error("Limites da fila precisam ser ≥ 1");
  }

  /** Roda `trabalho` quando houver vaga para a conta. */
  entrar<T>(accountId: string, trabalho: () => Promise<T>): Promise<T> {
    const fila = this.esperandoDaConta.get(accountId) ?? [];
    if (fila.length >= this.maxEsperando) return Promise.reject(new FilaCheia());
    return new Promise<T>((resolver, rejeitar) => {
      fila.push({
        iniciar: () => {
          this.rodando++;
          const n = (this.rodandoDaConta.get(accountId) ?? 0) + 1;
          this.rodandoDaConta.set(accountId, n);
          this.picoRodando = Math.max(this.picoRodando, this.rodando);
          this.picoPorConta = Math.max(this.picoPorConta, n);
          // A vaga é liberada antes de devolver o resultado: quem espera o
          // trabalho já encontra a fila no estado certo.
          const liberar = () => {
            this.rodando--;
            const m = (this.rodandoDaConta.get(accountId) ?? 1) - 1;
            if (m > 0) this.rodandoDaConta.set(accountId, m);
            else this.rodandoDaConta.delete(accountId);
            this.concluidas++;
            this.bombear();
          };
          Promise.resolve()
            .then(trabalho)
            .then(
              (v) => {
                liberar();
                resolver(v);
              },
              (e: unknown) => {
                liberar();
                rejeitar(e);
              },
            );
        },
      });
      this.esperandoDaConta.set(accountId, fila);
      this.bombear();
    });
  }

  /** Quantos pedidos desta conta estão esperando vaga (não conta os rodando). */
  esperandoDe(accountId: string): number {
    return this.esperandoDaConta.get(accountId)?.length ?? 0;
  }

  estatisticas(): EstatisticasFila {
    let esperando = 0;
    for (const f of this.esperandoDaConta.values()) esperando += f.length;
    return { rodando: this.rodando, esperando, picoRodando: this.picoRodando, picoPorConta: this.picoPorConta, concluidas: this.concluidas };
  }

  private bombear(): void {
    while (this.rodando < this.global) {
      let escolhida: string | null = null;
      for (const [conta, fila] of this.esperandoDaConta) {
        if (fila.length && (this.rodandoDaConta.get(conta) ?? 0) < this.porConta) {
          escolhida = conta;
          break;
        }
      }
      if (!escolhida) return;
      const fila = this.esperandoDaConta.get(escolhida)!;
      const tarefa = fila.shift()!;
      // Conta servida vai para o fim do rodízio.
      this.esperandoDaConta.delete(escolhida);
      if (fila.length) this.esperandoDaConta.set(escolhida, fila);
      tarefa.iniciar();
    }
  }
}

function numeroDoAmbiente(nome: string, padrao: number): number {
  const n = Number(process.env[nome]);
  return Number.isInteger(n) && n > 0 ? n : padrao;
}

const g = globalThis as unknown as { __filaCentral?: FilaPorConta };

/** A fila do processo (sobrevive ao recarregar do `next dev`). */
export const filaCentral: FilaPorConta =
  g.__filaCentral ??
  (g.__filaCentral = new FilaPorConta(
    numeroDoAmbiente("CENTRAL_FILA_POR_CONTA", 2),
    numeroDoAmbiente("CENTRAL_FILA_GLOBAL", 128),
    numeroDoAmbiente("CENTRAL_FILA_MAX_ESPERANDO", 30),
  ));
