import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CabecaPagina } from "@/components/central/cabeca";
import { NOME_REDE, ROTULO_METRICA, mediaDasMetricas, redeDoSlug, visaoDaRede } from "@/lib/redes/visao";

import { contexto } from "../../../../_lib/painel";

export const dynamic = "force-dynamic";

const fmt = new Intl.NumberFormat("pt-BR");
const fmtData = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "long", timeStyle: "short" });

function duracao(s: number | null): string | null {
  if (!s) return null;
  const m = Math.floor(s / 60);
  return m ? `${m} min ${s % 60 ? `${s % 60} s` : ""}`.trim() : `${s} s`;
}

/** Um post aberto: a mídia, o texto e cada métrica contra a média da conta. */
export default async function PostAberto({ params }: { params: Promise<{ rede: string; post: string }> }) {
  const { rede: slug, post: idBruto } = await params;
  const rede = redeDoSlug(slug);
  if (!rede) notFound();
  const c = await contexto();
  if (!c?.accountId) return null;
  const id = decodeURIComponent(idBruto);
  const v = await visaoDaRede(c.accountId, rede);
  const p = v.posts.find((x) => x.id === id);
  if (!p) notFound();
  const media = mediaDasMetricas(v.posts.filter((x) => x.id !== id));
  const base = p.metricas.alcance ?? p.metricas.visualizacoes ?? null;
  const interacoes = (p.metricas.curtidas ?? 0) + (p.metricas.comentarios ?? 0) + (p.metricas.compartilhamentos ?? 0) + (p.metricas.salvamentos ?? 0);
  const engajamento = base ? (interacoes / base) * 100 : null;
  const seguidores = v.perfil?.seguidores ?? null;
  const ytId = rede === "YOUTUBE" ? p.video : null;

  return (
    <>
      <Link href={`/central/redes/conta/${slug}`} className="cx-voltar">
        <ArrowLeft size={18} strokeWidth={1.8} aria-hidden="true" /> {NOME_REDE[rede]}
      </Link>
      <CabecaPagina
        secao={`Redes · ${NOME_REDE[rede]}`}
        titulo={(p.texto.split("\n")[0] || "Post").slice(0, 80)}
        ponto={false}
        subtitulo={[p.formato, p.data ? fmtData.format(new Date(p.data)) : null, duracao(p.duracaoSegundos)].filter(Boolean).join(" · ") || NOME_REDE[rede]}
      >
        {p.link ? (
          <a href={p.link} target="_blank" rel="noreferrer" className="cx-botao cx-botao--branco">
            Abrir no {NOME_REDE[rede]} <ExternalLink size={15} aria-hidden="true" />
          </a>
        ) : null}
      </CabecaPagina>

      <div className="cx-rp">
        <div className="cx-painel cx-rp-midia">
          {ytId ? (
            <div className="cx-rp-video">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${ytId}`}
                title={p.texto.slice(0, 80) || "Vídeo"}
                allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                loading="lazy"
              />
            </div>
          ) : p.video && /^https:\/\//.test(p.video) && /\.(mp4|webm)(\?|$)/.test(p.video) ? (
            <video src={p.video} controls playsInline className="cx-rp-img" />
          ) : p.imagem ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.imagem} alt="" className="cx-rp-img" />
          ) : null}
          {p.texto ? <p className="cx-rp-texto">{p.texto}</p> : null}
        </div>

        <div className="cx-rp-lado">
          <section className="cx-painel cx-rp-metricas">
            <h2 className="cx-pp-titulo">Números do post</h2>
            {Object.keys(p.metricas).length ? (
              <dl>
                {Object.entries(p.metricas).map(([k, val]) => {
                  const m = media[k as keyof typeof media];
                  const dif = typeof m === "number" && m > 0 && typeof val === "number" ? Math.round(((val - m) / m) * 100) : null;
                  return (
                    <div key={k}>
                      <dt>{ROTULO_METRICA[k] ?? k}</dt>
                      <dd>{typeof val === "number" ? fmt.format(val) : "—"}</dd>
                      {dif !== null ? (
                        <span className="cx-rp-dif" data-sinal={dif >= 0 ? "mais" : "menos"}>
                          {dif >= 0 ? "+" : ""}
                          {dif}% contra a média
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </dl>
            ) : (
              <p className="cx-dica">A rede não mandou métricas deste post.</p>
            )}
          </section>
          <section className="cx-painel cx-rp-metricas">
            <h2 className="cx-pp-titulo">Leitura rápida</h2>
            <ul className="cx-rp-leitura">
              {engajamento !== null ? <li>Engajamento: {engajamento.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% de quem viu interagiu.</li> : null}
              {seguidores && base ? <li>Alcançou {Math.round((base / seguidores) * 100)}% do tamanho da conta ({fmt.format(seguidores)} seguidores).</li> : null}
              {p.metricas.salvamentos ? <li>{fmt.format(p.metricas.salvamentos)} salvamentos: conteúdo que as pessoas querem rever. Vale repetir o formato.</li> : null}
              {p.metricas.compartilhamentos ? <li>{fmt.format(p.metricas.compartilhamentos)} compartilhamentos: é isso que leva a conta para gente nova.</li> : null}
              {engajamento === null && !p.metricas.salvamentos ? <li>Com mais números (API oficial), a leitura fica completa.</li> : null}
            </ul>
            <Link href="/central/redes" className="cx-botao cx-botao--azul">
              Pedir mais como este à Pauta
            </Link>
          </section>
        </div>
      </div>
    </>
  );
}
