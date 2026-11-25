/**
 * Ficha do Negócio: o que os chefes sabem de cada negócio (uma por Account).
 *
 * SEGURANÇA: o `accountId` sempre vem de quem chama no servidor (sessão
 * autenticada), NUNCA do formulário/corpo da requisição. Os `dados` não têm
 * campo accountId e qualquer campo desconhecido é descartado pelo zod.
 */
import "server-only";

import { z } from "zod";

import type { FichaNegocio } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

const LIMITE_CURTO = 120;
const LIMITE_LINK = 300;
const LIMITE_TEXTO = 4000;

/** String opcional: vazio/só espaços vira null. */
function opcional(max: number) {
  return z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));
}

export const fichaNegocioSchema = z
  .object({
    nomeNegocio: z.string().trim().min(1).max(LIMITE_CURTO),
    cidade: z.string().trim().min(1).max(LIMITE_CURTO),
    oQueVende: z.string().trim().min(1).max(LIMITE_TEXTO),
    paraQuem: z.string().trim().min(1).max(LIMITE_TEXTO),
    objetivo: z.enum(["MAIS_CLIENTES", "MAIS_VENDAS", "ORGANIZAR", "OUTRO"]),
    objetivoOutro: opcional(LIMITE_CURTO * 2),
    instagram: opcional(LIMITE_LINK),
    site: opcional(LIMITE_LINK),
    google: opcional(LIMITE_LINK),
    youtube: opcional(LIMITE_LINK),
    linkedin: opcional(LIMITE_LINK),
    x: opcional(LIMITE_LINK),
    comoFala: opcional(LIMITE_TEXTO),
    naoQuer: opcional(LIMITE_TEXTO),
    origem: z.enum(["MANUAL", "RASTRO"]).default("MANUAL"),
  })
  .refine((d) => d.objetivo !== "OUTRO" || !!d.objetivoOutro, {
    message: "Conte qual é o objetivo.",
    path: ["objetivoOutro"],
  })
  .transform((d) => ({
    ...d,
    objetivoOutro: d.objetivo === "OUTRO" ? d.objetivoOutro : null,
  }));

export type DadosFichaNegocio = z.input<typeof fichaNegocioSchema>;

export async function obterFicha(accountId: string): Promise<FichaNegocio | null> {
  return prisma.fichaNegocio.findUnique({ where: { accountId } });
}

/** Valida e grava (upsert por accountId). Lança ZodError se os dados forem inválidos. */
export async function salvarFicha(
  accountId: string,
  dados: DadosFichaNegocio,
): Promise<FichaNegocio> {
  const valido = fichaNegocioSchema.parse(dados);
  return prisma.fichaNegocio.upsert({
    where: { accountId },
    create: { ...valido, accountId },
    update: valido,
  });
}
