"use client";

import { Check, RotateCcw, Send } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { pedirAoChefeAcao, statusPedidoAcao } from "@/app/central/acoes-departamento";
import { RetratoChefe, aoChefe, doChefe, idDoChefe } from "@/components/central/chefe";
import { TextoLongo } from "@/components/central/texto-longo";
import { useTrava } from "@/components/central/trava";
import type { StatusPedido } from "@/lib/central/dados";
import type { SlugDepartamento } from "@/lib/central/departamentos";
import { chipsDoChefe } from "@/lib/chefes/cardapio";

const INTERVALO_MS = 5000;

/** Perguntas que cada chefe sabe responder (viram chips). */
const SUGESTOES: Partial<Record<SlugDepartamento, string[]>> = {
  redes: [
    "Ideias de posts para esta semana",
    "Legenda para um carrossel de dicas",
    "Roteiro de reel de 30 segundos",
    "Calendário de posts do mês",
  ],
};
/** Quantos chips aparecem antes do "Ver todas". */
const CHIPS_VISIVEIS = 6;

/** Resultado mostrado no exemplo (sem conta): o formato que o dono vai receber. */
const EXEMPLO: Partial<Record<SlugDepartamento, string>> = {
  redes:
    "## 3 posts para esta semana\n\n1. **Terça, 12h · Carrossel:** 5 cuidados de pele para o calor\n2. **Quinta, 18h · Reel:** um sábado no studio em 30 segundos\n3. **Sexta, 12h · Stories:** enquete do tratamento do mês\n\n### Legenda do carrossel\n\nMarque aquela amiga que vive dizendo que não tem tempo de se cuidar.",
  vendas:
    "## Mensagem para quem sumiu\n\nOi, {nome}! Aqui é do Studio Aurora. Faz um tempinho que você não aparece — quer que eu separe um horário no almoço desta semana? É só responder com o dia.\n\n### Para quem mandar\n\n- 31 clientes sem voltar há mais de 45 dias\n- Comece pelas 12 que vinham todo mês",
  estrategia:
    "## Pacote mensal: 4 sessões\n\n- **Preço:** R$ 360 (R$ 90 a sessão, 10% abaixo da avulsa)\n- **Para quem:** quem já fez 2 sessões nos últimos 60 dias\n- **Meta:** 15 pacotes no primeiro mês\n\n### Por que agora\n\nAs clientes que voltam todo mês já são 38% da receita.",
};

type Props = {
  slug: SlugDepartamento;
  chefe: string;
  /** Chefe que só faz leitura (sem pedido livre). */
  leitura: boolean;
  /** Ticket de um pedido já disparado (ex.: "Korely, faz" no Norte). */
  ticketInicial: unknown;
  /** Sem conta: nada vai ao servidor. */
  exemplo: boolean;
  /** Dentro do topo do chefe: sem card próprio, o retrato já está ao lado. */
  embutido?: boolean;
};

export function PedirChefe({ slug, chefe, leitura, ticketInicial, exemplo, embutido = false }: Props) {
  const router = useRouter();
  const [ticket, setTicket] = useState<unknown>(ticketInicial);
  const [status, setStatus] = useState<StatusPedido | null>(ticketInicial ? { estado: "preparando" } : null);
  const [pedido, setPedido] = useState("");
  const [enviado, setEnviado] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();
  const campo = useRef<HTMLTextAreaElement>(null);
  const trava = useTrava();
  // Trato e Conselho: um chip por skill do cardápio; os outros, a lista fixa.
  const sugestoes = chipsDoChefe(chefe).length ? chipsDoChefe(chefe) : (SUGESTOES[slug] ?? []);
  const [todasSugestoes, setTodasSugestoes] = useState(false);

  useEffect(() => {
    if (!ticket) return;
    let vivo = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function consultar() {
      let s: StatusPedido;
      try {
        s = await statusPedidoAcao(ticket);
      } catch {
        s = { estado: "preparando" };
      }
      if (!vivo) return;
      setStatus(s);
      if (s.estado === "preparando") {
        timer = setTimeout(consultar, INTERVALO_MS);
        return;
      }
      setTicket(null);
      if (s.estado === "concluida") {
        router.replace(`/central/${slug}`, { scroll: false });
        router.refresh();
      }
    }
    timer = setTimeout(consultar, ticketInicial === ticket ? 1000 : INTERVALO_MS);
    return () => {
      vivo = false;
      if (timer) clearTimeout(timer);
    };
  }, [ticket, ticketInicial, router, slug]);

  function enviar(texto: string) {
    setErro(null);
    if (trava.bloquear()) return;
    if (!leitura && texto.trim().length < 3) {
      campo.current?.focus();
      return;
    }
    setEnviado(texto.trim());
    if (exemplo) {
      // Exemplo: mostra o trabalho e o formato do resultado, sem ir ao servidor.
      setStatus({ estado: "preparando" });
      setPedido("");
      setTimeout(() => setStatus({ estado: "concluida", texto: EXEMPLO[slug] }), 2200);
      return;
    }
    iniciar(async () => {
      const r = await pedirAoChefeAcao(slug, texto);
      if (r.erro || !r.ticket) {
        setErro(r.erro ?? "Não deu para enviar agora.");
        return;
      }
      setPedido("");
      setStatus({ estado: "preparando" });
      setTicket(r.ticket);
    });
  }

  const preparando = status?.estado === "preparando";
  const pronto = status?.estado === "concluida" ? status : null;

  return (
    <section
      className={embutido ? "cx-pedir cx-pedir--embutido" : "cx-pedir"}
      data-chefe={idDoChefe(chefe)}
      aria-labelledby="cx-pedir-t"
    >
      {embutido ? (
        <h2 id="cx-pedir-t" className="cx-pedir-rotulo">
          {leitura ? "Pedir nova leitura" : `Pedir ${aoChefe(chefe)}`}
        </h2>
      ) : (
        <div className="cx-pedir-topo">
          <RetratoChefe nome={chefe} tamanho={48} className="cx-pedir-retrato" />
          <div>
            <h2 id="cx-pedir-t" className="cx-pedir-titulo">
              {leitura ? "Pedir nova leitura" : `Pedir ${aoChefe(chefe)}`}
            </h2>
            <p className="cx-dica">{leitura ? "Ele lê os seus números e conta o que mudou." : "Escreva ou escolha uma pergunta pronta."}</p>
          </div>
        </div>
      )}

      {preparando ? (
        <div className="cx-trabalhando" role="status">
          <span className="cx-trabalhando-marca" aria-hidden="true">
            <RetratoChefe nome={chefe} tamanho={64} />
          </span>
          <div>
            <p className="cx-trabalhando-titulo">{chefe} está trabalhando…</p>
            <p className="cx-dica">{enviado ? `“${enviado}”` : leitura ? "Lendo os números de agora." : "Isso leva de 30 segundos a 2 minutos."}</p>
          </div>
        </div>
      ) : pronto ? (
        <div className="cx-pedir-pronto">
          {pronto.texto ? (
            <>
              <div className="cx-pedir-pronto-topo">
                <span className="cx-estado cx-estado--aprovada">
                  <Check size={15} strokeWidth={2.2} aria-hidden="true" /> Pronto
                </span>
                {exemplo ? <span className="cx-dica">Exemplo do formato</span> : null}
              </div>
              <TextoLongo
                titulo={enviado || (leitura ? "Leitura nova" : "Resultado")}
                texto={pronto.texto}
                chefe={chefe}
                aprovarId={pronto.execucaoId ?? (exemplo ? "exemplo" : null)}
                exemplo={exemplo}
              />
              {!exemplo ? (
                <Link href="/central/decisoes" className="cx-pp-link">
                  Ver em Decisões
                </Link>
              ) : null}
            </>
          ) : (
            <p className="cx-aviso cx-aviso--ok">{leitura ? "Leitura nova pronta: está logo acima." : "Pronto. O trabalho está em Decisões."}</p>
          )}
          <button type="button" className="cx-link" onClick={() => setStatus(null)}>
            <RotateCcw size={16} strokeWidth={1.8} aria-hidden="true" /> {leitura ? "Pedir outra leitura" : "Fazer outro pedido"}
          </button>
        </div>
      ) : leitura ? (
        <button type="button" className="cx-botao cx-botao--azul cx-pedir-leitura" onClick={() => enviar("")} disabled={enviando}>
          {enviando ? "Pedindo…" : "Pedir leitura agora"}
        </button>
      ) : (
        <form
          className="cx-pedir-form"
          onSubmit={(e) => {
            e.preventDefault();
            enviar(pedido);
          }}
        >
          <ul className="cx-sugestoes" aria-label="Perguntas prontas">
            {(todasSugestoes ? sugestoes : sugestoes.slice(0, CHIPS_VISIVEIS)).map((s) => (
              <li key={s}>
                <button type="button" className="cx-sugestao" onClick={() => enviar(s)} disabled={enviando}>
                  {s}
                </button>
              </li>
            ))}
            {sugestoes.length > CHIPS_VISIVEIS ? (
              <li>
                <button
                  type="button"
                  className="cx-sugestao cx-sugestoes-mais"
                  aria-expanded={todasSugestoes}
                  onClick={() => setTodasSugestoes((v) => !v)}
                >
                  {todasSugestoes ? "Menos" : `Ver todas (${sugestoes.length})`}
                </button>
              </li>
            ) : null}
          </ul>
          <div className="cx-pedir-campo">
            <label className="cx-so-leitor" htmlFor={`pedido-${slug}`}>
              O que você precisa {doChefe(chefe)}?
            </label>
            <textarea
              ref={campo}
              id={`pedido-${slug}`}
              className="cx-input"
              value={pedido}
              onChange={(e) => setPedido(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) enviar(pedido);
              }}
              maxLength={2000}
              rows={2}
              placeholder="Ou escreva com as suas palavras…"
            />
            <button type="submit" className="cx-botao cx-botao--azul" disabled={enviando}>
              <Send size={17} strokeWidth={1.8} aria-hidden="true" />
              {enviando ? "Enviando…" : "Korely, faz"}
            </button>
          </div>
        </form>
      )}

      <div aria-live="polite" className="cx-pedir-status">
        {status?.estado === "pergunta" ? (
          <p className="cx-aviso">
            {chefe} perguntou: <strong>{status.pergunta}</strong> Responda junto com o pedido.
          </p>
        ) : null}
        {status?.estado === "outro_departamento" ? (
          <p className="cx-aviso">Esse pedido é de outro departamento. Veja no Início quem cuida disso.</p>
        ) : null}
        {status?.estado === "falhou" ? (
          <p className="cx-aviso cx-aviso--erro">{status.mensagem || "Não deu certo desta vez. Tente de novo."}</p>
        ) : null}
        {erro ? <p className="cx-aviso cx-aviso--erro">{erro}</p> : null}
        {exemplo && !preparando && !pronto ? <p className="cx-dica">Exemplo: o pedido mostra o formato, nada vai ao chefe.</p> : null}
      </div>
    </section>
  );
}
