import Link from "next/link";

import { RetratoChefe, idDoChefe } from "@/components/central/chefe";
import type { PulsoView } from "@/components/central/tipos";

export function quandoRelativo(iso: string | null, agora: number): string {
  if (!iso) return "nunca entregou";
  const h = Math.floor((agora - new Date(iso).getTime()) / 3_600_000);
  if (h < 1) return "agora há pouco";
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "ontem" : `há ${d} dias`;
}

// ---------------------------------------------------------------------------
// Equipe de chefes: cada um na sua cor, com o que fez no período em número
// ---------------------------------------------------------------------------

export function EquipeChefes({ estados, agora, dias }: { estados: PulsoView; agora: number; dias: number }) {
  return (
    <section className="cx-equipe" aria-labelledby="cx-equipe-t">
      <h2 id="cx-equipe-t" className="cx-secao-titulo">
        A equipe {dias === 7 ? "nesta semana" : `nos últimos ${dias} dias`}
      </h2>
      <ul className="cx-equipe-lista">
        {estados.map((e) => (
          <li key={e.slug} data-chefe={idDoChefe(e.chefe)}>
            <Link href={`/central/${e.slug}`} className="cx-chefe-card">
              <span className="cx-chefe-card-palco" aria-hidden="true">
                <RetratoChefe nome={e.chefe} tamanho={148} className="cx-chefe-card-retrato" prioridade />
              </span>
              <span className="cx-chefe-card-corpo">
                <span className="cx-chefe-card-nomes">
                  <span className="cx-chefe-card-nome">{e.chefe}</span>
                  <span className="cx-chefe-card-dep">{e.nome}</span>
                </span>
                <span className="cx-chefe-card-numero">
                  <strong>{e.entregas.toLocaleString("pt-BR")}</strong>
                  <span>{e.entregas === 1 ? "entrega" : "entregas"}</span>
                </span>
                <MiniSemana pontos={e.semana} chefe={e.chefe} />
                <span className="cx-chefe-card-rodape">
                  {e.pendentes ? (
                    <span className="cx-chefe-card-espera">{e.pendentes} esperando você</span>
                  ) : (
                    <span>
                      <span className={`cx-pulso-ponto cx-pulso-ponto--${e.estado}`} aria-hidden="true" />
                      {quandoRelativo(e.ultima, agora)}
                    </span>
                  )}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Sete barras finas: o que o chefe entregou em cada dia da semana (hoje à direita). */
function MiniSemana({ pontos, chefe }: { pontos: number[]; chefe: string }) {
  const max = Math.max(1, ...pontos);
  const total = pontos.reduce((s, n) => s + n, 0);
  return (
    <span className="cx-mini-semana" role="img" aria-label={`${chefe}: ${total} ${total === 1 ? "entrega" : "entregas"} nos últimos 7 dias`}>
      {pontos.map((n, i) => (
        <span
          key={i}
          className="cx-mini-semana-barra"
          data-hoje={i === pontos.length - 1 ? "true" : undefined}
          data-vazio={n === 0 ? "true" : undefined}
          style={{ height: n ? `${Math.max(18, Math.round((n / max) * 100))}%` : undefined }}
        />
      ))}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Gráfico de linha (Operação)
// ---------------------------------------------------------------------------

export function GraficoLinha({ pontos, rotulo }: { pontos: number[]; rotulo: string }) {
  const L = 300;
  const A = 90;
  const max = Math.max(1, ...pontos);
  const passo = pontos.length > 1 ? L / (pontos.length - 1) : L;
  const xy = pontos.map((p, i) => [i * passo, A - 6 - (p / max) * (A - 14)] as const);
  const linha = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${linha} L${L},${A} L0,${A} Z`;
  return (
    <svg className="cx-grafico" viewBox={`0 0 ${L} ${A}`} preserveAspectRatio="none" role="img" aria-label={rotulo}>
      <defs>
        <linearGradient id="cx-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--cx-graf, #2f6af7)" stopOpacity="0.22" />
          <stop offset="1" stopColor="var(--cx-graf, #2f6af7)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#cx-area)" />
      <path d={linha} fill="none" stroke="var(--cx-graf, #2f6af7)" strokeWidth="2.2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
