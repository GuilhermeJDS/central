"use client";

/**
 * Cardápio do chefe (Trato, Conselho): cada skill do repositório é uma ação
 * com nome claro, o que entrega e um botão. O trabalho pronto cai em
 * Decisões para o sim do dono; o "Próximo passo" continua de lá.
 */
import {
  BadgeDollarSign,
  BookOpenCheck,
  Building2,
  CalendarClock,
  CalendarRange,
  ChartColumn,
  ClipboardList,
  Compass,
  Crosshair,
  Dumbbell,
  FileSignature,
  FileText,
  Filter,
  Flame,
  Gift,
  Hammer,
  Lightbulb,
  LoaderCircle,
  Megaphone,
  MessageCircleReply,
  MessagesSquare,
  NotebookPen,
  Palette,
  PanelsTopLeft,
  PlayCircle,
  Radar,
  Rocket,
  ScrollText,
  ShieldQuestion,
  Swords,
  TrendingUp,
  UserRoundSearch,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { gerarDoCardapioAcao, statusPedidoAcao } from "@/app/central/acoes-departamento";
import { useTrava } from "@/components/central/trava";
import type { Ticket } from "@/lib/central/dados";
import { acoesDoChefe } from "@/lib/chefes/cardapio";

/** Ícone de cada ação do cardápio (Lucide, traço uniforme — DESIGN.md 6.5). */
const ICONE_ACAO: Record<string, LucideIcon> = {
  "cliente-sumido": MessageCircleReply,
  "follow-up": MessagesSquare,
  funil: Filter,
  previsao: TrendingUp,
  registro: NotebookPen,
  agenda: CalendarClock,
  prospeccao: Radar,
  pesquisa: UserRoundSearch,
  objecoes: ShieldQuestion,
  treino: Dumbbell,
  "cliente-grande": Building2,
  "acompanhar-grande": ClipboardList,
  proposta: FileText,
  contrato: FileSignature,
  conselho: Users,
  "teste-sem-do": Flame,
  concorrentes: Swords,
  "clientes-simulados": UserRoundSearch,
  "dor-cara": Crosshair,
  oferta: Gift,
  "pagina-oferta": PanelsTopLeft,
  preco: BadgeDollarSign,
  "preco-pelo-gasto": Wallet,
  "pre-venda": Megaphone,
  numeros: ChartColumn,
  operacao: Hammer,
  "o-que-construir": Lightbulb,
  marketing: Megaphone,
  marca: Palette,
  lancamento: Rocket,
  "cronograma-lancamento": CalendarRange,
  demonstracao: PlayCircle,
  caso: BookOpenCheck,
  plano: Compass,
};

type Estado = { fase: "gerando" } | { fase: "pronto" } | { fase: "erro"; mensagem: string };

export function CardapioChefe({ chefe, ativo }: { chefe: string; ativo: boolean }) {
  const router = useRouter();
  const acoes = acoesDoChefe(chefe);
  const grupos = useMemo(() => [...new Set(acoes.map((a) => a.grupo))], [acoes]);
  const [estados, setEstados] = useState<Record<string, Estado>>({});
  /** Ações que pedem texto: o campo aberto e o que o dono escreveu. */
  const [textos, setTextos] = useState<Record<string, string | undefined>>({});
  const [, iniciar] = useTransition();
  const { bloquear } = useTrava();
  const vivos = useRef(true);
  useEffect(() => {
    vivos.current = true;
    return () => {
      vivos.current = false;
    };
  }, []);

  async function acompanhar(id: string, ticket: Ticket) {
    for (let i = 0; i < 200 && vivos.current; i++) {
      await new Promise((ok) => setTimeout(ok, 3000));
      const s = await statusPedidoAcao(ticket).catch(() => null);
      if (!s || s.estado === "preparando") continue;
      if (s.estado === "concluida") {
        setEstados((e) => ({ ...e, [id]: { fase: "pronto" } }));
        router.refresh();
      } else {
        const mensagem = s.estado === "falhou" ? (s.mensagem ?? "Não deu certo desta vez.") : "Não deu certo desta vez.";
        setEstados((e) => ({ ...e, [id]: { fase: "erro", mensagem } }));
      }
      return;
    }
  }

  function gerar(id: string) {
    if (bloquear() || !ativo) return;
    const a = acoes.find((x) => x.id === id);
    // Primeiro clique numa ação que pede texto: abre o campo.
    if (a?.pedeTexto && textos[id] === undefined) {
      setTextos((t) => ({ ...t, [id]: "" }));
      return;
    }
    setEstados((e) => ({ ...e, [id]: { fase: "gerando" } }));
    iniciar(async () => {
      const r = await gerarDoCardapioAcao(chefe, id, textos[id]);
      if (!r.ticket) {
        setEstados((e) => ({ ...e, [id]: { fase: "erro", mensagem: r.erro ?? "Não deu para enviar agora." } }));
        return;
      }
      void acompanhar(id, r.ticket);
    });
  }

  return (
    <section className="cx-cardapio" aria-labelledby="cx-cardapio-t">
      <div className="cx-prontas-topo">
        <h2 id="cx-cardapio-t" className="cx-prontas-titulo">
          O que {chefe === "Conselho" ? "o Conselho faz" : `o ${chefe.split(" ").at(-1)} faz`}
        </h2>
        <span className="cx-prontas-conta">{acoes.length}</span>
      </div>
      {grupos.map((g) => (
        <div key={g} className="cx-cardapio-grupo">
          <h3 className="cx-cardapio-grupo-titulo">{g}</h3>
          <ul className="cx-cardapio-grade">
            {acoes
              .filter((a) => a.grupo === g)
              .map((a) => {
                const e = estados[a.id];
                const Icone = ICONE_ACAO[a.id] ?? ScrollText;
                return (
                  <li key={a.id} className="cx-cardapio-card" data-fase={e?.fase}>
                    <span className="cx-cardapio-icone" aria-hidden="true">
                      <Icone size={22} strokeWidth={1.8} />
                    </span>
                    <p className="cx-cardapio-rotulo">{a.rotulo}</p>
                    <p className="cx-cardapio-sai" title={a.sai}>
                      {a.sai}
                    </p>
                    {a.pedeTexto && textos[a.id] !== undefined ? (
                      <label className="cx-acao-texto">
                        <span className="cx-campo-rotulo">{a.pedeTexto.rotulo}</span>
                        <textarea
                          className="cx-input"
                          rows={4}
                          maxLength={12000}
                          autoFocus
                          value={textos[a.id]}
                          onChange={(ev) => setTextos((t) => ({ ...t, [a.id]: ev.target.value }))}
                        />
                      </label>
                    ) : null}
                    {e?.fase === "erro" ? (
                      <p className="cx-aviso cx-aviso--erro" role="status">
                        {e.mensagem}
                      </p>
                    ) : e?.fase === "pronto" ? (
                      <p className="cx-aviso cx-aviso--ok" role="status">
                        Pronto.{" "}
                        <Link href="/central/decisoes" className="cx-pp-link">
                          Ver em Decisões
                        </Link>
                      </p>
                    ) : null}
                    <button
                      type="button"
                      className="cx-botao cx-botao--suave cx-cardapio-botao"
                      onClick={() => gerar(a.id)}
                      disabled={e?.fase === "gerando"}
                      aria-label={`Gerar: ${a.rotulo}`}
                    >
                      {e?.fase === "gerando" ? (
                        <>
                          <LoaderCircle size={16} strokeWidth={2} className="cx-girando" aria-hidden="true" /> Gerando…
                        </>
                      ) : a.pedeTexto && textos[a.id] !== undefined ? (
                        "Gerar com este texto"
                      ) : (
                        "Gerar"
                      )}
                    </button>
                  </li>
                );
              })}
          </ul>
        </div>
      ))}
    </section>
  );
}
