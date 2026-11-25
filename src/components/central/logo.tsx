import { Mascote } from "@/components/central/mascote";

/** Logo da Central: o mascote (parado) e o nome em Bricolage. */
export function LogoCentral({ tamanho = 30, vivo = false }: { tamanho?: number; vivo?: boolean }) {
  return (
    <span className="cx-logo-central">
      <Mascote id="central" tamanho={tamanho} parado={!vivo} />
      <span className="cx-logo-central-nome" style={{ fontSize: Math.round(tamanho * 0.8) }}>
        central
      </span>
    </span>
  );
}
