"use client";

import { ArrowUpRight, ChevronLeft, ChevronRight, Plus, Undo2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { decidirNorteAcao, desfazerNorteAcao, gerarAcaoDaSemanaAcao } from "@/app/central/acoes-norte";
import { RetratoChefe } from "@/components/central/chefe";
import { TextoLongo } from "@/components/central/texto-longo";
import type { AcaoNorteView } from "@/components/central/tipos";
import { JuntouDe } from "@/components/central/veio-de";
import { useTrava } from "@/components/central/trava";

type Escolha = "korely" | "eu" | "agora_nao";
/** Estado de cada ação (decide a cor do card). */
type Estado = "aberta" | "korely" | "voce" | "adiada";

const AVISO_EXEMPLO = "Isto é um exemplo: nada foi gravado.";

const ROTULO_ESTADO: Record<Estado, string> = {
  aberta: "Aberta",
  korely: "Feita pela Korely",
  voce: "Feita por você",
  adiada: "Adiada",
};

function estadoDe(a: AcaoNorteView): Estado {
  if (a.decisao === "PASSADA") return "adiada";
  if (a.decisao === "APROVADA") return a.korelyFaz ? "korely" : "voce";
  return "aberta";
}

const aprovada = (e: Estado) => e === "korely" || e === "voce";

/**
 * O único bloco preenchido do Início (DESIGN.md 6.4): as ações da semana do
 * Norte (setas para andar entre elas), o placar da semana (aprovadas desde
 * segunda, 0 a 5) e as escolhas, que ficam gravadas e podem ser desfeitas.
 */
export function CardNorte({
  acoes,
  ceu,
  exemplo,
  podeGerar,
  podeMais,
}: {
  acoes: AcaoNorteView[];
  ceu: number;
  exemplo: boolean;
  /** Conta com ficha e sem ação real nesta semana: dá para pedir a primeira. */
  podeGerar: boolean;
  /** Já tem ações reais e cabe mais uma (até 5 por semana). */
  podeMais: boolean;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const trava = useTrava();
  // Escolhas feitas nesta tela (por id), por cima do que veio do servidor.
  const [local, setLocal] = useState<Record<string, Estado>>({});
  const [acompanhar, setAcompanhar] = useState<Record<string, string>>({});
  const [indice, setIndice] = useState(() => {
    const aberta = acoes.findIndex((a) => estadoDe(a) === "aberta");
    return aberta >= 0 ? aberta : Math.max(0, acoes.length - 1);
  });
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);

  const i = Math.min(indice, acoes.length - 1);
  const acao = acoes[i];
  const chave = (a: AcaoNorteView, n: number) => a.execucaoId ?? `exemplo-${n}`;
  const estadoAtual = (a: AcaoNorteView, n: number) => local[chave(a, n)] ?? estadoDe(a);
  const estado = estadoAtual(acao, i);

  // Placar: o do servidor + o que mudou aqui (aprovar soma, desfazer tira).
  const ajuste = acoes.reduce(
    (t, a, n) => t + (aprovada(estadoAtual(a, n)) ? 1 : 0) - (aprovada(estadoDe(a)) ? 1 : 0),
    0,
  );
  const placar = Math.max(0, Math.min(5, ceu + ajuste));

  function marcar(novo: Estado) {
    setLocal((l) => ({ ...l, [chave(acao, i)]: novo }));
  }

  function decidir(opcao: Escolha) {
    setErro(null);
    setAviso(null);
    // "Korely faz" chama o chefe (modelo); as outras escolhas não.
    if (opcao === "korely") {
      if (trava.bloquear()) return;
    } else if (trava.travado) {
      trava.abrir();
      return;
    }
    const antes = estado;
    marcar(opcao === "korely" ? "korely" : opcao === "eu" ? "voce" : "adiada");
    if (exemplo || !acao.execucaoId) {
      setAviso(AVISO_EXEMPLO);
      return;
    }
    const id = acao.execucaoId;
    iniciar(async () => {
      const r = await decidirNorteAcao(id, opcao);
      if (r.erro) {
        setErro(r.erro);
        marcar(antes);
        return;
      }
      if (r.acompanhar) setAcompanhar((m) => ({ ...m, [id]: r.acompanhar! }));
    });
  }

  function mudarDeIdeia() {
    setErro(null);
    setAviso(null);
    const antes = estado;
    marcar("aberta");
    if (exemplo || !acao.execucaoId) return;
    const id = acao.execucaoId;
    iniciar(async () => {
      const r = await desfazerNorteAcao(id);
      if (r.erro) {
        setErro(r.erro);
        marcar(antes);
      }
    });
  }

  function gerar() {
    setErro(null);
    if (trava.bloquear()) return;
    setGerando(true);
    iniciar(async () => {
      const r = await gerarAcaoDaSemanaAcao();
      setGerando(false);
      if (r.erro) setErro(r.erro);
      else {
        setIndice(acoes.length); // a nova entra no fim
        router.refresh();
      }
    });
  }

  const linkAcompanhar = acao.execucaoId ? acompanhar[acao.execucaoId] : undefined;
  const feitoTexto =
    estado === "adiada"
      ? "Fica para depois."
      : estado === "korely"
        ? "A Korely está cuidando disso."
        : "Combinado. Essa fica com você.";

  return (
    <div className="cx-norte-moldura" data-estado={estado}>
    <section className="cx-norte" data-estado={estado} data-ceu={placar} aria-labelledby="cx-norte-titulo">
      {(["aberta", "korely", "voce", "adiada"] as const).map((e) => (
        <span key={e} className="cx-norte-fundo" data-fundo={e} data-ativo={e === estado ? "" : undefined} aria-hidden="true" />
      ))}
      <span className="cx-norte-ruido" aria-hidden="true" />

      <div className="cx-norte-corpo">
        <div className="cx-norte-topo">
          <AnelSemana feitas={placar} />
          {acoes.length > 1 ? (
            <nav className="cx-norte-nav" aria-label="Ações da semana">
              <button
                type="button"
                className="cx-norte-seta"
                onClick={() => setIndice(Math.max(0, i - 1))}
                disabled={i === 0}
                aria-label="Ação anterior"
              >
                <ChevronLeft size={20} strokeWidth={2} aria-hidden="true" />
              </button>
              <span className="cx-norte-pos" aria-live="polite">
                {i + 1} de {acoes.length}
              </span>
              <button
                type="button"
                className="cx-norte-seta"
                onClick={() => setIndice(Math.min(acoes.length - 1, i + 1))}
                disabled={i === acoes.length - 1}
                aria-label="Próxima ação"
              >
                <ChevronRight size={20} strokeWidth={2} aria-hidden="true" />
              </button>
            </nav>
          ) : null}
        </div>

        <p className="cx-norte-linha">
          <span className="cx-norte-estado" data-estado={estado}>
            {ROTULO_ESTADO[estado]}
          </span>
          <span className="cx-norte-de">{acao.chefe} executa</span>
        </p>
        <h2 id="cx-norte-titulo" className="cx-norte-titulo" key={chave(acao, i)}>
          {acao.titulo}
        </h2>
        <p className="cx-norte-porque" key={`p-${chave(acao, i)}`}>
          {acao.porQue}
        </p>
        {acao.porQue.length > 170 ? (
          <TextoLongo titulo={acao.titulo} texto={acao.porQue} chefe="Norte" soBotao rotuloVer="Ler o porquê" className="cx-norte-ver" />
        ) : null}
        {acao.fontes?.length ? <JuntouDe fontes={acao.fontes} /> : null}

        <div className="cx-norte-botoes">
          {estado === "aberta" ? (
            <>
              <button type="button" className="cx-botao cx-botao--branco" disabled={pendente} onClick={() => decidir("korely")}>
                Korely, faz
              </button>
              <button type="button" className="cx-botao cx-botao--vidro" disabled={pendente} onClick={() => decidir("eu")}>
                Eu faço
              </button>
              <button type="button" className="cx-botao cx-botao--fantasma" disabled={pendente} onClick={() => decidir("agora_nao")}>
                Agora não
              </button>
            </>
          ) : (
            <>
              <p className="cx-norte-feito" role="status">
                {feitoTexto}
              </p>
              {estado === "korely" && !exemplo && (linkAcompanhar || acao.slug) ? (
                <Link href={linkAcompanhar ?? `/central/${acao.slug}`} className="cx-botao cx-botao--vidro">
                  Ver em {acao.departamentoNome}
                  <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
                </Link>
              ) : null}
              <button type="button" className="cx-botao cx-botao--fantasma cx-norte-desfazer" disabled={pendente} onClick={mudarDeIdeia}>
                <Undo2 size={16} strokeWidth={2} aria-hidden="true" />
                Mudar de ideia
              </button>
            </>
          )}
          {podeGerar || podeMais ? (
            <button type="button" className="cx-link-claro cx-norte-mais" disabled={pendente} onClick={gerar}>
              {gerando ? (
                "O Norte está pensando…"
              ) : podeMais ? (
                <>
                  <Plus size={15} strokeWidth={2.2} aria-hidden="true" /> Pedir mais uma ação
                </>
              ) : (
                "Gerar a ação real desta semana"
              )}
            </button>
          ) : null}
        </div>

        <div aria-live="polite" className="cx-norte-avisos">
          {aviso ? <p>{aviso}</p> : null}
          {erro ? <p className="cx-norte-erro">{erro}</p> : null}
        </div>
      </div>

      <div className="cx-norte-lado" aria-hidden="true">
        <RetratoChefe key={acao.chefe} nome={acao.chefe} tamanho={320} className="cx-norte-retrato" prioridade />
      </div>
    </section>
    </div>
  );
}

/** Placar da semana (0 a 5 ações feitas) como anel de progresso. */
function AnelSemana({ feitas }: { feitas: number }) {
  const r = 24;
  const volta = 2 * Math.PI * r;
  return (
    <p className="cx-norte-anel" aria-label={`Semana: ${feitas} de 5 ações feitas`}>
      <svg width="60" height="60" viewBox="0 0 60 60" aria-hidden="true">
        <circle cx="30" cy="30" r={r} className="cx-norte-anel-trilho" />
        <circle
          cx="30"
          cy="30"
          r={r}
          className="cx-norte-anel-feito"
          strokeDasharray={volta}
          strokeDashoffset={volta * (1 - feitas / 5)}
          transform="rotate(-90 30 30)"
        />
      </svg>
      <span className="cx-norte-anel-num" aria-hidden="true">
        {feitas}
        <small>/5</small>
      </span>
      <span className="cx-norte-anel-rotulo" aria-hidden="true">
        <strong>Semana</strong>
        ações feitas
      </span>
    </p>
  );
}
