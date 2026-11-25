"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { Icone } from "@/components/central/icones";

export type PlanoTrava = { id: string; nome: string; descricao: string; preco: number; precoOriginal: number };

type Trava = {
  /** Sem trial vigente nem plano pago: vê tudo, botões abrem "Escolha um plano". */
  travado: boolean;
  /** Plano liberado, mas sem chave de IA conectada: nada que chame o modelo roda. */
  semChave: boolean;
  abrir: () => void;
  /** Para botões que chamam o modelo: abre o aviso certo e devolve true se não pode. */
  bloquear: () => boolean;
};

const Contexto = createContext<Trava>({ travado: false, semChave: false, abrir: () => {}, bloquear: () => false });

export function useTrava(): Trava {
  return useContext(Contexto);
}

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Trava da Central. Sem trial vigente nem plano pago, todo botão de gerar,
 * aprovar ou pedir chama bloquear(): aparece "Escolha um plano para
 * continuar" com os planos do banco. Nada vai ao servidor. Com plano e sem
 * chave de IA do cliente: "Conecte a sua chave de IA".
 */
export function TravaChefes({
  travado,
  semChave,
  planos,
  children,
}: {
  travado: boolean;
  semChave: boolean;
  planos: PlanoTrava[];
  children: ReactNode;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const dialogoChave = useRef<HTMLDialogElement>(null);
  const [aberto, setAberto] = useState(false);
  const [abertoChave, setAbertoChave] = useState(false);
  const abrir = useCallback(() => setAberto(true), []);
  const bloquear = useCallback(() => {
    if (travado) setAberto(true);
    else if (semChave) setAbertoChave(true);
    return travado || semChave;
  }, [travado, semChave]);
  const valor = useMemo(() => ({ travado, semChave, abrir, bloquear }), [travado, semChave, abrir, bloquear]);

  useEffect(() => {
    const d = dialogo.current;
    if (!d) return;
    if (aberto && !d.open) d.showModal();
    if (!aberto && d.open) d.close();
  }, [aberto]);

  useEffect(() => {
    const d = dialogoChave.current;
    if (!d) return;
    if (abertoChave && !d.open) d.showModal();
    if (!abertoChave && d.open) d.close();
  }, [abertoChave]);

  return (
    <Contexto.Provider value={valor}>
      {children}
      {semChave && !travado ? (
        <dialog
          ref={dialogoChave}
          className="cx-trava"
          aria-labelledby="cx-chave-t"
          onClose={() => setAbertoChave(false)}
          onClick={(e) => {
            if (e.target === e.currentTarget) setAbertoChave(false);
          }}
        >
          <div className="cx-trava-corpo">
            <button type="button" className="cx-trava-fechar" onClick={() => setAbertoChave(false)}>
              <Icone nome="fechar" tamanho={20} />
              <span className="cx-so-leitor">Fechar</span>
            </button>
            <h2 id="cx-chave-t" className="cx-trava-titulo">
              Conecte a sua chave de IA
            </h2>
            <p className="cx-card-sub">
              A Central trabalha só com a sua chave: Anthropic, OpenAI, Google, DeepSeek ou xAI, no modelo que você quiser.
              Você cola a chave uma vez em Conexões, a Central testa na hora e os chefes começam.
            </p>
            <Link href="/central/conexoes#chave-ia" className="cx-botao cx-botao--azul" onClick={() => setAbertoChave(false)}>
              Ir para Conexões
            </Link>
          </div>
        </dialog>
      ) : null}
      {travado ? (
        <dialog
          ref={dialogo}
          className="cx-trava"
          aria-labelledby="cx-trava-t"
          onClose={() => setAberto(false)}
          onClick={(e) => {
            if (e.target === e.currentTarget) setAberto(false);
          }}
        >
          <div className="cx-trava-corpo">
            <button type="button" className="cx-trava-fechar" onClick={() => setAberto(false)}>
              <Icone nome="fechar" tamanho={20} />
              <span className="cx-so-leitor">Fechar</span>
            </button>
            <h2 id="cx-trava-t" className="cx-trava-titulo">
              Escolha um plano para continuar
            </h2>
            <p className="cx-card-sub">
              Você continua vendo tudo na Central. Para os chefes gerarem, aprovarem e atenderem pedidos, escolha um plano:
              todos incluem a Central.
            </p>
            {planos.length ? (
              <ul className="cx-trava-planos">
                {planos.map((p) => (
                  <li key={p.id} className="cx-trava-plano">
                    <div className="cx-trava-plano-texto">
                      <p className="cx-card-titulo">{p.nome}</p>
                      <p className="cx-dica">{p.descricao}</p>
                    </div>
                    <div className="cx-trava-plano-preco">
                      {p.precoOriginal > p.preco ? <s className="cx-dica">{moeda.format(p.precoOriginal)}</s> : null}
                      <strong>
                        {moeda.format(p.preco)}
                        <span className="cx-dica">/mês</span>
                      </strong>
                      <Link href={`/checkout/${p.id}`} className="cx-botao cx-botao--azul">
                        Assinar
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="cx-dica">Os planos estão sendo atualizados. Fale com a gente pelo suporte para assinar.</p>
            )}
          </div>
        </dialog>
      ) : null}
    </Contexto.Provider>
  );
}
