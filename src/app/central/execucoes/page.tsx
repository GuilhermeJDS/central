import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import { CabecaPagina, ChipVariacao } from "@/components/central/cabeca";
import { FiltrosExecucoes, GraficoMes, MiniGrafico, TabelaExecucoes } from "@/components/central/execucoes-painel";
import { ROTULO_STATUS, ROTULO_TIPO, tempo, tokens, usd } from "@/lib/central/execucoes-formato";
import type { StatusExecucao, TipoExecucao } from "@/generated/prisma/client";
import {
  lerMes,
  listarExecucoes,
  mesAtual,
  mesVizinho,
  opcoesDeFiltro,
  serieDoMes,
  totaisDoMes,
  type FiltrosExecucoes as Filtros,
} from "@/lib/central/execucoes-painel";

import { contexto } from "../_lib/painel";

type Props = { searchParams: Promise<Record<string, string | undefined>> };

const TIPOS: TipoExecucao[] = ["CHEFE", "SKILL", "REVISOR", "PRODUCAO"];
const STATUS: StatusExecucao[] = ["CONCLUIDA", "ERRO", "RODANDO", "NA_FILA", "RECUSADA"];

const fmtMes = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
const fmtInt = new Intl.NumberFormat("pt-BR");

function nomeMes(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  const t = fmtMes.format(new Date(Date.UTC(a, m - 1, 1)));
  return t.charAt(0).toUpperCase() + t.slice(1);
}
function variacao(atual: number, antes: number): number | null {
  return antes ? Math.round(((atual - antes) / antes) * 1000) / 10 : null;
}
/** Dia de hoje (São Paulo) se o mês é o atual; senão o último dia. */
function diaDeHoje(mes: string): number | null {
  if (mes !== mesAtual()) return null;
  return new Date(Date.now() - 3 * 3_600_000).getUTCDate();
}

/**
 * Execuções (para quem desenvolve). Estrutura dominante (DESIGN.md 6.11): log
 * com instrumentos — métricas com mini-gráficos, o mês dia a dia e a tabela
 * densa agrupada por dia; o custo do mês é o bloco cheio.
 */
export default async function PaginaExecucoes({ searchParams }: Props) {
  const c = await contexto();
  if (!c) return null;
  const sp = await searchParams;
  const mes = lerMes(sp.m);
  const filtros: Filtros = {
    mes,
    chefe: sp.chefe || undefined,
    acao: sp.acao || undefined,
    modelo: sp.modelo || undefined,
    tipo: TIPOS.includes(sp.tipo as TipoExecucao) ? (sp.tipo as TipoExecucao) : undefined,
    status: STATUS.includes(sp.status as StatusExecucao) ? (sp.status as StatusExecucao) : undefined,
  };
  const conta = c.accountId;
  const [linhas, totais, opcoes, serie] = conta
    ? await Promise.all([listarExecucoes(conta, filtros), totaisDoMes(conta, filtros), opcoesDeFiltro(conta, mes), serieDoMes(conta, filtros)])
    : [[], null, { chefes: [], acoes: [], modelos: [] }, []];
  const filtrado = !!(filtros.chefe || filtros.acao || filtros.modelo || filtros.tipo || filtros.status);
  const link = (m: string) => {
    const q = new URLSearchParams();
    if (m !== mesAtual()) q.set("m", m);
    for (const k of ["chefe", "acao", "modelo", "tipo", "status"] as const) if (sp[k]) q.set(k, sp[k] as string);
    const s = q.toString();
    return `/central/execucoes${s ? `?${s}` : ""}`;
  };
  const proximo = mesVizinho(mes, 1);
  const futuro = proximo > mesAtual();
  const hoje = diaDeHoje(mes);
  const ate = hoje ?? serie.length;

  return (
    <>
      <CabecaPagina
        secao="Ajustes · Execuções"
        titulo="Execuções"
        subtitulo="Cada chamada dos chefes ao modelo: quanto custou, quanto demorou e o que saiu."
      >
        <nav className="cx-mes" aria-label="Mês">
          <Link href={link(mesVizinho(mes, -1))} className="cx-icone-botao" aria-label="Mês anterior">
            <ChevronLeft size={18} strokeWidth={1.8} aria-hidden="true" />
          </Link>
          <span className="cx-mes-nome">{nomeMes(mes)}</span>
          {futuro ? (
            <span className="cx-icone-botao" aria-disabled="true" data-desligado="">
              <ChevronRight size={18} strokeWidth={1.8} aria-hidden="true" />
            </span>
          ) : (
            <Link href={link(proximo)} className="cx-icone-botao" aria-label="Próximo mês">
              <ChevronRight size={18} strokeWidth={1.8} aria-hidden="true" />
            </Link>
          )}
        </nav>
      </CabecaPagina>

      {!conta || !totais ? (
        <div className="cx-painel cx-folha-espera">
          <p className="cx-card-titulo">Sem execuções nesta Central.</p>
          <p className="cx-dica">Com o plano liberado, cada chamada dos chefes aparece aqui.</p>
        </div>
      ) : (
        <div className="cx-exec2">
          <dl className="cx-exec-faixa" aria-label={`Total de ${nomeMes(mes)}${filtrado ? " (com filtros)" : ""}`}>
            <div className="cx-exec-metrica cx-exec-metrica--custo">
              <dt>Custo estimado{filtrado ? " · filtrado" : ""}</dt>
              <dd className="cx-exec-metrica-num">{usd(totais.custoUsd)}</dd>
              <dd className="cx-exec-metrica-apoio">
                mês anterior: {usd(totais.anterior.custoUsd)}
                {totais.semPreco ? ` · ${totais.semPreco} sem preço` : ""}
              </dd>
              <dd>
                <MiniGrafico pontos={serie.map((d) => d.custoUsd)} ate={ate} rotulo="Custo por dia no mês" />
              </dd>
            </div>
            <div className="cx-exec-metrica">
              <dt>Execuções</dt>
              <dd className="cx-exec-metrica-num">
                {fmtInt.format(totais.execucoes)}
                <ChipVariacao valor={variacao(totais.execucoes, totais.anterior.execucoes)} />
              </dd>
              <dd className="cx-exec-metrica-apoio">mês anterior: {fmtInt.format(totais.anterior.execucoes)}</dd>
              <dd>
                <MiniGrafico pontos={serie.map((d) => d.execucoes)} ate={ate} rotulo="Execuções por dia no mês" />
              </dd>
            </div>
            <div className="cx-exec-metrica">
              <dt>Tokens</dt>
              <dd className="cx-exec-metrica-num">{tokens(totais.tokensEntrada + totais.tokensSaida)}</dd>
              <dd className="cx-exec-metrica-apoio">
                {tokens(totais.tokensEntrada)} entrada · {tokens(totais.tokensSaida)} saída
              </dd>
              <dd>
                <MiniGrafico pontos={serie.map((d) => d.tokens)} ate={ate} rotulo="Tokens por dia no mês" />
              </dd>
            </div>
            <div className="cx-exec-metrica">
              <dt>Tempo médio</dt>
              <dd className="cx-exec-metrica-num">{tempo(totais.tempoMedioMs)}</dd>
              <dd className="cx-exec-metrica-apoio">do início ao fim</dd>
              <dd>
                <MiniGrafico pontos={serie.map((d) => d.tempoMedioMs)} ate={ate} rotulo="Tempo médio por dia no mês" />
              </dd>
            </div>
            <div className="cx-exec-metrica">
              <dt>Falhas</dt>
              <dd className="cx-exec-metrica-num">{fmtInt.format(totais.erros)}</dd>
              <dd className="cx-exec-metrica-apoio">
                {totais.execucoes ? `${Math.round((totais.erros / totais.execucoes) * 100)}% das execuções` : "—"}
              </dd>
              <dd>
                <MiniGrafico pontos={serie.map((d) => d.erros)} ate={ate} rotulo="Falhas por dia no mês" />
              </dd>
            </div>
          </dl>

          <GraficoMes serie={serie} hoje={hoje} nomeMes={nomeMes(mes)} />

          <FiltrosExecucoes
            opcoes={[
              { nome: "chefe", rotulo: "Chefe", valores: opcoes.chefes.map((v) => [v, v]) },
              { nome: "acao", rotulo: "Ação", valores: opcoes.acoes.map((v) => [v, v]) },
              { nome: "modelo", rotulo: "Modelo", valores: opcoes.modelos.map((v) => [v, v]) },
              { nome: "tipo", rotulo: "Tipo", valores: TIPOS.map((v) => [v, ROTULO_TIPO[v]]) },
              { nome: "status", rotulo: "Resultado", valores: STATUS.map((v) => [v, ROTULO_STATUS[v]]) },
            ]}
          />

          {linhas.length ? (
            <TabelaExecucoes linhas={linhas} legenda={`Execuções de ${nomeMes(mes)}, mais novas primeiro, agrupadas por dia (até 200)`} />
          ) : (
            <p className="cx-dica">Nenhuma execução {filtrado ? "com esses filtros" : "neste mês"}.</p>
          )}
        </div>
      )}
    </>
  );
}
