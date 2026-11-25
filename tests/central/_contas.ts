/**
 * Contas descartáveis para os testes da Central (banco local do .env).
 * Toda conta criada aqui leva o prefixo de e-mail e é apagada no fim.
 */

import { prisma } from "@/lib/prisma";

export const PREFIXO_TESTE = "teste-central-";

export async function criarConta(rotulo: string, opts: { trialDias?: number | null } = {}) {
  const trial = opts.trialDias === undefined ? 7 : opts.trialDias;
  return prisma.account.create({
    data: {
      nome: `Teste ${rotulo}`,
      email: `${PREFIXO_TESTE}${rotulo}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@exemplo.test`,
      senha: "x",
      accountType: "NICHO",
      trialExpiraEm: trial === null ? null : new Date(Date.now() + trial * 86_400_000),
    },
    select: { id: true, email: true },
  });
}

export async function apagarContasDeTeste() {
  await prisma.account.deleteMany({ where: { email: { startsWith: PREFIXO_TESTE } } });
}
