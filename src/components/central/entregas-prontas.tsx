/**
 * Entregas prontas de um departamento (ou de uma rede): a peça que o chefe
 * produziu depois do "Aprovar". Carrossel abre no editor; o resto, na página
 * da entrega. Enquanto alguma está em produção, a tela se atualiza sozinha.
 */
import {
  Clapperboard,
  FileText,
  GalleryHorizontalEnd,
  Heading,
  ImageIcon,
  ListOrdered,
  PenLine,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import { idDoChefe } from "@/components/central/chefe";
import { ProximoPasso } from "@/components/central/proximo-passo";
import { TextoLongo } from "@/components/central/texto-longo";
import { Corrente, VeioDe } from "@/components/central/veio-de";
import { VigiaProducao } from "@/components/central/vigia-producao";
import { EstadoTrabalho, TentarDeNovo } from "@/components/central/trabalho-producao";
import {
  emProducao,
  ROTULO_REDE,
  ROTULO_STATUS_TRABALHO,
  ROTULO_TIPO,
  type EntregaChefeView,
  type TipoEntrega,
} from "@/lib/central/entregas-tipos";

export const ICONE_TIPO: Record<TipoEntrega, LucideIcon> = {
  CARROSSEL: GalleryHorizontalEnd,
  ROTEIRO: Clapperboard,
  POST: PenLine,
  THREAD: ListOrdered,
  TITULO: Heading,
  THUMBNAIL: ImageIcon,
  TEXTO: FileText,
};

const fmtQuando = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "numeric", month: "short" });

export function linkDaEntrega(e: Pick<EntregaChefeView, "id" | "tipo" | "status">): string {
  return e.tipo === "CARROSSEL" && e.status === "PRONTA" ? `/central/redes/carrosseis/${e.id}` : `/central/entregas/${e.id}`;
}

export function EntregasProntas({
  entregas,
  titulo = "Entregas prontas",
  vazio,
}: {
  entregas: EntregaChefeView[];
  titulo?: string;
  /** Texto quando não há nada (sem ele, a seção some). */
  vazio?: string;
}) {
  if (!entregas.length && !vazio) return null;
  const produzindo = entregas.filter((e) => emProducao(e.status)).map((e) => e.id);

  return (
    <section className="cx-prontas" aria-labelledby="cx-prontas-t">
      <div className="cx-prontas-topo">
        <h2 id="cx-prontas-t" className="cx-prontas-titulo">
          {titulo}
        </h2>
        {entregas.length ? <span className="cx-prontas-conta">{entregas.length}</span> : null}
      </div>
      {produzindo.length ? <VigiaProducao ids={produzindo} /> : null}
      {entregas.length ? (
        <ul className="cx-prontas-lista">
          {entregas.map((e) => {
            const Icone = ICONE_TIPO[e.tipo] ?? FileText;
            const pronta = e.status === "PRONTA";
            return (
              <li key={e.id} className="cx-pronta" data-status={e.status.toLowerCase()} data-chefe={idDoChefe(e.chefe)}>
                <span className="cx-pronta-icone" aria-hidden="true">
                  <Icone size={22} strokeWidth={1.8} />
                </span>
                <div className="cx-pronta-corpo">
                  <p className="cx-pronta-tipo">
                    {ROTULO_TIPO[e.tipo]}
                    {e.rede ? ` · ${ROTULO_REDE[e.rede] ?? e.rede}` : ""}
                  </p>
                  <Link href={linkDaEntrega(e)} className="cx-pronta-titulo">
                    {e.titulo}
                  </Link>
                  {e.status === "ERRO" || emProducao(e.status) ? (
                    <EstadoTrabalho trabalho={e.trabalho} compacto />
                  ) : e.resumo ? (
                    <p className="cx-pronta-resumo">{e.resumo}</p>
                  ) : null}
                  {pronta && e.texto && e.texto.length > 140 ? (
                    <TextoLongo
                      titulo={e.titulo}
                      texto={e.texto}
                      chefe={e.chefe}
                      meta={ROTULO_TIPO[e.tipo]}
                      soBotao
                      className="cx-pronta-ver"
                    />
                  ) : null}
                  <VeioDe fontes={e.fontes} />
                  {e.cadeia?.length ? <Corrente cadeia={e.cadeia} /> : null}
                  {pronta && e.proxima && e.origemId ? <ProximoPasso execucaoId={e.origemId} proxima={e.proxima} /> : null}
                </div>
                <div className="cx-pronta-lado">
                  <span className={`cx-pronta-estado cx-pronta-estado--${e.status.toLowerCase()}`}>
                    {ROTULO_STATUS_TRABALHO[e.status]}
                  </span>
                  <time dateTime={e.em}>{fmtQuando.format(new Date(e.em))}</time>
                  {e.status === "ERRO" ? <TentarDeNovo id={e.id} /> : null}
                  <Link
                    href={linkDaEntrega(e)}
                    className={`cx-botao ${pronta ? "cx-botao--azul" : "cx-botao--suave"} cx-pronta-abrir`}
                    aria-label={`${e.tipo === "CARROSSEL" && pronta ? "Abrir no editor" : "Abrir"}: ${e.titulo}`}
                  >
                    {e.tipo === "CARROSSEL" && pronta ? "Abrir no editor" : "Abrir"}
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="cx-dica cx-prontas-vazio">{vazio}</p>
      )}
    </section>
  );
}
