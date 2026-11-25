/**
 * Identidade fixa de cada chefe no painel da unidade: nome, departamento e
 * símbolo (traço de 24px, o mesmo da Central). A cor vem do CSS
 * (globals.css, [data-chefe="..."]) para acompanhar os temas claro/escuro.
 * Módulo puro: pode ir para componente de cliente.
 */
import type { Departamento } from "@/generated/prisma/enums";

export type IdChefe = "rastro" | "pauta" | "trato" | "conselho" | "rotina" | "norte";

export type IdentidadeChefe = {
  id: IdChefe;
  nome: string;
  departamento: Departamento;
  /** Path SVG (viewBox 24, stroke). */
  simbolo: string;
};

export const CHEFES_PAINEL: Record<IdChefe, IdentidadeChefe> = {
  rastro: {
    id: "rastro",
    nome: "Inspetor Rastro",
    departamento: "PRESENCA",
    simbolo:
      "M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  },
  pauta: {
    id: "pauta",
    nome: "Editora Pauta",
    departamento: "REDES",
    simbolo: "M4 5h16v11H8l-4 4V5zM8 9.5h8M8 12.5h5",
  },
  trato: {
    id: "trato",
    nome: "Negociador Trato",
    departamento: "VENDAS",
    simbolo: "M4 19V10M10 19V5M16 19v-7M22 19H2",
  },
  conselho: {
    id: "conselho",
    nome: "Conselho",
    departamento: "ESTRATEGIA",
    simbolo: "M12 3v3M12 18v3M3 12h3M18 12h3M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  },
  rotina: {
    id: "rotina",
    nome: "Gerente Rotina",
    departamento: "OPERACAO",
    simbolo:
      "M8 3v3M16 3v3M4 8h16M5 5.5h14a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1zM8 12.5h3M8 16h6",
  },
  norte: {
    id: "norte",
    nome: "Norte",
    departamento: "DIRETORIA",
    simbolo: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15.5 8.5l-2 5-5 2 2-5 5-2z",
  },
};
