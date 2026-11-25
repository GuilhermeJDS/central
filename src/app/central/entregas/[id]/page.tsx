import Link from "next/link";
import { notFound } from "next/navigation";

import { CabecaPagina } from "@/components/central/cabeca";
import { ChipChefe } from "@/components/central/chefe";
import { CopiarTexto } from "@/components/central/copiar";
import { ICONE_TIPO } from "@/components/central/entregas-prontas";
import { RefazerEntrega } from "@/components/central/refazer-entrega";
import { VigiaProducao } from "@/components/central/vigia-producao";
import { EstadoTrabalho, TentarDeNovo } from "@/components/central/trabalho-producao";
import { departamentoPorEnum } from "@/lib/central/departamentos";
import { entregaView, obterEntrega, slidesDe } from "@/lib/central/entregas";
import { emProducao, ROTULO_REDE, ROTULO_TIPO } from "@/lib/central/entregas-tipos";

import { contexto } from "../../_lib/painel";

type Props = { params: Promise<{ id: string }> };

/** Divide a peça nas partes que a gente separou com "---" (posts da thread, ideias, títulos). */
function partes(texto: string): string[] {
  return texto
    .split(/^\s*-{3,}\s*$/m)
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * Entrega pronta. Estrutura dominante (DESIGN.md 6.2): a própria peça, como
 * folha pronta para copiar; thread e ideias viram blocos numerados.
 */
export default async function PaginaEntrega({ params }: Props) {
  const { id } = await params;
  const c = await contexto();
  if (!c) return null;
  if (!c.accountId) notFound();
  const linha = await obterEntrega(c.accountId, id);
  if (!linha) notFound();
  const e = entregaView(linha);
  const dep = departamentoPorEnum(linha.departamento);
  const Icone = ICONE_TIPO[e.tipo];
  const texto = linha.texto ?? "";
  const blocos = e.tipo === "THREAD" || e.tipo === "THUMBNAIL" || e.tipo === "TITULO" ? partes(texto) : [texto];
  const slides = slidesDe(linha.conteudo);
  const textoCopia =
    e.tipo === "CARROSSEL"
      ? slides.map((s, i) => `${i + 1}. ${s.titulo}\n${s.texto}`).join("\n\n") + (texto ? `\n\nLegenda:\n${texto}` : "")
      : texto;

  return (
    <>
      <CabecaPagina
        secao={`${dep?.nome ?? "Central"} · Entregas`}
        titulo={ROTULO_TIPO[e.tipo]}
        subtitulo={e.titulo}
        chip={<ChipChefe nome={e.chefe} />}
      >
        {e.status === "PRONTA" ? <CopiarTexto texto={textoCopia} rotulo="Copiar tudo" /> : null}
        {e.status === "PRONTA" && e.tipo === "CARROSSEL" ? (
          <Link href={`/central/redes/carrosseis/${e.id}`} className="cx-botao cx-botao--azul">
            Abrir no editor
          </Link>
        ) : null}
        {e.status === "PRONTA" ? <RefazerEntrega id={e.id} /> : null}
      </CabecaPagina>

      {emProducao(e.status) ? (
        <div className="cx-painel cx-folha-espera">
          <VigiaProducao ids={[e.id]} />
          <span className="cx-folha-espera-icone" aria-hidden="true">
            <Icone size={26} strokeWidth={1.8} />
          </span>
          <EstadoTrabalho trabalho={e.trabalho} />
        </div>
      ) : e.status === "ERRO" ? (
        <div className="cx-painel cx-folha-espera">
          <EstadoTrabalho trabalho={e.trabalho} />
          <TentarDeNovo id={e.id} classe="cx-botao cx-botao--azul" />
        </div>
      ) : (
        <article className="cx-folha" aria-label={ROTULO_TIPO[e.tipo]}>
          <p className="cx-folha-meta">
            <Icone size={18} strokeWidth={1.8} aria-hidden="true" />
            {ROTULO_TIPO[e.tipo]}
            {e.rede ? ` para ${ROTULO_REDE[e.rede] ?? e.rede}` : ""}
          </p>
          {e.tipo === "CARROSSEL" ? (
            <ol className="cx-folha-slides">
              {slides.map((s, i) => (
                <li key={s.id}>
                  <span className="cx-folha-num">{i + 1}</span>
                  <div>
                    <p className="cx-folha-slide-titulo">{s.titulo}</p>
                    <p>{s.texto}</p>
                    {s.imagemDica ? <p className="cx-folha-dica">Imagem: {s.imagemDica}</p> : null}
                  </div>
                </li>
              ))}
            </ol>
          ) : blocos.length > 1 ? (
            <ol className="cx-folha-blocos">
              {blocos.map((b, i) => (
                <li key={i}>
                  <span className="cx-folha-num">{i + 1}</span>
                  <div className="cx-folha-texto">
                    {b}
                    {e.tipo === "THREAD" ? (
                      <span className={`cx-folha-conta${b.length > 280 ? " cx-folha-conta--passou" : ""}`}>
                        {b.length}/280
                      </span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <div className="cx-folha-texto">{texto}</div>
          )}
          {e.tipo === "CARROSSEL" && texto ? (
            <div className="cx-folha-legenda">
              <p className="cx-folha-slide-titulo">Legenda</p>
              <div className="cx-folha-texto">{texto}</div>
            </div>
          ) : null}
        </article>
      )}
    </>
  );
}
