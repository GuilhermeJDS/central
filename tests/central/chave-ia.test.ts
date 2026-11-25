/**
 * Item 3: a Central só usa a chave do próprio cliente. Nunca a da Korely,
 * nem com ANTHROPIC_API_KEY no ambiente.
 */
import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { podeGerarChefes } from "@/lib/central/liberacao";
import { cifrar } from "@/lib/ia/cofre";
import { credencialDaConta, SemChaveIA } from "@/lib/ia/credencial";
import { prisma } from "@/lib/prisma";

import { apagarContasDeTeste, criarConta } from "./_contas";

before(async () => {
  process.env.ANTHROPIC_API_KEY ||= "sk-ant-korely-de-mentira";
  await apagarContasDeTeste();
});
after(async () => {
  await apagarContasDeTeste();
  await prisma.$disconnect();
});

test("sem chave conectada: SemChaveIA, mesmo com a chave da Korely no ambiente", async () => {
  const c = await criarConta("sem-chave");
  await assert.rejects(credencialDaConta(c.id), SemChaveIA);
  await assert.rejects(credencialDaConta(c.id, "Editora Pauta"), SemChaveIA);
  assert.equal(await podeGerarChefes(c.id, { liberado: true }), false);
});

test("com chave do cliente: usa a do cliente; a de outra conta não vale", async () => {
  const dona = await criarConta("com-chave");
  const outra = await criarConta("vizinha");
  await prisma.chaveIa.create({
    data: { accountId: dona.id, provedor: "OPENAI", chaveCifrada: cifrar("sk-cliente-1234"), ultimos4: "1234", modelo: "gpt-x", validaEm: new Date() },
  });
  const cred = await credencialDaConta(dona.id);
  assert.equal(cred.origem, "cliente");
  assert.equal(cred.chave, "sk-cliente-1234");
  assert.equal(await podeGerarChefes(dona.id, { liberado: true }), true);
  assert.equal(await podeGerarChefes(dona.id, { liberado: false }), false);
  await assert.rejects(credencialDaConta(outra.id), SemChaveIA);
});

test("chave salva mas não testada não conta", async () => {
  const c = await criarConta("nao-testada");
  await prisma.chaveIa.create({
    data: { accountId: c.id, provedor: "ANTHROPIC", chaveCifrada: cifrar("sk-ant-x"), ultimos4: "xxxx", modelo: "m", validaEm: null },
  });
  await assert.rejects(credencialDaConta(c.id), SemChaveIA);
});
