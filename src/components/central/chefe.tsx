/**
 * Identidade dos chefes na Central (DESIGN.md 6.8): cor via data-chefe +
 * var(--chefe) (globals.css) e símbolo de CHEFES_PAINEL. Módulo puro.
 */
import { Mascote } from "@/components/central/mascote";

import { CHEFES_PAINEL, type IdChefe } from "@/lib/chefes/identidade";

const POR_NOME: Record<string, IdChefe> = Object.fromEntries(
  Object.values(CHEFES_PAINEL).map((c) => [c.nome, c.id]),
) as Record<string, IdChefe>;

export function idDoChefe(nome: string): IdChefe {
  return POR_NOME[nome] ?? "norte";
}

export function SimboloCx({ id, tamanho = 20, className }: { id: IdChefe; tamanho?: number; className?: string }) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={CHEFES_PAINEL[id].simbolo} />
    </svg>
  );
}

/** Quem tem mascote: os chefes e o Revisor (marca/mascotes/definicoes.json). */
export type IdRetrato = IdChefe | "revisor";

export function idDoRetrato(nome: string): IdRetrato {
  return /revisor/i.test(nome) ? "revisor" : idDoChefe(nome);
}

/**
 * Retrato do chefe: o mascote dele (components/central/mascote). Decorativo
 * por padrão (o nome sempre vem ao lado); `rotulo` quando aparece sozinho.
 * A partir de 48px ele ganha vida (pisca e olha para o cursor).
 */
export function RetratoChefe({
  nome,
  tamanho = 96,
  className,
  rotulo,
  estado,
}: {
  nome: string;
  tamanho?: number;
  className?: string;
  rotulo?: string;
  /** Sem uso: mantido para as chamadas antigas. */
  prioridade?: boolean;
  estado?: "idle" | "thinking" | "working" | "waiting" | "blocked" | "done";
}) {
  const id = idDoRetrato(nome);
  return (
    <span className={className ? `cx-retrato ${className}` : "cx-retrato"} data-chefe={id}>
      <Mascote id={id} tamanho={tamanho} rotulo={rotulo} estado={estado} />
    </span>
  );
}

/**
 * Marca do chefe: o retrato dele num quadrado na cor dele (DESIGN.md 6.8).
 * Já define data-chefe. Toda seção que mostra o que um chefe fez usa esta marca.
 */
export function MarcaChefe({ nome, tamanho = 36 }: { nome: string; tamanho?: number }) {
  const id = idDoRetrato(nome);
  return (
    <span className="cx-marca-chefe cx-marca-chefe--retrato" data-chefe={id} style={{ width: tamanho, height: tamanho }} aria-hidden="true">
      <RetratoChefe nome={nome} tamanho={Math.round(tamanho * 0.86)} />
    </span>
  );
}

/** Chip com o mascote + nome do chefe, na cor dele. */
export function ChipChefe({ nome }: { nome: string }) {
  const id = idDoRetrato(nome);
  return (
    <span className="cx-chip cx-chip--chefe" data-chefe={id}>
      <span className="cx-chip-rosto" aria-hidden="true">
        <RetratoChefe nome={nome} tamanho={26} />
      </span>
      {nome}
    </span>
  );
}

/** Concordância: "a Editora Pauta" é feminino; os outros chefes, masculino. */
const FEMININO = new Set<string>(["Editora Pauta"]);
export const doChefe = (nome: string) => `${FEMININO.has(nome) ? "da" : "do"} ${nome}`;
export const aoChefe = (nome: string) => `${FEMININO.has(nome) ? "à" : "ao"} ${nome}`;
