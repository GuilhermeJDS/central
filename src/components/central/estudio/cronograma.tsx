"use client";

/**
 * Cronograma do estúdio. Estrutura dominante: o calendário do mês. Cada
 * peça na cor da rede, com a etapa marcada; arrastar para outro dia muda a
 * data (ou solte em "Sem data"). No toque e no teclado, a peça abre um
 * menu com "Mudar data".
 */
import { CalendarClock, Check, CheckCheck, ChevronLeft, ChevronRight, ExternalLink, PenLine, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type DragEvent } from "react";

import { programarAcao } from "@/app/central/acoes-estudio";
import { SlideVista } from "@/components/central/estudio/slide-vista";
import { ROTULO_REDE, ROTULO_TIPO } from "@/lib/central/entregas-tipos";
import { comRede, hrefDaPeca, REDES_FILTRO, slugDaRede } from "@/lib/central/estudio/secoes";
import { ROTULO_ETAPA, type Etapa, type PecaView } from "@/lib/central/estudio/tipos";

const FUSO = "America/Sao_Paulo";
const chaveDia = new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" });
const fmtMes = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", month: "long", year: "numeric" });
const fmtDiaLongo = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });
const SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const ICONE_ETAPA: Record<Etapa, typeof Check> = {
  EM_REVISAO: PenLine,
  APROVADO: Check,
  PROGRAMADO: CalendarClock,
  PUBLICADO: CheckCheck,
};

export function diaDaPeca(p: PecaView): string | null {
  const d = p.publicadaEm ?? p.programadaPara;
  return d ? chaveDia.format(new Date(d)) : null;
}

function addMes(mes: string, n: number): string {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function Chip({
  peca,
  rede,
  nomeNegocio,
  aberto,
  onAbrir,
  onMudarData,
}: {
  peca: PecaView;
  rede: string | null;
  nomeNegocio: string;
  aberto: boolean;
  onAbrir: (id: string | null) => void;
  onMudarData: (id: string, dia: string | null) => void;
}) {
  const slug = slugDaRede(peca.rede);
  const Icone = ICONE_ETAPA[peca.etapa];
  const dia = diaDaPeca(peca);
  return (
    <div className="cx-cron-peca-caixa">
      <button
        type="button"
        className="cx-cron-peca"
        data-rede={slug ?? undefined}
        data-etapa={peca.etapa}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", peca.id);
          e.dataTransfer.effectAllowed = "move";
        }}
        onClick={() => onAbrir(aberto ? null : peca.id)}
        aria-expanded={aberto}
        aria-label={`${peca.titulo}. ${peca.rede ? ROTULO_REDE[peca.rede] : ""}, ${ROTULO_ETAPA[peca.etapa]}`}
      >
        {peca.capa ? (
          <span className="cx-cron-capa" aria-hidden="true">
            <SlideVista slide={peca.capa.slide} indice={0} total={peca.capa.total} marca={peca.capa.marca} nomeNegocio={nomeNegocio} />
          </span>
        ) : (
          <span className="cx-rede-ponto" aria-hidden="true" />
        )}
        <span className="cx-cron-peca-titulo">{peca.titulo}</span>
        <Icone size={13} strokeWidth={2.2} className="cx-cron-etapa" aria-hidden="true" />
      </button>
      {aberto ? (
        <div className="cx-cron-menu" role="dialog" aria-label={peca.titulo}>
          <p className="cx-cron-menu-titulo">{peca.titulo}</p>
          <p className="cx-pp-meta">
            {ROTULO_TIPO[peca.tipo]} · {peca.rede ? ROTULO_REDE[peca.rede] : "Sem rede"} · {ROTULO_ETAPA[peca.etapa]}
          </p>
          <label className="cx-campo">
            <span className="cx-campo-rotulo">{peca.etapa === "PUBLICADO" ? "Publicado em" : "Sai em"}</span>
            <input
              type="date"
              className="cx-input"
              defaultValue={dia ?? ""}
              onChange={(e) => e.target.value && onMudarData(peca.id, e.target.value)}
            />
          </label>
          <div className="cx-cron-menu-acoes">
            {dia ? (
              <button type="button" className="cx-botao cx-botao--fantasma-escuro" onClick={() => onMudarData(peca.id, null)}>
                <X size={15} strokeWidth={1.8} aria-hidden="true" /> Tirar a data
              </button>
            ) : null}
            <Link href={hrefDaPeca(peca, rede)} className="cx-botao cx-botao--suave">
              <ExternalLink size={15} strokeWidth={1.8} aria-hidden="true" /> Abrir
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function Cronograma({
  pecas: iniciais,
  mes,
  hoje,
  rede,
  nomeNegocio,
}: {
  pecas: PecaView[];
  /** "2026-11" */
  mes: string;
  /** "2026-11-11" (São Paulo) */
  hoje: string;
  rede: string | null;
  nomeNegocio: string;
}) {
  const router = useRouter();
  const [pecas, setPecas] = useState(iniciais);
  const [base, setBase] = useState(iniciais);
  if (base !== iniciais) {
    setBase(iniciais);
    setPecas(iniciais);
  }
  const [aberto, setAberto] = useState<string | null>(null);
  const [alvo, setAlvo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [, iniciar] = useTransition();

  const [ano, m] = mes.split("-").map(Number);
  const primeiro = new Date(Date.UTC(ano, m - 1, 1));
  const diasNoMes = new Date(Date.UTC(ano, m, 0)).getUTCDate();
  const vazios = primeiro.getUTCDay();
  const dias = Array.from({ length: diasNoMes }, (_, i) => `${mes}-${String(i + 1).padStart(2, "0")}`);

  const porDia = new Map<string, PecaView[]>();
  const semData: PecaView[] = [];
  for (const p of pecas) {
    const d = diaDaPeca(p);
    if (!d) {
      if (p.producao === "PRONTA") semData.push(p);
    } else porDia.set(d, [...(porDia.get(d) ?? []), p]);
  }
  const noMes = dias.reduce((n, d) => n + (porDia.get(d)?.length ?? 0), 0);

  function mudarData(id: string, dia: string | null) {
    setErro(null);
    setAberto(null);
    const antes = pecas;
    setPecas((l) =>
      l.map((p) => {
        if (p.id !== id) return p;
        const iso = dia ? `${dia}T15:00:00.000Z` : null;
        if (p.etapa === "PUBLICADO") return { ...p, publicadaEm: iso };
        const etapa: Etapa = p.etapa === "APROVADO" && dia ? "PROGRAMADO" : p.etapa === "PROGRAMADO" && !dia ? "APROVADO" : p.etapa;
        return { ...p, programadaPara: iso, etapa };
      }),
    );
    iniciar(async () => {
      const r = await programarAcao(id, dia);
      if (r.erro !== null) {
        setErro(r.erro);
        setPecas(antes);
      } else router.refresh();
    });
  }

  const soltar = (dia: string | null) => ({
    onDragOver: (e: DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setAlvo(dia ?? "sem-data");
    },
    onDragLeave: () => setAlvo((a) => (a === (dia ?? "sem-data") ? null : a)),
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      setAlvo(null);
      const id = e.dataTransfer.getData("text/plain");
      if (id) mudarData(id, dia);
    },
  });

  const chip = (p: PecaView) => (
    <Chip key={p.id} peca={p} rede={rede} nomeNegocio={nomeNegocio} aberto={aberto === p.id} onAbrir={setAberto} onMudarData={mudarData} />
  );

  return (
    <div className="cx-cron">
      <div className="cx-cron-topo">
        <div className="cx-cron-mes">
          <Link href={comRede(`/central/redes?mes=${addMes(mes, -1)}`, rede)} className="cx-vz-seta" aria-label="Mês anterior" scroll={false}>
            <ChevronLeft size={20} strokeWidth={1.8} aria-hidden="true" />
          </Link>
          <h2 className="cx-cron-mes-nome">{fmtMes.format(primeiro)}</h2>
          <Link href={comRede(`/central/redes?mes=${addMes(mes, 1)}`, rede)} className="cx-vz-seta" aria-label="Próximo mês" scroll={false}>
            <ChevronRight size={20} strokeWidth={1.8} aria-hidden="true" />
          </Link>
          {mes !== hoje.slice(0, 7) ? (
            <Link href={comRede("/central/redes", rede)} className="cx-pp-link" scroll={false}>
              Hoje
            </Link>
          ) : null}
        </div>
        <p className="cx-cron-total">
          <strong>{noMes}</strong> {noMes === 1 ? "peça no mês" : "peças no mês"}
        </p>
      </div>

      <ul className="cx-cron-legenda" aria-label="Legenda">
        {REDES_FILTRO.filter((r) => !rede || r.slug === rede).map((r) => (
          <li key={r.slug} data-rede={r.slug}>
            <span className="cx-rede-ponto" aria-hidden="true" /> {r.nome}
          </li>
        ))}
        {(Object.keys(ICONE_ETAPA) as Etapa[]).map((e) => {
          const I = ICONE_ETAPA[e];
          return (
            <li key={e} data-etapa={e}>
              <I size={13} strokeWidth={2.2} className="cx-cron-etapa" aria-hidden="true" /> {ROTULO_ETAPA[e]}
            </li>
          );
        })}
      </ul>

      {erro ? (
        <p role="alert" className="cx-aviso cx-aviso--erro">
          {erro}
        </p>
      ) : null}

      <div className="cx-cron-corpo">
        <div className="cx-cron-cal" role="grid" aria-label={`Calendário de ${fmtMes.format(primeiro)}`}>
          <div className="cx-cron-semana" role="row">
            {SEMANA.map((d) => (
              <span key={d} role="columnheader">
                {d}
              </span>
            ))}
          </div>
          <div className="cx-cron-dias" role="rowgroup">
            {Array.from({ length: vazios }, (_, i) => (
              <span key={`v${i}`} className="cx-cron-vazio" aria-hidden="true" />
            ))}
            {dias.map((d) => {
              const lista = porDia.get(d) ?? [];
              const dt = new Date(`${d}T12:00:00Z`);
              return (
                <div
                  key={d}
                  role="gridcell"
                  className="cx-cron-dia"
                  data-hoje={d === hoje ? "" : undefined}
                  data-passado={d < hoje ? "" : undefined}
                  data-vazio={lista.length ? undefined : ""}
                  data-alvo={alvo === d ? "" : undefined}
                  aria-label={fmtDiaLongo.format(dt)}
                  {...soltar(d)}
                >
                  <span className="cx-cron-num">
                    <span className="cx-cron-num-semana">{SEMANA[dt.getUTCDay()]}</span>
                    {dt.getUTCDate()}
                  </span>
                  {lista.map(chip)}
                </div>
              );
            })}
          </div>
        </div>

        <aside className="cx-cron-sem" data-alvo={alvo === "sem-data" ? "" : undefined} aria-labelledby="cx-cron-sem-t" {...soltar(null)}>
          <h2 id="cx-cron-sem-t" className="cx-pp-titulo">
            Sem data <span className="cx-pp-titulo-conta">{semData.length}</span>
          </h2>
          {semData.length ? (
            <div className="cx-cron-sem-lista">{semData.map(chip)}</div>
          ) : (
            <p className="cx-pp-meta">Tudo com data. Arraste uma peça para cá para tirar do calendário.</p>
          )}
          <p className="cx-pp-meta cx-cron-dica">Arraste para um dia para programar. Aprovado com data vira Programado.</p>
        </aside>
      </div>
    </div>
  );
}
