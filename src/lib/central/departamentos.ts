/**
 * Departamentos que o cliente vê na Central (sem DIRETORIA e BASTIDOR).
 * Módulo puro: pode ser importado por componentes de cliente.
 */
import type { Departamento } from "@/generated/prisma/enums";

export type SlugDepartamento = "presenca" | "redes" | "vendas" | "estrategia" | "operacao";

export type InfoDepartamento = {
  slug: SlugDepartamento;
  departamento: Departamento;
  nome: string;
  chefe: string;
  /** Chefes que leem números (sem pedido livre): o botão pede uma nova leitura. */
  leitura: boolean;
};

export const DEPARTAMENTOS_CENTRAL: readonly InfoDepartamento[] = [
  { slug: "presenca", departamento: "PRESENCA", nome: "Presença", chefe: "Inspetor Rastro", leitura: true },
  { slug: "redes", departamento: "REDES", nome: "Redes", chefe: "Editora Pauta", leitura: false },
  { slug: "vendas", departamento: "VENDAS", nome: "Vendas", chefe: "Negociador Trato", leitura: false },
  { slug: "estrategia", departamento: "ESTRATEGIA", nome: "Estratégia", chefe: "Conselho", leitura: false },
  { slug: "operacao", departamento: "OPERACAO", nome: "Operação", chefe: "Gerente Rotina", leitura: true },
];

export function departamentoPorSlug(slug: string): InfoDepartamento | null {
  return DEPARTAMENTOS_CENTRAL.find((d) => d.slug === slug) ?? null;
}

export function departamentoPorChefe(chefe: string): InfoDepartamento | null {
  return DEPARTAMENTOS_CENTRAL.find((d) => d.chefe === chefe) ?? null;
}

export function departamentoPorEnum(dep: Departamento): InfoDepartamento | null {
  return DEPARTAMENTOS_CENTRAL.find((d) => d.departamento === dep) ?? null;
}
