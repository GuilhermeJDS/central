"use client";

/**
 * Execuções (DESIGN.md 6.11): log com instrumentos. Mini-gráficos na faixa
 * de métricas, o mês dia a dia (execuções e custo em dois gráficos alinhados,
 * nunca dois eixos no mesmo), filtros que aplicam na hora e a tabela densa
 * agrupada por dia, com a saída abrindo na própria linha.
 */
import { ChevronDown, LoaderCircle, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Fragment, useState, useTransition } from "react";

import { ChipChefe } from "@/components/central/chefe";
import { ROTULO_STATUS, ROTULO_TIPO, tempo, tokens, usd } from "@/lib/central/execucoes-formato";
import type { DiaExecucoes, LinhaExecucao } from "@/lib/central/execucoes-painel";

const fmtInt = new Intl.NumberFormat("pt-BR");
const fmtHora = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
const fmtDia = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short", day: "numeric", month: "short" });
const fmtChave = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });

// ---------------------------------------------------------------------------
// Mini-gráfico (faixa de métricas)
// ---------------------------------------------------------------------------

export function MiniGrafico({ pontos, rotulo, ate }: { pontos: (number | null)[]; rotulo: string; ate: number }) {
  const L = 120;
  const A = 32;
  const vis = pontos.slice(0, ate);
  const nums = vis.map((p) => p ?? 0);
  const max = Math.max(...nums, 0);
  if (vis.length < 2 || max === 0) {
    return <span className="cx-mini cx-mini--vazio" aria-hidden="true" />;
  }
  const passo = L / (vis.length - 1);
  const xy = nums.map((n, i) => [i * passo, A - 3 - (n / max) * (A - 6)] as const);
  const linha = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const [ux] = xy[xy.length - 1];
  return (
    <svg className="cx-mini" viewBox={`0 0 ${L} ${A}`} preserveAspectRatio="none" role="img" aria-label={rotulo}>
      <path d={`${linha} L${ux.toFixed(1)},${A} L0,${A} Z`} className="cx-mini-area" />
      <path d={linha} className="cx-mini-linha" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// O mês dia a dia
// ---------------------------------------------------------------------------

export function GraficoMes({ serie, hoje, nomeMes }: { serie: DiaExecucoes[]; hoje: number | null; nomeMes: string }) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const maxExec = Math.max(1, ...serie.map((d) => d.execucoes));
  const maxCusto = Math.max(...serie.map((d) => d.custoUsd), 0);
  const marcas = new Set([1, 5, 10, 15, 20, 25, serie.length]);
  const d = ativo !== null ? serie[ativo] : null;
  const pos = ativo !== null ? ((ativo + 0.5) / serie.length) * 100 : 0;

  return (
    <figure className="cx-mes-graf" onMouseLeave={() => setAtivo(null)}>
      <figcaption className="cx-mes-graf-cabeca">
        <span className="cx-mes-graf-titulo">{nomeMes}, dia a dia</span>
        <span className="cx-mes-graf-legenda">
          <span className="cx-legenda-item">
            <span className="cx-legenda-cor" data-serie="ok" aria-hidden="true" /> Execuções
          </span>
          <span className="cx-legenda-item">
            <span className="cx-legenda-cor" data-serie="erro" aria-hidden="true" /> Falhas
          </span>
          <span className="cx-legenda-item">
            <span className="cx-legenda-cor" data-serie="custo" aria-hidden="true" /> Custo
          </span>
        </span>
      </figcaption>

      <div className="cx-mes-graf-corpo">
        {d ? (
          <div className="cx-mes-dica" style={{ left: `clamp(80px, ${pos}%, calc(100% - 80px))` }} role="status">
            <strong>Dia {d.dia}</strong>
            <span>
              {fmtInt.format(d.execucoes)} {d.execucoes === 1 ? "execução" : "execuções"}
              {d.erros ? ` · ${d.erros} ${d.erros === 1 ? "falha" : "falhas"}` : ""}
            </span>
            <span>{usd(d.custoUsd)}</span>
          </div>
        ) : null}

        <p className="cx-mes-graf-faixa-rotulo">
          Execuções <span>máx. {fmtInt.format(maxExec)}</span>
        </p>
        <div className="cx-mes-colunas" data-faixa="exec">
          {serie.map((x, i) => (
            <span
              key={x.dia}
              className="cx-mes-coluna"
              data-ativo={ativo === i ? "" : undefined}
              data-futuro={hoje !== null && x.dia > hoje ? "" : undefined}
              onMouseEnter={() => setAtivo(i)}
              onFocus={() => setAtivo(i)}
              onBlur={() => setAtivo(null)}
              tabIndex={0}
              aria-label={`Dia ${x.dia}: ${x.execucoes} execuções, ${x.erros} falhas, ${usd(x.custoUsd)}`}
            >
              {x.execucoes ? (
                <span className="cx-mes-pilha" style={{ height: `${Math.max(4, (x.execucoes / maxExec) * 100)}%` }}>
                  {x.erros ? <span className="cx-mes-barra" data-serie="erro" style={{ flexGrow: x.erros }} /> : null}
                  {x.execucoes - x.erros ? <span className="cx-mes-barra" data-serie="ok" style={{ flexGrow: x.execucoes - x.erros }} /> : null}
                </span>
              ) : (
                <span className="cx-mes-zero" />
              )}
            </span>
          ))}
        </div>

        <p className="cx-mes-graf-faixa-rotulo">
          Custo <span>máx. {usd(maxCusto)}</span>
        </p>
        <div className="cx-mes-colunas cx-mes-colunas--custo" data-faixa="custo" aria-hidden="true">
          {serie.map((x, i) => (
            <span key={x.dia} className="cx-mes-coluna" data-ativo={ativo === i ? "" : undefined} onMouseEnter={() => setAtivo(i)}>
              {x.custoUsd > 0 && maxCusto > 0 ? (
                <span className="cx-mes-pilha" style={{ height: `${Math.max(4, (x.custoUsd / maxCusto) * 100)}%` }}>
                  <span className="cx-mes-barra" data-serie="custo" style={{ flexGrow: 1 }} />
                </span>
              ) : (
                <span className="cx-mes-zero" />
              )}
            </span>
          ))}
        </div>

        <div className="cx-mes-eixo" aria-hidden="true">
          {serie.map((x) => (
            <span key={x.dia} data-hoje={x.dia === hoje ? "" : undefined}>
              {x.dia === hoje || (marcas.has(x.dia) && (hoje === null || Math.abs(x.dia - hoje) > 1)) ? x.dia : ""}
            </span>
          ))}
        </div>
      </div>
    </figure>
  );
}

// ---------------------------------------------------------------------------
// Filtros (aplicam na hora)
// ---------------------------------------------------------------------------

export function FiltrosExecucoes({
  opcoes,
}: {
  opcoes: { nome: string; rotulo: string; valores: [string, string][] }[];
}) {
  const router = useRouter();
  const caminho = usePathname();
  const sp = useSearchParams();
  const [pendente, iniciar] = useTransition();
  const ativos = opcoes.filter((o) => sp.get(o.nome));

  function mudar(nome: string, valor: string) {
    const q = new URLSearchParams(sp.toString());
    if (valor) q.set(nome, valor);
    else q.delete(nome);
    const s = q.toString();
    iniciar(() => router.push(`${caminho}${s ? `?${s}` : ""}`, { scroll: false }));
  }

  const limpar = () => {
    const q = new URLSearchParams();
    const m = sp.get("m");
    if (m) q.set("m", m);
    return `${caminho}${q.toString() ? `?${q}` : ""}`;
  };

  return (
    <div className="cx-exec-barra" role="search" aria-label="Filtros" data-pendente={pendente ? "" : undefined}>
      {opcoes.map((o) => {
        const v = sp.get(o.nome) ?? "";
        return (
          <label key={o.nome} className="cx-exec-filtro" data-ativo={v ? "" : undefined}>
            <span className="cx-exec-filtro-rotulo">{o.rotulo}</span>
            <select value={v} onChange={(e) => mudar(o.nome, e.target.value)} disabled={pendente}>
              <option value="">Todos</option>
              {o.valores.map(([valor, r]) => (
                <option key={valor} value={valor}>
                  {r}
                </option>
              ))}
            </select>
            <ChevronDown size={14} strokeWidth={2.2} aria-hidden="true" />
          </label>
        );
      })}
      {pendente ? <LoaderCircle size={18} className="cx-girando cx-exec-barra-carga" aria-label="Aplicando" /> : null}
      {ativos.length ? (
        <Link href={limpar()} className="cx-exec-limpar" scroll={false}>
          <X size={14} strokeWidth={2.4} aria-hidden="true" />
          Limpar {ativos.length > 1 ? `(${ativos.length})` : ""}
        </Link>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tabela agrupada por dia
// ---------------------------------------------------------------------------

export function TabelaExecucoes({ linhas, legenda }: { linhas: LinhaExecucao[]; legenda: string }) {
  const [aberta, setAberta] = useState<string | null>(null);
  const grupos: { chave: string; rotulo: string; linhas: LinhaExecucao[]; custo: number }[] = [];
  for (const l of linhas) {
    const d = new Date(l.em);
    const chave = fmtChave.format(d);
    let g = grupos.at(-1);
    if (!g || g.chave !== chave) {
      const r = fmtDia.format(d).replace(".", "");
      g = { chave, rotulo: r.charAt(0).toUpperCase() + r.slice(1), linhas: [], custo: 0 };
      grupos.push(g);
    }
    g.linhas.push(l);
    g.custo += l.custoUsd ?? 0;
  }

  return (
    <div className="cx-exec-tabela-caixa">
      <table className="cx-exec-tab">
        <caption className="cx-so-leitor">{legenda}</caption>
        <thead>
          <tr>
            <th scope="col">Hora</th>
            <th scope="col">Chefe</th>
            <th scope="col">Ação</th>
            <th scope="col" className="cx-exec-col-modelo">
              Modelo
            </th>
            <th scope="col" className="cx-num">
              Tokens
            </th>
            <th scope="col" className="cx-num">
              Custo
            </th>
            <th scope="col" className="cx-num">
              Tempo
            </th>
            <th scope="col">Resultado</th>
          </tr>
        </thead>
        {grupos.map((g) => (
          <tbody key={g.chave}>
            <tr className="cx-exec-dia">
              <th scope="rowgroup" colSpan={4}>
                {g.rotulo}
                <span>
                  {g.linhas.length} {g.linhas.length === 1 ? "execução" : "execuções"}
                </span>
              </th>
              <td className="cx-num" colSpan={2}>
                {usd(g.custo)}
              </td>
              <td colSpan={2} />
            </tr>
            {g.linhas.map((l) => {
              const texto = l.erro ?? l.saida ?? "";
              const pode = !!texto;
              const aberto = aberta === l.id;
              const t = l.tokensEntrada + l.tokensSaida;
              return (
                <Fragment key={l.id}>
                  <tr
                    className="cx-exec-linha"
                    data-status={l.status}
                    data-aberta={aberto ? "" : undefined}
                    data-pode={pode ? "" : undefined}
                    onClick={pode ? () => setAberta(aberto ? null : l.id) : undefined}
                  >
                    <td data-rotulo="Hora" className="cx-exec-hora">
                      <time dateTime={l.em}>{fmtHora.format(new Date(l.em))}</time>
                    </td>
                    <td data-rotulo="Chefe">
                      <ChipChefe nome={l.tipo === "REVISOR" ? "Revisor" : l.chefe} />
                    </td>
                    <td data-rotulo="Ação" className="cx-exec-skill-c">
                      <span className="cx-exec-skill">{l.acao ?? l.titulo ?? (l.tipo === "REVISOR" ? "Revisão" : l.tipo === "CHEFE" ? "Pedido ao chefe" : "—")}</span>
                      <span className="cx-exec-tipo">{ROTULO_TIPO[l.tipo]}</span>
                    </td>
                    <td data-rotulo="Modelo" className="cx-exec-modelo cx-exec-col-modelo">
                      {l.modelo === "direto" ? "—" : (l.modelo ?? "—")}
                    </td>
                    <td data-rotulo="Tokens" className="cx-num">
                      {t ? (
                        <>
                          {tokens(l.tokensEntrada)}
                          <span className="cx-exec-seta"> → </span>
                          {tokens(l.tokensSaida)}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td data-rotulo="Custo" className="cx-num">
                      {t ? usd(l.custoUsd) : "—"}
                    </td>
                    <td data-rotulo="Tempo" className="cx-num">
                      {tempo(l.tempoMs)}
                    </td>
                    <td data-rotulo="Resultado" className="cx-exec-res">
                      <span className="cx-exec-ponto" data-status={l.status} aria-hidden="true" />
                      {ROTULO_STATUS[l.status]}
                      {pode ? (
                        <button
                          type="button"
                          className="cx-exec-abrir"
                          aria-expanded={aberto}
                          aria-controls={`saida-${l.id}`}
                          aria-label={`${aberto ? "Fechar" : "Abrir"} ${l.erro ? "o erro" : "a saída"}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setAberta(aberto ? null : l.id);
                          }}
                        >
                          <ChevronDown size={16} strokeWidth={2.2} aria-hidden="true" />
                        </button>
                      ) : null}
                    </td>
                  </tr>
                  {aberto ? (
                    <tr className="cx-exec-saida" id={`saida-${l.id}`}>
                      <td colSpan={8}>
                        <div className="cx-exec-saida-corpo" data-erro={l.erro ? "" : undefined}>
                          <p className="cx-exec-saida-titulo">{l.erro ? "Erro" : (l.titulo ?? "Saída")}</p>
                          <pre>{texto}</pre>
                          {!l.erro && l.saida && l.saida.length >= 1500 ? <p className="cx-dica">Mostrando o começo da saída.</p> : null}
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        ))}
      </table>
    </div>
  );
}
