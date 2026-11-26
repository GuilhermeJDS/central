import { ArrowRight, Check, Eye } from "lucide-react";
import Link from "next/link";

import { Mascote, type IdMascote } from "@/components/central/mascote";

export type PassoInicial = { id: string; mascote: IdMascote; titulo: string; texto: string; href: string; acao: string; feito: boolean; opcional?: boolean };

/** Início de uma conta nova: o que falta para a equipe começar, sem dado de exemplo. */
export function PrimeirosPassos({ passos, nomeNegocio }: { passos: PassoInicial[]; nomeNegocio: string }) {
  const feitos = passos.filter((p) => p.feito).length;
  const proximo = passos.find((p) => !p.feito);
  return (
    <section className="cx-pi-inicio">
      <div className="cx-painel cx-pi-topo">
        <Mascote id={proximo?.mascote ?? "central"} tamanho={96} estado={feitos === passos.length ? "done" : "idle"} humor="happy" />
        <div className="cx-pi-topo-texto">
          <p className="cx-pi-contagem">
            {feitos} de {passos.length} prontos
          </p>
          <h2 className="cx-pi-titulo">{proximo ? "A equipe está chegando." : "A equipe está pronta."}</h2>
          <p className="cx-dica">
            {proximo
              ? `Faltam ${passos.length - feitos} passos para os chefes começarem a trabalhar na ${nomeNegocio}. O próximo: ${proximo.titulo.charAt(0).toLowerCase()}${proximo.titulo.slice(1)}.`
              : "Peça o primeiro trabalho e ele chega em Decisões para você aprovar."}
          </p>
          <div className="cx-pi-barra" aria-hidden="true">
            <span style={{ width: `${(feitos / passos.length) * 100}%` }} />
          </div>
        </div>
      </div>

      <ol className="cx-pi-lista">
        {passos.map((p, i) => (
          <li key={p.id} className="cx-painel cx-pi-passo" data-feito={p.feito ? "true" : undefined} data-chefe={p.mascote === "central" ? undefined : p.mascote}>
            <span className="cx-pi-num" aria-hidden="true">
              {p.feito ? <Check size={16} strokeWidth={3} /> : i + 1}
            </span>
            <Mascote id={p.mascote} tamanho={44} parado />
            <div className="cx-pi-passo-texto">
              <strong>
                {p.titulo}
                {p.opcional ? <span className="cx-pi-opcional">opcional</span> : null}
              </strong>
              <span>{p.texto}</span>
            </div>
            {p.feito ? (
              <span className="cx-ob-selo" data-ok="true">
                pronto
              </span>
            ) : (
              <Link href={p.href} className={p.id === proximo?.id ? "cx-botao cx-botao--azul" : "cx-botao cx-botao--suave"}>
                {p.acao} <ArrowRight size={16} aria-hidden="true" />
              </Link>
            )}
          </li>
        ))}
      </ol>

      <Link href="/central?exemplo=1" className="cx-pi-exemplo">
        <Eye size={16} aria-hidden="true" /> Ver como fica a Central com dados de exemplo
      </Link>
    </section>
  );
}
