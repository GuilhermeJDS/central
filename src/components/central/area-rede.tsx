"use client";

/**
 * Área de uma rede: um botão por coisa que a Editora Pauta faz ali (com a
 * skill daquela rede) e a fila do que espera o sim do dono, com Aprovar e
 * Passar no lugar. Aprovar manda produzir a peça, que cai em Entregas.
 */
import {
  CalendarDays,
  Check,
  Eraser,
  FileText,
  Inbox,
  MessageCircle,
  MessageSquareReply,
  Repeat2,
  Scissors,
  Send,
  Smartphone,
  TrendingDown,
  Clapperboard,
  Film,
  Flame,
  GalleryHorizontalEnd,
  Heading,
  ImageIcon,
  Lightbulb,
  ListOrdered,
  LoaderCircle,
  PenLine,
  SearchCheck,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { gerarNaAreaAcao, statusPedidoAcao } from "@/app/central/acoes-departamento";
import { decidirAcao } from "@/app/central/acoes-decisoes";
import { useTrava } from "@/components/central/trava";
import type { Ticket } from "@/lib/central/dados";
import type { TrabalhoRede } from "@/lib/central/redes-dados";
import type { AreaRede } from "@/lib/central/redes-areas";

const ICONE: Record<string, LucideIcon> = {
  viral: Flame,
  reels: Clapperboard,
  roteiro: Clapperboard,
  roteiros: Clapperboard,
  carrossel: GalleryHorizontalEnd,
  plano: CalendarDays,
  perfil: UserRound,
  ideias: Lightbulb,
  titulos: Heading,
  thumbnail: ImageIcon,
  shorts: Film,
  auditoria: SearchCheck,
  thread: ListOrdered,
  posts: PenLine,
  legenda: PenLine,
  stories: Smartphone,
  responder: MessageSquareReply,
  comentarios: MessageSquareReply,
  comentar: MessageCircle,
  direct: Send,
  dm: Send,
  convite: Send,
  caixa: Inbox,
  reaproveitar: Repeat2,
  analise: SearchCheck,
  "sem-cara-de-ia": Eraser,
  "viral-geral": Flame,
  descricao: FileText,
  capitulos: ListOrdered,
  retencao: TrendingDown,
  edicao: Scissors,
  "edicao-curta": Scissors,
  ganchos: Heading,
  fotos: GalleryHorizontalEnd,
};

type Estado = { fase: "gerando"; ticket: Ticket } | { fase: "pronto" } | { fase: "erro"; mensagem: string };

const NOME_REDE: Record<string, string> = { INSTAGRAM: "o Instagram", X: "o X", YOUTUBE: "o YouTube", LINKEDIN: "o LinkedIn" };

export function BotoesArea({
  area,
  conectadas,
  ativo,
}: {
  area: AreaRede;
  /** Redes conectadas da conta (as ações de viral precisam). */
  conectadas: string[];
  /** false = exemplo/sem plano/sem chave: o clique abre o aviso da trava, nada vai ao servidor. */
  ativo: boolean;
}) {
  const router = useRouter();
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
        const mensagem =
          s.estado === "falhou" ? (s.mensagem ?? "Não deu certo desta vez. Tente de novo.") : "Não deu certo desta vez.";
        setEstados((e) => ({ ...e, [id]: { fase: "erro", mensagem } }));
      }
      return;
    }
  }

  function gerar(id: string) {
    if (bloquear() || !ativo) return;
    const a = area.acoes.find((x) => x.id === id);
    // Primeiro clique numa ação que pede texto: abre o campo.
    if (a?.pedeTexto && textos[id] === undefined) {
      setTextos((t) => ({ ...t, [id]: "" }));
      return;
    }
    iniciar(async () => {
      const r = await gerarNaAreaAcao(area.slug, id, textos[id]);
      if (!r.ticket) {
        setEstados((e) => ({ ...e, [id]: { fase: "erro", mensagem: r.erro ?? "Não deu para enviar agora." } }));
        return;
      }
      setEstados((e) => ({ ...e, [id]: { fase: "gerando", ticket: r.ticket as Ticket } }));
      router.refresh();
      void acompanhar(id, r.ticket);
    });
  }

  return (
    <ul className="cx-area-acoes" aria-label={`O que gerar para ${area.nome}`}>
      {area.acoes.map((a) => {
        const Icone = ICONE[a.id] ?? Lightbulb;
        const e = estados[a.id];
        const falta = a.precisa && !conectadas.includes(a.precisa);
        const gerando = e?.fase === "gerando";
        return (
          <li key={a.id} className="cx-area-acao" data-fase={e?.fase}>
            <span className="cx-area-acao-icone" aria-hidden="true">
              <Icone size={22} strokeWidth={1.8} />
            </span>
            <div className="cx-area-acao-texto">
              <h3 className="cx-area-acao-titulo">{a.rotulo}</h3>
              <p className="cx-area-acao-sai">{a.sai}</p>
              {e?.fase === "erro" ? (
                <p className="cx-aviso cx-aviso--erro" role="status">
                  {e.mensagem}
                </p>
              ) : e?.fase === "pronto" ? (
                <p className="cx-aviso cx-aviso--ok" role="status">
                  Pronto. Está esperando o seu sim aqui embaixo.
                </p>
              ) : null}
            </div>
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
            {falta ? (
              <Link href="/central/conexoes" className="cx-botao cx-botao--suave cx-area-acao-botao">
                Conectar {NOME_REDE[a.precisa ?? ""] ?? "a rede"}
              </Link>
            ) : (
              <button
                type="button"
                className="cx-botao cx-botao--branco cx-area-acao-botao"
                onClick={() => gerar(a.id)}
                disabled={gerando}
                aria-label={`Gerar ${a.rotulo}`}
              >
                {gerando ? (
                  <>
                    <LoaderCircle size={17} strokeWidth={2} className="cx-girando" aria-hidden="true" /> Gerando…
                  </>
                ) : (
                  "Gerar"
                )}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function FilaDaRede({ itens, ativo }: { itens: TrabalhoRede[]; ativo: boolean }) {
  const router = useRouter();
  const [feitos, setFeitos] = useState<Record<string, string>>({});
  const [ocupado, iniciar] = useTransition();
  const { bloquear } = useTrava();
  const temGerando = itens.some((i) => i.estado === "gerando");

  // Enquanto algo está sendo gerado, relê a fila a cada 5 s.
  useEffect(() => {
    if (!temGerando) return;
    const t = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(t);
  }, [temGerando, router]);

  function decidir(id: string, decisao: "APROVADA" | "PASSADA") {
    if (bloquear() || !ativo) return;
    iniciar(async () => {
      const r = await decidirAcao(id, decisao);
      if (r.erro) {
        setFeitos((f) => ({ ...f, [id]: r.erro as string }));
        return;
      }
      setFeitos((f) => ({
        ...f,
        [id]: decisao === "APROVADA" ? `Aprovado. ${r.producao?.tipo ?? "A peça"} em produção.` : "Passado.",
      }));
      router.refresh();
    });
  }

  if (!itens.length) return <p className="cx-dica">Nada esperando agora. Gere alguma coisa acima.</p>;

  return (
    <ul className="cx-fila-rede">
      {itens.map((t) => (
        <li key={t.id} className="cx-fila-item" data-estado={t.estado}>
          <div className="cx-fila-texto">
            <p className="cx-fila-titulo">{t.titulo}</p>
            {t.estado === "gerando" ? (
              <p className="cx-fila-resumo cx-fila-gerando">
                <LoaderCircle size={15} strokeWidth={2} className="cx-girando" aria-hidden="true" /> A Editora Pauta está
                escrevendo…
              </p>
            ) : t.resumo ? (
              <p className="cx-fila-resumo">{t.resumo}</p>
            ) : null}
            {feitos[t.id] ? (
              <p className="cx-aviso cx-aviso--ok" role="status">
                {feitos[t.id]}
              </p>
            ) : null}
          </div>
          {t.estado === "pendente" && !feitos[t.id] ? (
            <div className="cx-fila-botoes">
              <button
                type="button"
                className="cx-icone-botao"
                onClick={() => decidir(t.id, "PASSADA")}
                disabled={ocupado}
                aria-label={`Passar: ${t.titulo}`}
              >
                <X size={18} strokeWidth={1.8} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="cx-botao cx-botao--azul"
                onClick={() => decidir(t.id, "APROVADA")}
                disabled={ocupado}
              >
                <Check size={17} strokeWidth={2} aria-hidden="true" /> Aprovar
              </button>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
