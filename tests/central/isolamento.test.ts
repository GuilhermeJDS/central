/**
 * Item 4: toda leitura e escrita da Central é filtrada pela conta. A conta A
 * nunca enxerga nem mexe no que é da conta B, mesmo sabendo os ids.
 */
import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { obterEntrega, listarEntregas } from "@/lib/central/entregas";
import { linhaDoTempo, statusPedido, todasDecisoes } from "@/lib/central/dados";
import { listarPecas, obterPecaDetalhe, salvarNovaVersao, tornarPrincipal } from "@/lib/central/estudio/pecas";
import { agendarProducao, reproduzirEntrega } from "@/lib/central/producao";
import { destravarPresos } from "@/lib/central/producao-trabalho";
import { prisma } from "@/lib/prisma";
import { concluirExecucao, criarExecucao, falharExecucao } from "@/lib/skills/execucoes";

import { apagarContasDeTeste, criarConta } from "./_contas";

let A: string;
let B: string;
let pecaB: string;
let presaB: string;
let execB: string;
let decisaoB: string;

before(async () => {
  await apagarContasDeTeste();
  A = (await criarConta("iso-a")).id;
  B = (await criarConta("iso-b")).id;
  // B: uma decisão pendente, uma aprovada, uma peça pronta e uma presa na fila.
  const chefeB = await criarExecucao({ accountId: B, departamento: "REDES", chefe: "Editora Pauta", tipo: "CHEFE", entrada: { pedido: "segredo-de-B" } });
  const skillB = await criarExecucao({
    accountId: B, departamento: "REDES", chefe: "Editora Pauta", tipo: "SKILL",
    repositorio: "instagram", skill: "ig-carousel", execucaoPaiId: chefeB.id, entrada: { pedido: "segredo-de-B" },
  });
  await concluirExecucao(B, skillB.id, { saida: "carrossel secreto de B", modelo: "simulado", tokensEntrada: 1, tokensSaida: 1 });
  decisaoB = skillB.id;
  const aprovadaB = await criarExecucao({
    accountId: B, departamento: "REDES", chefe: "Editora Pauta", tipo: "SKILL",
    repositorio: "instagram", skill: "ig-carousel", execucaoPaiId: chefeB.id, entrada: {},
  });
  await prisma.execucaoSkill.update({ where: { id: aprovadaB.id }, data: { status: "CONCLUIDA", decisao: "APROVADA", saida: "x" } });
  execB = aprovadaB.id;
  pecaB = (
    await prisma.entregaChefe.create({
      data: { accountId: B, departamento: "REDES", chefe: "Editora Pauta", execucaoOrigemId: `t-${Date.now()}-b`, tipo: "CARROSSEL", rede: "INSTAGRAM", titulo: "Peça de B", status: "PRONTA", etapa: "EM_REVISAO" },
    })
  ).id;
});

after(async () => {
  await apagarContasDeTeste();
  await prisma.$disconnect();
});

test("listas de A não trazem nada de B", async () => {
  assert.equal((await listarPecas(A)).length, 0);
  assert.equal((await listarEntregas(A)).length, 0);
  assert.equal((await todasDecisoes(A)).length, 0);
  assert.ok(!(await linhaDoTempo(A)).some((e) => JSON.stringify(e).includes("segredo-de-B")));
  // Sanidade: B enxerga o que é dela.
  assert.ok((await listarPecas(B)).some((p) => p.id === pecaB));
});

test("A não abre peça, entrega nem status de B pelo id", async () => {
  assert.equal(await obterPecaDetalhe(A, pecaB), null);
  assert.equal(await obterEntrega(A, pecaB), null);
  const s = await statusPedido(A, { tipo: "chefe", execucaoId: decisaoB });
  assert.notEqual(s.estado, "concluida");
});

test("A não escreve em B: versão, principal, refazer, produção e execução", async () => {
  const versoesAntes = await prisma.versaoEntrega.count({ where: { entregaId: pecaB } });
  assert.equal(await salvarNovaVersao(A, pecaB, { descricao: "invasão", texto: "x" }), null);
  assert.equal(await tornarPrincipal(A, pecaB, "qualquer"), false);
  assert.equal(await reproduzirEntrega(A, pecaB), false);
  assert.equal(await agendarProducao(A, execB), null);
  await assert.rejects(falharExecucao(A, decisaoB, "invasão"));
  await assert.rejects(criarExecucao({ accountId: A, departamento: "REDES", chefe: "Editora Pauta", tipo: "SKILL", execucaoPaiId: decisaoB, entrada: {} }));
  const peca = await prisma.entregaChefe.findUniqueOrThrow({ where: { id: pecaB } });
  assert.equal(peca.status, "PRONTA");
  assert.equal(await prisma.versaoEntrega.count({ where: { entregaId: pecaB } }), versoesAntes);
  const exec = await prisma.execucaoSkill.findUniqueOrThrow({ where: { id: decisaoB } });
  assert.equal(exec.status, "CONCLUIDA");
});

test("destravar presos de A não mexe na fila de B", async () => {
  presaB = (
    await prisma.entregaChefe.create({
      data: {
        accountId: B, departamento: "REDES", chefe: "Editora Pauta", execucaoOrigemId: `t-${Date.now()}-b2`, tipo: "POST", rede: "INSTAGRAM",
        titulo: "Presa de B", status: "NA_FILA", producaoPrazo: new Date(Date.now() - 60_000),
      },
    })
  ).id;
  assert.equal(await destravarPresos(A), 0);
  assert.equal((await prisma.entregaChefe.findUniqueOrThrow({ where: { id: presaB } })).status, "NA_FILA");
  assert.equal(await destravarPresos(B), 1);
});
