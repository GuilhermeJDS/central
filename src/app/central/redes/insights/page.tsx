import { BarChart3, ExternalLink, PlugZap } from "lucide-react";
import Link from "next/link";

import { CabecaPagina, ChipVariacao } from "@/components/central/cabeca";
import { ChipChefe } from "@/components/central/chefe";
import { ROTULO_REDE } from "@/lib/central/entregas-tipos";
import { comRede, hrefDaPeca, slugDaRede } from "@/lib/central/estudio/secoes";
import { listarPecas, vinculoDe } from "@/lib/central/estudio/pecas";
import { postsDaConta, type PostConta } from "@/lib/central/estudio/posts";
import { prisma } from "@/lib/prisma";

import { contexto } from "../../_lib/painel";
import { filtroDaBusca, secaoCom, type BuscaEstudio } from "../_comum";

const REDES = ["INSTAGRAM", "YOUTUBE", "X", "LINKEDIN"] as const;
const fmt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const fmtCompacto = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const fmtDia = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "numeric", month: "short" });
const n = (v: number) => (v >= 10_000 ? fmtCompacto.format(v) : fmt.format(v));

type Linha = PostConta & { rede: string; base: number; engaj: number | null; peca: { id: string; tipo: string; titulo: string } | null };

function base(p: PostConta): number {
  return p.metricas.alcance ?? p.metricas.visualizacoes ?? 0;
}
function engaj(p: PostConta): number | null {
  const b = base(p);
  if (!b) return null;
  const m = p.metricas;
  return ((m.curtidas ?? 0) + (m.comentarios ?? 0) + (m.salvamentos ?? 0) + (m.compartilhamentos ?? 0)) / b;
}

/** Estúdio › Insights. Estrutura dominante: o gráfico de alcance por post, com as peças por trás de cada um. */
export default async function PaginaInsights({ searchParams }: { searchParams: BuscaEstudio }) {
  const c = await contexto();
  if (!c) return null;
  const { filtro } = await filtroDaBusca(searchParams, "/central/redes/insights");
  const conta = c.accountId;
  const redes = filtro ? [filtro.rede] : [...REDES];
  const [resultados, pecas] = conta
    ? await Promise.all([Promise.all(redes.map((r) => postsDaConta(conta, r))), listarPecas(conta, { etapas: ["PUBLICADO"] }, 300)])
    : [[], []];
  // Peças vinculadas: id do post → peça.
  const vinculos = conta
    ? await prisma.entregaChefe.findMany({
        where: { accountId: conta, departamento: "REDES", etapa: "PUBLICADO" },
        select: { id: true, tipo: true, titulo: true, vinculo: true },
      })
    : [];
  const porPost = new Map(vinculos.flatMap((v) => { const x = vinculoDe(v.vinculo); return x ? [[`${x.rede}:${x.id}`, v] as const] : []; }));
  const linhas: Linha[] = [];
  const faltam: string[] = [];
  resultados.forEach((r, i) => {
    if (!r.ok) {
      faltam.push(redes[i]);
      return;
    }
    for (const p of r.posts) {
      const v = porPost.get(`${redes[i]}:${p.id}`);
      linhas.push({ ...p, rede: redes[i], base: base(p), engaj: engaj(p), peca: v ? { id: v.id, tipo: v.tipo, titulo: v.titulo } : null });
    }
  });
  linhas.sort((a, b) => (b.data ?? "").localeCompare(a.data ?? ""));
  const serie = linhas.filter((l) => l.base).slice(0, 16).reverse();
  const max = Math.max(1, ...serie.map((s) => s.base));
  const media = serie.length ? serie.reduce((a, s) => a + s.base, 0) / serie.length : 0;
  const engs = linhas.map((l) => l.engaj).filter((v): v is number => v !== null);
  const engMedio = engs.length ? engs.reduce((a, b) => a + b, 0) / engs.length : null;
  const melhor = [...linhas].sort((a, b) => b.base - a.base)[0];
  const comPeca = linhas.filter((l) => l.peca);
  const mediaComPeca = comPeca.length ? comPeca.reduce((a, l) => a + l.base, 0) / comPeca.length : null;
  const semVinculo = pecas.filter((p) => !p.vinculado).length;

  return (
    <>
      <CabecaPagina
        secao={secaoCom("Insights", filtro)}
        titulo="Insights"
        subtitulo="Quanto cada post rendeu e qual peça do estúdio está por trás."
        chip={<ChipChefe nome="Editora Pauta" />}
      />
      {!linhas.length ? (
        <div className="cx-biblioteca-vazia">
          <span className="cx-vazio-icone" aria-hidden="true">
            <BarChart3 size={28} strokeWidth={1.6} />
          </span>
          <p className="cx-vazio-titulo">{filtro ? `O ${filtro.nome} ainda não está conectado.` : "Nenhuma rede conectada ainda."}</p>
          <p className="cx-vazio-texto">Conecte em Conexões e os números de cada post aparecem aqui, ligados às peças do estúdio.</p>
          <Link href="/central/conexoes" className="cx-botao cx-botao--azul">
            <PlugZap size={16} strokeWidth={1.8} aria-hidden="true" /> Abrir Conexões
          </Link>
        </div>
      ) : (
        <>
          <section className="cx-insights">
            <div className="cx-insights-destaque">
              <p className="cx-numeros-rotulo">Alcance médio por post</p>
              <p className="cx-numeros-grande">{n(media)}</p>
              <p className="cx-insights-apoio">
                {mediaComPeca !== null && media ? (
                  <>
                    Posts feitos no estúdio: {n(mediaComPeca)} <ChipVariacao valor={Math.round(((mediaComPeca - media) / media) * 1000) / 10} />
                  </>
                ) : (
                  "Vincule as peças aos posts para comparar."
                )}
              </p>
            </div>
            <dl className="cx-insights-numeros">
              <div>
                <dt>Engajamento médio</dt>
                <dd>{engMedio !== null ? `${(engMedio * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "—"}</dd>
              </div>
              <div>
                <dt>Posts lidos</dt>
                <dd>{linhas.length}</dd>
              </div>
              <div>
                <dt>Publicados sem vínculo</dt>
                <dd>
                  {semVinculo}
                  {semVinculo ? (
                    <Link href={comRede("/central/redes/publicados", filtro?.slug)} className="cx-pp-link">
                      Vincular
                    </Link>
                  ) : null}
                </dd>
              </div>
            </dl>
            <figure className="cx-insights-grafico">
              <svg viewBox="0 0 640 180" role="img" aria-label={`Alcance dos últimos ${serie.length} posts. Melhor: ${melhor ? n(melhor.base) : 0}.`}>
                {serie.map((s, i) => {
                  const passo = 640 / serie.length;
                  const h = Math.max(3, (s.base / max) * 160);
                  return (
                    <g key={`${s.rede}${s.id}`} data-rede={slugDaRede(s.rede) ?? undefined}>
                      <rect x={i * passo + passo * 0.18} y={176 - h} width={passo * 0.64} height={h} rx={3} className="cx-insights-barra" data-peca={s.peca ? "" : undefined} />
                    </g>
                  );
                })}
                <line x1={0} x2={640} y1={176 - (media / max) * 160} y2={176 - (media / max) * 160} className="cx-mini-media" />
              </svg>
              <figcaption className="cx-pp-meta">Alcance (ou visualizações) dos últimos {serie.length} posts, do mais antigo ao mais novo · cheio = feito no estúdio · tracejado = média</figcaption>
            </figure>
          </section>

          <ul className="cx-pecas cx-insights-posts">
            {linhas.map((l) => {
              const conteudo = (
                <>
                  <div className="cx-peca-capa cx-insights-capa" data-rede={slugDaRede(l.rede) ?? undefined}>
                    {l.imagem && /^(\/uploads\/|https:\/\/img\.youtube\.com\/)/.test(l.imagem) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={l.imagem} alt="" className="cx-capa-img" loading="lazy" />
                    ) : (
                      <div className="cx-capa-texto">
                        <span className="cx-capa-texto-tipo">{ROTULO_REDE[l.rede] ?? l.rede}</span>
                        <span className="cx-capa-texto-resumo cx-insights-legenda">{l.texto || "Post sem legenda"}</span>
                      </div>
                    )}
                    <div className="cx-peca-selos">
                      <span className="cx-selo-etapa">{l.peca ? "Do estúdio" : "Sem peça"}</span>
                    </div>
                  </div>
                  <div className="cx-peca-texto">
                    {l.peca ? <span className="cx-peca-titulo">{l.peca.titulo}</span> : null}
                    <span className="cx-insights-metricas">
                      <strong>{n(l.base)}</strong> {l.metricas.alcance !== undefined ? "alcance" : "views"}
                      {l.engaj !== null ? ` · ${(l.engaj * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% engaj.` : ""}
                    </span>
                    <span className="cx-peca-meta" data-rede={slugDaRede(l.rede) ?? undefined}>
                      <span className="cx-rede-ponto" aria-hidden="true" />
                      {ROTULO_REDE[l.rede] ?? l.rede}
                      {l.data ? <span>· {fmtDia.format(new Date(l.data)).replace(".", "")}</span> : null}
                      {!l.peca && l.link ? <ExternalLink size={13} strokeWidth={1.8} aria-label="abre na rede" /> : null}
                    </span>
                  </div>
                </>
              );
              return (
                <li key={`${l.rede}${l.id}`} className="cx-peca">
                  {l.peca ? (
                    <Link href={hrefDaPeca({ id: l.peca.id, tipo: l.peca.tipo as never }, filtro?.slug ?? null)} className="cx-peca-link">
                      {conteudo}
                    </Link>
                  ) : l.link ? (
                    <a href={l.link} target="_blank" rel="noopener noreferrer" className="cx-peca-link">
                      {conteudo}
                    </a>
                  ) : (
                    <div className="cx-peca-link">{conteudo}</div>
                  )}
                </li>
              );
            })}
          </ul>
          {faltam.length && !filtro ? (
            <p className="cx-pp-meta">
              Sem conexão: {faltam.map((r) => ROTULO_REDE[r]).join(", ")}. <Link href="/central/conexoes">Conectar</Link>
            </p>
          ) : null}
        </>
      )}
    </>
  );
}
