import { Star } from "lucide-react";

import { ChipVariacao } from "@/components/central/cabeca";
import { RetratoChefe, doChefe, idDoChefe } from "@/components/central/chefe";
import { GraficoLinha } from "@/components/central/inicio";
import { TextoLongo } from "@/components/central/texto-longo";
import type { AnaliseView, EntregaView, NumeroView, SerieView, VizinhosView } from "@/components/central/tipos";

/**
 * Peças das páginas de departamento. Cada página tem UMA estrutura dominante
 * (DESIGN.md 6.2): Presença = ranking contra os vizinhos; Redes = calendário;
 * Vendas = mensagens prontas; Estratégia = quadro do Conselho; Operação =
 * gráfico. A leitura do chefe entra em formato curto em todas.
 */

const fmtQuando = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "numeric", month: "short" });
const fmtDiaSemana = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short" });
const fmtDiaNum = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "numeric" });
const chaveDia = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" });
const fmtNota = (v: number | null) =>
  v === null ? "—" : v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const ESTADO_ENTREGA: Record<EntregaView["estado"], string> = {
  pendente: "Esperando você",
  aprovada: "Aprovada",
  passada: "Passada",
  ajuste: "Em ajuste",
  pronto: "Pronta",
};

// ---------------------------------------------------------------------------
// Leitura do chefe (curta)
// ---------------------------------------------------------------------------

export function LeituraChefe({ chefe, a }: { chefe: string; a: AnaliseView }) {
  const texto =
    a.textoCompleto ||
    [a.paragrafo, a.fazer.length ? `### O que fazer\n\n${a.fazer.map((t, i) => `${i + 1}. ${t}`).join("\n")}` : ""]
      .filter(Boolean)
      .join("\n\n");
  return (
    <section className="cx-leitura-chefe" data-chefe={idDoChefe(chefe)} aria-label={`Leitura ${doChefe(chefe)}`}>
      <div className="cx-leitura-topo">
        <RetratoChefe nome={chefe} tamanho={44} className="cx-leitura-retrato" />
        <span className="cx-leitura-de">Leitura {doChefe(chefe)}</span>
        <span className="cx-leitura-periodo">{a.periodo}</span>
      </div>
      <TextoLongo titulo={a.frase} texto={texto || a.frase} chefe={chefe} linhas={3} />
    </section>
  );
}

// ---------------------------------------------------------------------------
// Presença: ranking de avaliações contra os vizinhos
// ---------------------------------------------------------------------------

export function RankingVizinhos({ v }: { v: VizinhosView }) {
  const linhas = [{ nome: "Você", ...v.voce, voce: true }, ...v.vizinhos.map((x) => ({ ...x, voce: false }))].sort(
    (a, b) => (b.avaliacoes ?? 0) - (a.avaliacoes ?? 0),
  );
  const max = Math.max(1, ...linhas.map((l) => l.avaliacoes ?? 0));
  const comNumero = v.vizinhos.filter((x) => x.avaliacoes !== null);
  const media = comNumero.length ? comNumero.reduce((s, x) => s + (x.avaliacoes ?? 0), 0) / comNumero.length : null;
  const variacao = v.voce.avaliacoes !== null && media ? Math.round(((v.voce.avaliacoes - media) / media) * 1000) / 10 : null;
  const posicao = linhas.findIndex((l) => l.voce) + 1;

  return (
    <section className="cx-painel cx-ranking" aria-labelledby="cx-ranking-t">
      <div className="cx-ranking-cabeca">
        <div>
          <p className="cx-rotulo">Avaliações no Google</p>
          <div className="cx-numero-linha">
            <p className="cx-numero-gigante">{v.voce.avaliacoes ?? "—"}</p>
            <ChipVariacao valor={variacao} />
          </div>
          <p className="cx-numero-base">vs. média dos vizinhos: {media === null ? "—" : Math.round(media).toLocaleString("pt-BR")}</p>
        </div>
        <div className="cx-ranking-lado">
          <p className="cx-rotulo">Nota</p>
          <p className="cx-numero-medio">{fmtNota(v.voce.nota)}</p>
          <p className="cx-rotulo">Posição</p>
          <p className="cx-numero-medio">
            {posicao}º<span> de {linhas.length}</span>
          </p>
        </div>
      </div>
      <h2 id="cx-ranking-t" className="cx-so-leitor">
        Você e os vizinhos por número de avaliações
      </h2>
      <ol className="cx-ranking-lista">
        {linhas.map((l, i) => (
          <li key={`${l.nome}-${i}`} data-voce={l.voce ? "true" : "false"}>
            <span className="cx-ranking-pos">{i + 1}</span>
            <span className="cx-ranking-nome">{l.nome}</span>
            <span className="cx-ranking-trilho" aria-hidden="true">
              <span style={{ width: `${l.avaliacoes ? Math.max(3, Math.round((l.avaliacoes / max) * 100)) : 3}%` }} />
            </span>
            <span className="cx-ranking-valor">{l.avaliacoes === null ? "—" : l.avaliacoes.toLocaleString("pt-BR")}</span>
            <span className="cx-ranking-nota">
              <Star size={14} strokeWidth={1.8} aria-hidden="true" /> {fmtNota(l.nota)}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Operação: gráfico de atendimentos + faixa de números
// ---------------------------------------------------------------------------

export function GraficoOperacao({ s, dias, numeros }: { s: SerieView; dias: number; numeros: NumeroView[] }) {
  const variacao = s.anterior ? Math.round(((s.total - s.anterior) / s.anterior) * 1000) / 10 : null;
  return (
    <section className="cx-painel cx-operacao" aria-labelledby="cx-operacao-t">
      <div className="cx-operacao-cabeca">
        <div>
          <h2 id="cx-operacao-t" className="cx-rotulo">
            Atendimentos · últimos {dias} dias
          </h2>
          <div className="cx-numero-linha">
            <p className="cx-numero-gigante">{s.total.toLocaleString("pt-BR")}</p>
            <ChipVariacao valor={variacao} />
          </div>
          {s.anterior !== null ? (
            <p className="cx-numero-base">vs. {dias} dias antes: {s.anterior.toLocaleString("pt-BR")}</p>
          ) : null}
        </div>
      </div>
      <div className="cx-operacao-grafico">
        <GraficoLinha pontos={s.dias.map((d) => d.total)} rotulo={`Atendimentos por dia nos últimos ${dias} dias`} />
      </div>
      <dl className="cx-faixa">
        {numeros.map((n) => (
          <div key={n.rotulo}>
            <dt className="cx-rotulo">{n.rotulo}</dt>
            <dd>
              <span className="cx-faixa-valor">{n.valor}</span>
              <ChipVariacao valor={n.variacao} menosEMelhor={n.menosEMelhor} />
            </dd>
            <dd className="cx-numero-base">{n.base}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Redes: calendário dos últimos 14 dias com o que a Editora Pauta entregou
// ---------------------------------------------------------------------------

type ItemCalendario = { id: string; titulo: string; tipo: string; em: string; estado: EntregaView["estado"] };

export function CalendarioPauta({ itens, agora }: { itens: ItemCalendario[]; agora: number }) {
  const dias = Array.from({ length: 14 }, (_, i) => new Date(agora - (13 - i) * 86_400_000));
  const hoje = chaveDia.format(agora);
  const porDia = new Map<string, ItemCalendario[]>();
  for (const it of itens) {
    const k = chaveDia.format(new Date(it.em));
    porDia.set(k, [...(porDia.get(k) ?? []), it]);
  }
  return (
    <section className="cx-painel cx-calendario" aria-labelledby="cx-calendario-t">
      <h2 id="cx-calendario-t" className="cx-rotulo">
        Últimos 14 dias
      </h2>
      <ol className="cx-calendario-grade">
        {dias.map((d) => {
          const k = chaveDia.format(d);
          const lista = porDia.get(k) ?? [];
          return (
            <li key={k} className="cx-calendario-dia" data-hoje={k === hoje ? "true" : "false"} data-vazio={lista.length ? "false" : "true"}>
              <span className="cx-calendario-data">
                <span>{fmtDiaSemana.format(d).replace(".", "")}</span>
                <strong>{fmtDiaNum.format(d)}</strong>
              </span>
              {lista.map((it) => (
                <span key={it.id} className="cx-calendario-item" data-estado={it.estado}>
                  <span className="cx-calendario-tipo">{it.tipo}</span>
                  <span className="cx-calendario-titulo">{it.titulo}</span>
                </span>
              ))}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Estratégia: o quadro do Conselho
// ---------------------------------------------------------------------------

export function QuadroConselho({ a }: { a: AnaliseView }) {
  const colunas = [
    { titulo: "Está funcionando", itens: a.funcionando, tom: "verde" },
    { titulo: "Fazer agora", itens: a.fazer, tom: "chefe" },
    { titulo: "Depois", itens: a.proximos, tom: "neutro" },
  ];
  return (
    <section className="cx-quadro" aria-labelledby="cx-quadro-frase">
      <div className="cx-quadro-topo">
        <RetratoChefe nome="Conselho" tamanho={44} className="cx-leitura-retrato" />
        <span className="cx-leitura-de">O Conselho recomenda</span>
        <span className="cx-leitura-periodo">{a.periodo}</span>
      </div>
      <h2 id="cx-quadro-frase" className="cx-quadro-frase">
        {a.frase}
      </h2>
      <div className="cx-quadro-colunas">
        {colunas.map((c) => (
          <div key={c.titulo} className="cx-quadro-coluna" data-tom={c.tom}>
            <h3 className="cx-rotulo">
              {c.titulo} <span>{c.itens.length}</span>
            </h3>
            {c.itens.length ? (
              <ul>
                {c.itens.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            ) : (
              <p className="cx-dica">Nada nesta leitura.</p>
            )}
          </div>
        ))}
      </div>
      {a.textoCompleto ? (
        <TextoLongo titulo={a.frase} texto={a.textoCompleto} chefe="Conselho" soBotao rotuloVer="Ver a análise completa" />
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Entregas (lista curta)
// ---------------------------------------------------------------------------

export function ProntoParaVoce({ entregas }: { entregas: EntregaView[] }) {
  return (
    <section className="cx-entregas-bloco" aria-labelledby="cx-pronto-t">
      <h2 id="cx-pronto-t" className="cx-secao-titulo">
        Últimos trabalhos
      </h2>
      <ul className="cx-entregas">
        {entregas.map((e) => (
          <li key={e.id} className="cx-entrega">
            <span className="cx-entrega-titulo">{e.titulo}</span>
            <span className="cx-entrega-meta">
              <span className={`cx-estado cx-estado--${e.estado}`}>{ESTADO_ENTREGA[e.estado]}</span>
              <time dateTime={e.em}>{fmtQuando.format(new Date(e.em))}</time>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
