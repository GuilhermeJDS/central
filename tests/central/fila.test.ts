/** Item 4: fila de produção — limite por conta, limite global, rodízio e teto. */
import assert from "node:assert/strict";
import { test } from "node:test";

import { FilaCheia, FilaPorConta } from "@/lib/central/fila";

const dormir = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

test("nunca passa do limite por conta nem do global", async () => {
  const fila = new FilaPorConta(2, 5, 100);
  const agora = new Map<string, number>();
  let global = 0;
  let picoGlobal = 0;
  const picoConta = new Map<string, number>();
  const trabalhos: Promise<void>[] = [];
  for (let c = 0; c < 10; c++)
    for (let i = 0; i < 6; i++) {
      const conta = `c${c}`;
      trabalhos.push(
        fila.entrar(conta, async () => {
          global++;
          agora.set(conta, (agora.get(conta) ?? 0) + 1);
          picoGlobal = Math.max(picoGlobal, global);
          picoConta.set(conta, Math.max(picoConta.get(conta) ?? 0, agora.get(conta)!));
          await dormir(2 + Math.random() * 5);
          agora.set(conta, agora.get(conta)! - 1);
          global--;
        }),
      );
    }
  await Promise.all(trabalhos);
  assert.ok(picoGlobal <= 5, `pico global ${picoGlobal}`);
  assert.equal(picoGlobal, 5);
  for (const [conta, p] of picoConta) assert.ok(p <= 2, `${conta} chegou a ${p}`);
  assert.deepEqual(fila.estatisticas(), { rodando: 0, esperando: 0, picoRodando: 5, picoPorConta: 2, concluidas: 60 });
});

test("rodízio: uma conta com muitos pedidos não passa na frente das outras", async () => {
  const fila = new FilaPorConta(1, 1, 100);
  const ordem: string[] = [];
  const t: Promise<void>[] = [];
  // A conta "gulosa" entra primeiro com 5 pedidos; depois chegam 3 contas com 1.
  for (let i = 0; i < 5; i++) t.push(fila.entrar("gulosa", async () => void ordem.push("gulosa")));
  for (const c of ["a", "b", "c"]) t.push(fila.entrar(c, async () => void ordem.push(c)));
  await Promise.all(t);
  // As três contas pequenas saem antes do 3º pedido da gulosa.
  assert.deepEqual(ordem.slice(0, 5).sort(), ["a", "b", "c", "gulosa", "gulosa"].sort());
});

test("teto de espera por conta: recusa com motivo para o dono, as outras contas seguem", async () => {
  const fila = new FilaPorConta(1, 1, 2);
  let soltar!: () => void;
  const preso = new Promise<void>((ok) => (soltar = ok));
  const primeiro = fila.entrar("x", () => preso);
  const esperando = [fila.entrar("x", async () => {}), fila.entrar("x", async () => {})];
  await assert.rejects(fila.entrar("x", async () => {}), FilaCheia);
  const outra = fila.entrar("y", async () => "ok");
  soltar();
  await Promise.all([primeiro, ...esperando]);
  assert.equal(await outra, "ok");
});

test("erro de um trabalho não trava a fila nem vaza para outra conta", async () => {
  const fila = new FilaPorConta(1, 1, 10);
  const falha = fila.entrar("a", async () => {
    throw new Error("boom");
  });
  const ok = fila.entrar("b", async () => "b");
  await assert.rejects(falha, /boom/);
  assert.equal(await ok, "b");
  assert.equal(fila.estatisticas().rodando, 0);
});
