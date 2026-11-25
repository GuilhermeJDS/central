/**
 * Ligação entre departamentos: "veio do Inspetor Rastro", "veio da Editora
 * Pauta". Chip na cor do chefe que forneceu o insumo (DESIGN.md 6.8).
 */
import { ChipChefe, doChefe } from "@/components/central/chefe";

export type FonteView = { chefe: string; titulo: string };

export function VeioDe({ fontes, rotulo = "veio" }: { fontes: FonteView[]; rotulo?: string }) {
  const unicos = fontes.filter((f, i, a) => a.findIndex((x) => x.chefe === f.chefe) === i);
  if (!unicos.length) return null;
  return (
    <p className="cx-veio-de">
      {unicos.map((f) => (
        <span key={f.chefe} className="cx-veio-de-item" title={f.titulo || undefined}>
          <span className="cx-veio-de-texto">{rotulo} {doChefe(f.chefe).split(" ")[0]}</span>
          <ChipChefe nome={f.chefe} />
        </span>
      ))}
    </p>
  );
}

/** Norte: quem ele juntou na ação da semana. */
export function JuntouDe({ fontes }: { fontes: FonteView[] }) {
  const unicos = fontes.filter((f, i, a) => a.findIndex((x) => x.chefe === f.chefe) === i);
  if (!unicos.length) return null;
  return (
    <p className="cx-veio-de cx-veio-de--norte">
      <span className="cx-veio-de-texto">Juntou o trabalho de</span>
      {unicos.map((f) => (
        <span key={f.chefe} className="cx-veio-de-item" title={f.titulo || undefined}>
          <ChipChefe nome={f.chefe} />
        </span>
      ))}
    </p>
  );
}

export type EloView = { chefe: string; rotulo: string; quem: string };

/**
 * Corrente de trabalho (encadeamento): "veio do Conselho · Oferta irrecusável →
 * Negociador Trato · Página da oferta". Cada elo na cor do chefe que fez.
 */
export function Corrente({ cadeia }: { cadeia: EloView[] }) {
  if (!cadeia.length) return null;
  return (
    <p className="cx-corrente">
      <span className="cx-veio-de-texto">veio de</span>
      {cadeia.map((e, i) => (
        <span key={i} className="cx-corrente-elo">
          {i ? (
            <span className="cx-corrente-seta" aria-label="depois">
              →
            </span>
          ) : null}
          <ChipChefe nome={e.chefe} />
          <span className="cx-corrente-rotulo">
            {e.quem !== e.chefe.split(" ")[0] && e.quem !== e.chefe ? `${e.quem} · ` : ""}
            {e.rotulo}
          </span>
        </span>
      ))}
    </p>
  );
}
