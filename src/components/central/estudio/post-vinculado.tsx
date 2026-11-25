"use client";

/**
 * Vínculo da peça com o post real da conta conectada: escolher o post
 * ("Vincular ao post"), ver os números (alcance contra a média da conta,
 * visualizações, engajamento, curtidas, comentários, salvos e
 * compartilhamentos, com mini-gráfico) e "Ver post" / "Trocar vínculo".
 */
import { ExternalLink, Link2, LoaderCircle, PlugZap, RefreshCw, Unlink } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { desvincularPostAcao, listarPostsAcao, numerosPostAcao, vincularPostAcao } from "@/app/central/acoes-estudio";
import { ChipVariacao } from "@/components/central/cabeca";
import type { PecaDetalhe } from "@/lib/central/estudio/pecas";
import type { ChaveMetrica, NumerosPost, PostConta } from "@/lib/central/estudio/posts";

const fmtCompacto = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const fmtInteiro = new Intl.NumberFormat("pt-BR");
const fmtDia = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "numeric", month: "short" });

const ROTULO: Record<ChaveMetrica, string> = {
  alcance: "Alcance",
  visualizacoes: "Visualizações",
  curtidas: "Curtidas",
  comentarios: "Comentários",
  salvamentos: "Salvos",
  compartilhamentos: "Compartilhamentos",
};

function num(v: number | undefined): string {
  if (v === undefined) return "—";
  return v >= 10_000 ? fmtCompacto.format(v) : fmtInteiro.format(Math.round(v));
}

function variacao(v: number | undefined, media: number | undefined): number | null {
  if (v === undefined || !media) return null;
  return Math.round(((v - media) / media) * 1000) / 10;
}

/** Barras dos últimos posts; o vinculado na cor do chefe, a média tracejada. */
function MiniGrafico({ n }: { n: NumerosPost }) {
  const W = 280;
  const H = 72;
  const max = Math.max(1, ...n.serie.map((s) => s.valor));
  const media = n.media[n.serieMetrica];
  const passo = W / Math.max(1, n.serie.length);
  const larg = Math.max(4, Math.min(18, passo - 6));
  const este = n.serie.findIndex((s) => s.este);
  return (
    <figure className="cx-mini-grafico">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${ROTULO[n.serieMetrica]} dos últimos ${n.serie.length} posts${este >= 0 ? `; este é o ${este + 1}º` : ""}.`}
      >
        {n.serie.map((s, i) => {
          const h = Math.max(2, (s.valor / max) * (H - 6));
          return (
            <rect
              key={s.id}
              x={i * passo + (passo - larg) / 2}
              y={H - h}
              width={larg}
              height={h}
              rx={2}
              className={s.este ? "cx-mini-barra cx-mini-barra--este" : "cx-mini-barra"}
            />
          );
        })}
        {media ? (
          <line x1={0} x2={W} y1={H - (media / max) * (H - 6)} y2={H - (media / max) * (H - 6)} className="cx-mini-media" />
        ) : null}
      </svg>
      <figcaption className="cx-pp-meta">
        {ROTULO[n.serieMetrica]} dos últimos {n.serie.length} posts · tracejado = média
      </figcaption>
    </figure>
  );
}

function Numeros({ n }: { n: NumerosPost }) {
  const m = n.post.metricas;
  const principal: ChaveMetrica = typeof m.alcance === "number" ? "alcance" : "visualizacoes";
  const v = variacao(m[principal], n.media[principal]);
  const outros: ChaveMetrica[] = (["visualizacoes", "curtidas", "comentarios", "salvamentos", "compartilhamentos"] as const).filter(
    (k) => k !== principal,
  );
  return (
    <div className="cx-numeros-post">
      <div className="cx-numeros-post-topo">
        <p className="cx-numeros-rotulo">{ROTULO[principal]}</p>
        <p className="cx-numeros-grande">
          {num(m[principal])}
          <ChipVariacao valor={v} />
        </p>
        <p className="cx-pp-meta">
          {n.media[principal] !== undefined
            ? `Média da conta: ${num(n.media[principal])} (${n.base} posts)`
            : "A rede ainda não mandou a média."}
        </p>
      </div>
      <dl className="cx-numeros-grade">
        <div>
          <dt>Engajamento</dt>
          <dd>
            {n.engajamento !== null ? `${(n.engajamento * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "—"}
            {n.engajamento !== null && n.engajamentoMedio ? (
              <ChipVariacao valor={Math.round(((n.engajamento - n.engajamentoMedio) / n.engajamentoMedio) * 1000) / 10} />
            ) : null}
          </dd>
        </div>
        {outros.map((k) => (
          <div key={k}>
            <dt>{ROTULO[k]}</dt>
            <dd>{num(m[k])}</dd>
          </div>
        ))}
      </dl>
      {n.serie.length > 1 ? <MiniGrafico n={n} /> : null}
    </div>
  );
}

function Escolher({
  peca,
  onFechar,
}: {
  peca: PecaDetalhe;
  onFechar?: () => void;
}) {
  const router = useRouter();
  const [posts, setPosts] = useState<PostConta[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [vinculando, setVinculando] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    listarPostsAcao(peca.id).then((r) => {
      if (!vivo) return;
      if (r.erro !== null) setErro(r.erro);
      else setPosts(r.posts);
    });
    return () => {
      vivo = false;
    };
  }, [peca.id]);

  if (erro)
    return (
      <div className="cx-post-aviso" role="status">
        <p>{erro}</p>
        {/Conecte/.test(erro) ? (
          <Link href="/central/conexoes" className="cx-botao cx-botao--suave">
            <PlugZap size={16} strokeWidth={1.8} aria-hidden="true" /> Abrir Conexões
          </Link>
        ) : null}
        {onFechar ? (
          <button type="button" className="cx-botao cx-botao--fantasma-escuro" onClick={onFechar}>
            Fechar
          </button>
        ) : null}
      </div>
    );
  if (!posts)
    return (
      <p className="cx-pp-meta cx-post-carregando" role="status">
        <LoaderCircle size={16} className="cx-girando" aria-hidden="true" /> Buscando os últimos posts…
      </p>
    );
  if (!posts.length) return <p className="cx-pp-meta">Nenhum post recente nesta conta.</p>;

  return (
    <div className="cx-post-escolher">
      <p className="cx-pp-meta">Qual destes posts é esta peça?</p>
      <ul className="cx-post-lista">
        {posts.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              className="cx-post-opcao"
              disabled={!!vinculando}
              onClick={async () => {
                setVinculando(p.id);
                const r = await vincularPostAcao(peca.id, p.id);
                setVinculando(null);
                if (r.erro !== null) setErro(r.erro);
                else {
                  onFechar?.();
                  router.refresh();
                }
              }}
            >
              {p.imagem && /img\.youtube\.com/.test(p.imagem) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.imagem} alt="" className="cx-post-mini" loading="lazy" />
              ) : (
                <span className="cx-post-mini cx-post-mini--vazia" aria-hidden="true">
                  <Link2 size={16} strokeWidth={1.8} />
                </span>
              )}
              <span className="cx-post-opcao-texto">
                <span className="cx-post-opcao-titulo">{p.texto || "Post sem legenda"}</span>
                <span className="cx-pp-meta">
                  {p.data ? fmtDia.format(new Date(p.data)).replace(".", "") : "Sem data"}
                  {typeof p.metricas.curtidas === "number" ? ` · ${num(p.metricas.curtidas)} curtidas` : ""}
                  {typeof p.metricas.alcance === "number" ? ` · alcance ${num(p.metricas.alcance)}` : ""}
                </span>
              </span>
              {vinculando === p.id ? <LoaderCircle size={16} className="cx-girando" aria-hidden="true" /> : null}
            </button>
          </li>
        ))}
      </ul>
      {onFechar ? (
        <button type="button" className="cx-botao cx-botao--fantasma-escuro" onClick={onFechar}>
          Cancelar
        </button>
      ) : null}
    </div>
  );
}

export function PostVinculado({ peca }: { peca: PecaDetalhe }) {
  const router = useRouter();
  const v = peca.vinculo;
  const [escolhendo, setEscolhendo] = useState(false);
  const [numeros, setNumeros] = useState<NumerosPost | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  useEffect(() => {
    if (!v) return;
    let vivo = true;
    numerosPostAcao(peca.id).then((r) => {
      if (!vivo) return;
      if (r.erro !== null) setErro(r.erro);
      else {
        setErro(null);
        setNumeros(r.numeros);
      }
    });
    return () => {
      vivo = false;
    };
  }, [peca.id, v]);

  return (
    <section className="cx-pp-secao" aria-labelledby="cx-pp-post">
      <h2 id="cx-pp-post" className="cx-pp-titulo">
        Post no ar
      </h2>
      {!v || escolhendo ? (
        escolhendo ? (
          <Escolher peca={peca} onFechar={() => setEscolhendo(false)} />
        ) : (
          <>
            <p className="cx-pp-meta">Vincule ao post publicado para ver alcance, curtidas e salvos aqui.</p>
            <button type="button" className="cx-botao cx-botao--suave cx-pp-largo" onClick={() => setEscolhendo(true)}>
              <Link2 size={16} strokeWidth={1.8} aria-hidden="true" /> Vincular ao post
            </button>
          </>
        )
      ) : (
        <>
          <div className="cx-post-vinculado">
            {v.capa ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={v.capa} alt="" className="cx-post-capa" />
            ) : (
              <span className="cx-post-capa cx-post-mini--vazia" aria-hidden="true">
                <Link2 size={18} strokeWidth={1.8} />
              </span>
            )}
            <div className="cx-post-opcao-texto">
              <span className="cx-post-opcao-titulo">{v.texto || "Post sem legenda"}</span>
              <span className="cx-pp-meta">{v.data ? `No ar desde ${fmtDia.format(new Date(v.data)).replace(".", "")}` : ""}</span>
            </div>
          </div>
          {numeros ? (
            <Numeros n={numeros} />
          ) : erro ? (
            <p className="cx-aviso cx-aviso--erro" role="status">
              {erro}
            </p>
          ) : (
            <div className="cx-numeros-carregando" aria-label="Carregando os números" role="status">
              <span />
              <span />
              <span />
            </div>
          )}
          <div className="cx-pp-linha cx-pp-linha--quebra">
            {v.link ? (
              <a href={v.link} target="_blank" rel="noopener noreferrer" className="cx-botao cx-botao--suave">
                <ExternalLink size={16} strokeWidth={1.8} aria-hidden="true" /> Ver post
              </a>
            ) : null}
            <button type="button" className="cx-botao cx-botao--fantasma-escuro" onClick={() => setEscolhendo(true)}>
              <RefreshCw size={16} strokeWidth={1.8} aria-hidden="true" /> Trocar vínculo
            </button>
            <button
              type="button"
              className="cx-icone-botao"
              aria-label="Desfazer o vínculo"
              title="Desfazer o vínculo"
              disabled={pendente}
              onClick={() =>
                iniciar(async () => {
                  const r = await desvincularPostAcao(peca.id);
                  if (r.erro === null) {
                    setNumeros(null);
                    router.refresh();
                  }
                })
              }
            >
              <Unlink size={17} strokeWidth={1.8} aria-hidden="true" />
            </button>
          </div>
        </>
      )}
    </section>
  );
}
