import { Bot, ExternalLink, Image as ImagemIcone, PlugZap, Play } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CabecaPagina } from "@/components/central/cabeca";
import { ChipChefe } from "@/components/central/chefe";
import { NOME_REDE, REDES_VISAO, ROTULO_METRICA, SLUG_REDE, mediaDasMetricas, redeDoSlug, visaoDaRede } from "@/lib/redes/visao";

import { contexto } from "../../../_lib/painel";

export const dynamic = "force-dynamic";

const fmt = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const fmtDia = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "numeric", month: "short" });
const n = (v: number | null | undefined) => (typeof v === "number" ? fmt.format(v) : "—");


/** A conta da empresa numa rede: perfil, números e a grade de posts (cada um abre). */
export default async function ContaRede({ params }: { params: Promise<{ rede: string }> }) {
  const { rede: slug } = await params;
  const rede = redeDoSlug(slug);
  if (!rede) notFound();
  const c = await contexto();
  if (!c?.accountId) return null;
  const v = await visaoDaRede(c.accountId, rede);
  const media = mediaDasMetricas(v.posts);
  const principal = (["visualizacoes", "alcance", "curtidas"] as const).find((k) => media[k] !== undefined) ?? "curtidas";

  return (
    <>
      <CabecaPagina secao="Redes · Contas" titulo={NOME_REDE[rede]} subtitulo="O perfil da empresa, os números e cada post com as métricas dele." chip={<ChipChefe nome="Editora Pauta" />}>
        <nav className="cx-segmentos" aria-label="Rede">
          {REDES_VISAO.map((r) => (
            <Link key={r} href={`/central/redes/conta/${SLUG_REDE[r]}`} className="cx-segmento" aria-current={r === rede ? "page" : undefined}>
              {NOME_REDE[r]}
            </Link>
          ))}
        </nav>
      </CabecaPagina>

      {!v.origem ? (
        <section className="cx-painel cx-rc-vazio">
          <p className="cx-integracao-nome">{NOME_REDE[rede]} ainda sem dados</p>
          <p className="cx-dica">Dois jeitos de trazer o perfil, os seguidores e os posts para cá:</p>
          <div className="cx-botoes">
            {rede !== "TIKTOK" ? (
              <Link href="/central/conexoes" className="cx-botao cx-botao--azul">
                <PlugZap size={17} aria-hidden="true" /> Conectar pela API (métricas completas)
              </Link>
            ) : null}
            <Link href="/central/conexoes?aba=api" className="cx-botao cx-botao--branco">
              <Bot size={17} aria-hidden="true" /> Usar o meu agente (sem API, dados públicos)
            </Link>
          </div>
        </section>
      ) : (
        <>
          <section className="cx-painel cx-rc-perfil">
            <div className="cx-rc-quem">
              {v.perfil?.foto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={v.perfil.foto} alt="" className="cx-rc-foto" />
              ) : (
                <span className="cx-rc-foto cx-rc-foto--vazia" aria-hidden="true">
                  {(v.perfil?.nome ?? "?").slice(0, 1)}
                </span>
              )}
              <div>
                <p className="cx-integracao-nome">{v.perfil?.nome ?? NOME_REDE[rede]}</p>
                {v.perfil?.usuario ? <p className="cx-dica">{v.perfil.usuario.startsWith("@") ? v.perfil.usuario : `@${v.perfil.usuario}`}</p> : null}
                {v.perfil?.descricao ? <p className="cx-rc-bio">{v.perfil.descricao}</p> : null}
              </div>
              {v.perfil?.link ? (
                <a href={v.perfil.link} target="_blank" rel="noreferrer" className="cx-botao cx-botao--branco">
                  Abrir <ExternalLink size={15} aria-hidden="true" />
                </a>
              ) : null}
            </div>
            <dl className="cx-rc-numeros">
              <div>
                <dt>{rede === "YOUTUBE" ? "Inscritos" : "Seguidores"}</dt>
                <dd>{n(v.perfil?.seguidores)}</dd>
              </div>
              <div>
                <dt>{rede === "YOUTUBE" ? "Vídeos" : "Publicações"}</dt>
                <dd>{n(v.perfil?.publicacoes)}</dd>
              </div>
              {v.perfil?.seguindo != null ? (
                <div>
                  <dt>Seguindo</dt>
                  <dd>{n(v.perfil.seguindo)}</dd>
                </div>
              ) : null}
              {media[principal] !== undefined ? (
                <div>
                  <dt>Média de {ROTULO_METRICA[principal].toLowerCase()} por post</dt>
                  <dd>{n(media[principal])}</dd>
                </div>
              ) : null}
              {v.numerosConta.slice(0, 4).map((m) => (
                <div key={m.nome}>
                  <dt>{m.nome}</dt>
                  <dd>{n(m.valor)}</dd>
                </div>
              ))}
            </dl>
            <p className="cx-dica">
              {v.origem === "api" ? "Pela API oficial (atualiza a cada 6 horas)." : `Mandado pelo seu agente${v.atualizadoEm ? ` em ${fmtDia.format(new Date(v.atualizadoEm))}` : ""}: só dados públicos.`}
              {v.erro ? ` ${v.erro}` : ""}
            </p>
          </section>

          <section className="cx-rc-grade" aria-label="Posts">
            {v.posts.map((p) => (
              <Link key={p.id} href={`/central/redes/conta/${slug}/${encodeURIComponent(p.id)}`} className="cx-rc-post">
                <span className="cx-rc-capa">
                  {p.imagem ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imagem} alt="" loading="lazy" />
                  ) : (
                    <span className="cx-rc-texto">{p.texto.slice(0, 140) || "Sem texto"}</span>
                  )}
                  {p.video || /video|reel|short/i.test(p.formato ?? "") ? (
                    <span className="cx-rc-tipo">
                      <Play size={14} aria-hidden="true" />
                    </span>
                  ) : p.imagem ? null : (
                    <span className="cx-rc-tipo">
                      <ImagemIcone size={14} aria-hidden="true" />
                    </span>
                  )}
                </span>
                <span className="cx-rc-meta">
                  <strong>{n(p.metricas[principal])}</strong> {ROTULO_METRICA[principal].toLowerCase()}
                  {p.data ? <span className="cx-dica"> · {fmtDia.format(new Date(p.data))}</span> : null}
                </span>
              </Link>
            ))}
          </section>
        </>
      )}
    </>
  );
}
