"use client";

/**
 * Linha do tempo (DESIGN.md 6.2: estrutura dominante = o gráfico).
 * Dias no eixo horizontal, quantidade no vertical: barras empilhadas por
 * chefe (na cor de cada um) para as entregas, linha das aprovadas por cima e
 * marcos no topo (post publicado, venda, contrato fechado). Setas e arrastar
 * andam no tempo; 7/14/30 dias. Clicar num dia mostra a legenda embaixo.
 */
import { ArrowUpRight, Check, ChevronLeft, ChevronRight, FileSignature, Megaphone, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { idDoChefe, MarcaChefe } from "@/components/central/chefe";
import type { EventoView } from "@/components/central/tipos";
import { CHEFES_PAINEL, type IdChefe } from "@/lib/chefes/identidade";

type Marco = NonNullable<EventoView["marco"]>;

const ORDEM_CHEFES: IdChefe[] = ["rastro", "pauta", "trato", "conselho", "rotina", "norte"];
const ICONE_MARCO: Record<Marco, typeof Megaphone> = { publicado: Megaphone, venda: ShoppingBag, contrato: FileSignature };
const ROTULO_MARCO: Record<Marco, [string, string]> = {
  publicado: ["post publicado", "posts publicados"],
  venda: ["venda", "vendas"],
  contrato: ["contrato fechado", "contratos fechados"],
};

const TZ = "America/Sao_Paulo";
const chaveDe = new Intl.DateTimeFormat("en-CA", { timeZone: TZ });
const fmtSemana = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "short" });
const fmtDiaMes = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", day: "numeric", month: "short" });
const fmtLongo = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });
const fmtHora = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });

type Dia = {
  chave: string;
  /** Meio-dia UTC do dia (só para formatar). */
  data: Date;
  porChefe: Partial<Record<IdChefe, number>>;
  entregas: number;
  aprovadas: number;
  marcos: Partial<Record<Marco, number>>;
  eventos: EventoView[];
};

function somarDias(chave: string, n: number): string {
  const d = new Date(`${chave}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Teto "redondo" do eixo: 4, 6, 8, 10, 15, 20, 30… */
function tetoEixo(max: number): number {
  if (max <= 4) return 4;
  const passos = [6, 8, 10, 15, 20, 25, 30, 40, 50, 60, 80, 100, 150, 200];
  return passos.find((p) => p >= max) ?? Math.ceil(max / 100) * 100;
}

/** Quantos eventos do dia aparecem antes do "Mostrar todos". */
const MOSTRAR = 12;

const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const sem = (s: string) => s.replace(".", "");
const plural = (n: number, [um, varios]: [string, string]) => `${n} ${n === 1 ? um : varios}`;

export function GraficoLinha({
  eventos,
  periodo,
  hoje,
  historico,
}: {
  eventos: EventoView[];
  periodo: 7 | 14 | 30;
  /** "AAAA-MM-DD" de hoje em São Paulo (vem do servidor: sem divergir na hidratação). */
  hoje: string;
  /** Quantos dias para trás as setas alcançam. */
  historico: number;
}) {
  const dias = useMemo<Dia[]>(() => {
    const lista: Dia[] = [];
    const indice = new Map<string, Dia>();
    for (let i = historico - 1; i >= 0; i--) {
      const chave = somarDias(hoje, -i);
      const d: Dia = {
        chave,
        data: new Date(`${chave}T12:00:00Z`),
        porChefe: {},
        entregas: 0,
        aprovadas: 0,
        marcos: {},
        eventos: [],
      };
      lista.push(d);
      indice.set(chave, d);
    }
    for (const e of eventos) {
      const d = indice.get(chaveDe.format(new Date(e.em)));
      if (!d) continue;
      d.eventos.push(e);
      if (e.tipo === "resultado") {
        const id = idDoChefe(e.chefe);
        d.porChefe[id] = (d.porChefe[id] ?? 0) + 1;
        d.entregas++;
      } else if (e.tipo === "decisao" && e.decisao === "APROVADA") d.aprovadas++;
      else if (e.tipo === "marco" && e.marco) d.marcos[e.marco] = (d.marcos[e.marco] ?? 0) + 1;
    }
    for (const d of lista) d.eventos.sort((a, b) => b.em.localeCompare(a.em));
    return lista;
  }, [eventos, hoje, historico]);

  const [janela, setJanela] = useState<7 | 14 | 30>(periodo);
  const [fim, setFim] = useState(dias.length - 1);
  const inicio = Math.max(0, fim - janela + 1);
  const visiveis = dias.slice(inicio, fim + 1);
  const [sel, setSel] = useState<string>(() => {
    const ultimos = dias.slice(-janela);
    return [...ultimos].reverse().find((d) => d.eventos.length)?.chave ?? hoje;
  });
  const [foco, setFoco] = useState<number | null>(null);
  const [tudo, setTudo] = useState(false);

  const teto = tetoEixo(Math.max(1, ...visiveis.map((d) => Math.max(d.entregas, d.aprovadas))));
  const chefesNoPeriodo = ORDEM_CHEFES.filter((id) => visiveis.some((d) => d.porChefe[id]));
  const totalEntregas = visiveis.reduce((t, d) => t + d.entregas, 0);
  const totalAprovadas = visiveis.reduce((t, d) => t + d.aprovadas, 0);

  // ---- arrastar para os lados (mouse); no toque, a rolagem nativa ----
  const area = useRef<HTMLDivElement>(null);
  const arrasto = useRef<{ x: number; fim: number; moveu: boolean } | null>(null);
  function aoApertar(e: React.PointerEvent) {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    arrasto.current = { x: e.clientX, fim, moveu: false };
  }
  function aoMover(e: React.PointerEvent) {
    const a = arrasto.current;
    if (!a || !area.current) return;
    const dx = e.clientX - a.x;
    if (!a.moveu && Math.abs(dx) < 6) return;
    if (!a.moveu) {
      a.moveu = true;
      area.current.setPointerCapture(e.pointerId);
    }
    const largura = area.current.clientWidth / janela;
    const passo = Math.round(-dx / largura);
    setFim(Math.max(janela - 1, Math.min(dias.length - 1, a.fim + passo)));
  }
  function aoSoltar(e: React.PointerEvent) {
    const a = arrasto.current;
    arrasto.current = null;
    if (a?.moveu) {
      area.current?.releasePointerCapture(e.pointerId);
      // Engole o clique que vem depois de arrastar.
      const engolir = (ev: Event) => {
        ev.stopPropagation();
        ev.preventDefault();
      };
      window.addEventListener("click", engolir, { capture: true, once: true });
      setTimeout(() => window.removeEventListener("click", engolir, { capture: true }), 0);
    }
  }

  // No celular a área rola: começa mostrando os dias mais recentes.
  const rolagem = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const r = rolagem.current;
    if (r) r.scrollLeft = r.scrollWidth;
  }, [janela, fim]);

  function andar(dir: -1 | 1) {
    setFim((f) => Math.max(janela - 1, Math.min(dias.length - 1, f + dir * janela)));
  }
  function trocarJanela(j: 7 | 14 | 30) {
    setJanela(j);
    setFim((f) => Math.max(j - 1, f));
  }

  const diaSel = dias.find((d) => d.chave === sel) ?? null;
  const primeiro = visiveis[0];
  const ultimo = visiveis[visiveis.length - 1];
  const pontos = visiveis.map((d, i) => `${i * 100 + 50},${100 - (d.aprovadas / teto) * 100}`).join(" ");

  return (
    <section className="cx-tl" aria-label="Linha do tempo">
      <div className="cx-tl-barra">
        <div className="cx-tl-nav">
          <button type="button" className="cx-tl-seta" onClick={() => andar(-1)} disabled={inicio === 0} aria-label={`${janela} dias antes`}>
            <ChevronLeft size={20} strokeWidth={2} aria-hidden="true" />
          </button>
          <p className="cx-tl-intervalo" aria-live="polite">
            {sem(fmtDiaMes.format(primeiro.data))} – {sem(fmtDiaMes.format(ultimo.data))}
          </p>
          <button
            type="button"
            className="cx-tl-seta"
            onClick={() => andar(1)}
            disabled={fim === dias.length - 1}
            aria-label={`${janela} dias depois`}
          >
            <ChevronRight size={20} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
        <div className="cx-tl-totais">
          <p>
            <strong>{totalEntregas}</strong> entregas
          </p>
          <p>
            <strong>{totalAprovadas}</strong> aprovadas
          </p>
        </div>
        <div className="cx-segmentos" role="group" aria-label="Período">
          {([7, 14, 30] as const).map((j) => (
            <button key={j} type="button" className="cx-segmento" aria-pressed={j === janela} onClick={() => trocarJanela(j)}>
              {j} dias
            </button>
          ))}
        </div>
      </div>

      <div className="cx-tl-rolagem" ref={rolagem}>
        <div className="cx-tl-grafico" data-janela={janela} style={{ "--n": janela } as CSSProperties}>
          <div className="cx-tl-eixo" aria-hidden="true">
            <span style={{ bottom: "100%" }}>{teto}</span>
            <span style={{ bottom: "50%" }}>{teto / 2}</span>
            <span style={{ bottom: "0%" }}>0</span>
          </div>
          <div
            className="cx-tl-area"
            ref={area}
            onPointerDown={aoApertar}
            onPointerMove={aoMover}
            onPointerUp={aoSoltar}
            onPointerCancel={aoSoltar}
          >
            <div className="cx-tl-grade" aria-hidden="true">
              <span style={{ bottom: "100%" }} />
              <span style={{ bottom: "50%" }} />
              <span style={{ bottom: "0%" }} />
            </div>
            <svg className="cx-tl-linha" viewBox={`0 0 ${visiveis.length * 100} 100`} preserveAspectRatio="none" aria-hidden="true">
              <polyline points={pontos} vectorEffect="non-scaling-stroke" />
            </svg>
            <ol className="cx-tl-dias">
              {visiveis.map((d, i) => {
                const marcos = (Object.keys(ICONE_MARCO) as Marco[]).filter((m) => d.marcos[m]);
                const resumo = [
                  plural(d.entregas, ["entrega", "entregas"]),
                  plural(d.aprovadas, ["aprovada", "aprovadas"]),
                  ...marcos.map((m) => plural(d.marcos[m]!, ROTULO_MARCO[m])),
                ].join(", ");
                const fimDeSemana = [0, 6].includes(d.data.getUTCDay());
                return (
                  <li key={d.chave} className="cx-tl-dia" data-hoje={d.chave === hoje ? "" : undefined} data-fds={fimDeSemana ? "" : undefined}>
                    <button
                      type="button"
                      className="cx-tl-coluna"
                      aria-pressed={d.chave === sel}
                      aria-label={`${fmtLongo.format(d.data)}: ${resumo}`}
                      onClick={() => {
                        setSel(d.chave);
                        setTudo(false);
                      }}
                      onPointerEnter={(e) => e.pointerType === "mouse" && setFoco(i)}
                      onPointerLeave={() => setFoco((f) => (f === i ? null : f))}
                      onFocus={() => setFoco(i)}
                      onBlur={() => setFoco((f) => (f === i ? null : f))}
                    >
                      <span className="cx-tl-marcos" aria-hidden="true">
                        {marcos.map((m) => {
                          const I = ICONE_MARCO[m];
                          return (
                            <span key={m} className="cx-tl-marco" data-marco={m}>
                              <I size={13} strokeWidth={2} />
                            </span>
                          );
                        })}
                      </span>
                      <span className="cx-tl-pilha" aria-hidden="true">
                        <span className="cx-tl-num" style={{ bottom: `${(d.entregas / teto) * 100}%` }}>
                          {d.entregas || ""}
                        </span>
                        <span className="cx-tl-barras" style={{ height: `${(d.entregas / teto) * 100}%` }}>
                          {ORDEM_CHEFES.filter((id) => d.porChefe[id]).map((id) => (
                            <span key={id} data-chefe={id} style={{ flexGrow: d.porChefe[id] }} />
                          ))}
                        </span>
                        {d.aprovadas ? <span className="cx-tl-ponto" style={{ bottom: `${(d.aprovadas / teto) * 100}%` }} /> : null}
                      </span>
                      <span className="cx-tl-rotulo" aria-hidden="true">
                        <span>{sem(fmtSemana.format(d.data))}</span>
                        <strong>{d.data.getUTCDate()}</strong>
                      </span>
                    </button>
                    {foco === i ? (
                      <div className="cx-tl-dica" role="tooltip" data-lado={i > visiveis.length / 2 ? "esq" : "dir"}>
                        <p className="cx-tl-dica-dia">{maiuscula(fmtLongo.format(d.data))}</p>
                        <ul>
                          {ORDEM_CHEFES.filter((id) => d.porChefe[id]).map((id) => (
                            <li key={id} data-chefe={id}>
                              <span className="cx-tl-cor" />
                              {CHEFES_PAINEL[id].nome}
                              <strong>{d.porChefe[id]}</strong>
                            </li>
                          ))}
                          <li className="cx-tl-dica-aprov">
                            <span className="cx-tl-cor cx-tl-cor--linha" />
                            Aprovadas
                            <strong>{d.aprovadas}</strong>
                          </li>
                          {marcos.map((m) => (
                            <li key={m}>
                              <span className="cx-tl-cor cx-tl-cor--marco" />
                              {ROTULO_MARCO[m][1].charAt(0).toUpperCase() + ROTULO_MARCO[m][1].slice(1)}
                              <strong>{d.marcos[m]}</strong>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </div>

      <ul className="cx-tl-legenda" aria-label="Legenda">
        {chefesNoPeriodo.map((id) => (
          <li key={id} data-chefe={id}>
            <span className="cx-tl-cor" />
            {CHEFES_PAINEL[id].nome}
          </li>
        ))}
        <li>
          <span className="cx-tl-cor cx-tl-cor--linha" />
          Aprovadas
        </li>
        {(Object.keys(ICONE_MARCO) as Marco[]).map((m) => {
          const I = ICONE_MARCO[m];
          return (
            <li key={m}>
              <span className="cx-tl-marco" data-marco={m} aria-hidden="true">
                <I size={13} strokeWidth={2} />
              </span>
              {ROTULO_MARCO[m][0].charAt(0).toUpperCase() + ROTULO_MARCO[m][0].slice(1)}
            </li>
          );
        })}
      </ul>

      <section className="cx-tl-detalhe" aria-live="polite" aria-labelledby="cx-tl-detalhe-t">
        <h2 id="cx-tl-detalhe-t" className="cx-tl-detalhe-titulo">
          {diaSel ? (sel === hoje ? "Hoje" : maiuscula(fmtLongo.format(diaSel.data))) : "Escolha um dia"}
          {diaSel ? <span className="cx-tl-detalhe-conta">{diaSel.eventos.length}</span> : null}
        </h2>
        {diaSel?.eventos.length ? (
          <ol className="cx-tl-eventos">
            {(tudo ? diaSel.eventos : diaSel.eventos.slice(0, MOSTRAR)).map((e) => {
              const MarcoIcone = e.marco ? ICONE_MARCO[e.marco] : null;
              const href = e.href ?? (e.slug ? `/central/${e.slug}` : null);
              const corpo = (
                <>
                  <span className="cx-tl-retrato">
                    <MarcaChefe nome={e.chefe} tamanho={40} />
                    {e.tipo === "decisao" ? (
                      <span className="cx-tl-selo cx-tl-selo--decisao" aria-hidden="true">
                        <Check size={11} strokeWidth={3} />
                      </span>
                    ) : MarcoIcone && e.marco ? (
                      <span className="cx-tl-selo" data-marco={e.marco} aria-hidden="true">
                        <MarcoIcone size={11} strokeWidth={2.4} />
                      </span>
                    ) : null}
                  </span>
                  <span className="cx-tl-ev-texto">
                    <span className="cx-tl-ev-quem">
                      {e.tipo === "decisao" ? "Você · " : ""}
                      {e.chefe}
                    </span>
                    <span className="cx-tl-ev-frase">{e.linha}</span>
                  </span>
                  <time className="cx-tl-ev-hora" dateTime={e.em}>
                    {fmtHora.format(new Date(e.em))}
                  </time>
                  {href ? <ArrowUpRight className="cx-tl-ev-ir" size={18} strokeWidth={1.8} aria-hidden="true" /> : null}
                </>
              );
              return (
                <li key={e.id}>
                  {href ? (
                    <Link href={href} className="cx-tl-ev">
                      {corpo}
                    </Link>
                  ) : (
                    <div className="cx-tl-ev">{corpo}</div>
                  )}
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="cx-dica">Nada neste dia.</p>
        )}
        {diaSel && diaSel.eventos.length > MOSTRAR && !tudo ? (
          <button type="button" className="cx-botao cx-botao--suave cx-tl-mais" onClick={() => setTudo(true)}>
            Mostrar todos os {diaSel.eventos.length}
          </button>
        ) : null}
      </section>
    </section>
  );
}
