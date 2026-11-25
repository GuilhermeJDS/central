/**
 * Peças comuns das páginas de departamento: o topo do chefe (retrato, nome,
 * frase e o pedido logo ali) e o "Esperando o seu sim" (o que ele fez e
 * espera a aprovação, com o texto cortado e "Ver tudo").
 */
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { RetratoChefe, idDoChefe } from "@/components/central/chefe";
import { TextoLongo } from "@/components/central/texto-longo";
import type { DecisaoView } from "@/components/central/tipos";

const fmtQuando = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "numeric", month: "short" });

export function TopoChefe({
  secao,
  titulo,
  chefe,
  frase,
  acoes,
  children,
}: {
  secao: string;
  /** Título grande (padrão: o nome da seção). */
  titulo?: string;
  chefe: string;
  frase: string;
  /** Controles à direita (período, pedir análise). */
  acoes?: ReactNode;
  /** O "Pedir ao chefe" com os chips. */
  children: ReactNode;
}) {
  return (
    <section className="cx-topo-chefe entra" data-chefe={idDoChefe(chefe)} aria-labelledby="cx-topo-chefe-t">
      <div className="cx-topo-chefe-palco" aria-hidden="true">
        <RetratoChefe nome={chefe} tamanho={216} className="cx-topo-chefe-retrato" prioridade />
      </div>
      <header className="cx-topo-chefe-cabeca">
        <div className="cx-topo-chefe-textos">
          <p className="cx-sobrelinha">
            <span aria-hidden="true" className="cx-traco" />
            Central · {secao}
          </p>
          <h1 id="cx-topo-chefe-t" className="cx-titulo cx-topo-chefe-titulo">
            {titulo ?? secao}
            <span className="cx-ponto">.</span>
          </h1>
          <p className="cx-topo-chefe-quem">
            <strong>{chefe}</strong>
            <span aria-hidden="true"> · </span>
            {frase}
          </p>
        </div>
        {acoes ? <div className="cx-topo-chefe-acoes">{acoes}</div> : null}
      </header>
      <div className="cx-topo-chefe-pedir">{children}</div>
    </section>
  );
}

const VISIVEIS = 6;

/** O que o chefe fez e espera o sim do dono: card com o texto cortado e "Ver tudo". */
export function EsperandoSim({ itens, exemplo }: { itens: DecisaoView[]; exemplo: boolean }) {
  const pendentes = itens.filter((d) => d.estado === "pendente");
  if (!pendentes.length) return null;
  return (
    <section className="cx-esperando" aria-labelledby="cx-esperando-t">
      <div className="cx-prontas-topo">
        <h2 id="cx-esperando-t" className="cx-prontas-titulo">
          Esperando o seu sim
        </h2>
        <span className="cx-prontas-conta">{pendentes.length}</span>
        {pendentes.length > VISIVEIS ? (
          <Link href="/central/decisoes" className="cx-pp-link cx-esperando-todas">
            Ver todas em Decisões
            <ArrowUpRight size={15} strokeWidth={2} aria-hidden="true" />
          </Link>
        ) : null}
      </div>
      <ul className="cx-esperando-grade">
        {pendentes.slice(0, VISIVEIS).map((d) => (
          <li key={d.id} className="cx-esperando-card">
            <TextoLongo
              titulo={d.titulo}
              texto={d.conteudo || d.porQue || d.titulo}
              chefe={d.chefe}
              meta={<time dateTime={d.em}>{fmtQuando.format(new Date(d.em))}</time>}
              aprovarId={d.id}
              exemplo={exemplo || d.id.startsWith("ex-")}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
