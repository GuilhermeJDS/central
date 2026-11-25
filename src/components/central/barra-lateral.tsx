"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import { SimboloCx } from "@/components/central/chefe";
import { usePendentes } from "@/components/central/contador-decisoes";
import { Icone, type NomeIcone } from "@/components/central/icones";
import { LogoCentral } from "@/components/central/logo";
import { MenuConta, type UsuarioMenu } from "@/components/central/menu-conta";
import { TemaBotao } from "@/components/central/tema-botao";
import type { IdChefe } from "@/lib/chefes/identidade";

type Item = { href: string; rotulo: string; icone: NomeIcone | { chefe: IdChefe }; contador?: number };

/**
 * Barra lateral da Central. Abaixo de 900px vira barra no topo com menu.
 * Ordem: Início, Decisões, Linha do tempo, departamentos; Ficha, Conexões,
 * Skills e Execuções; por fim Atualizações e Pedágio. A pílula "Exemplo" aparece pelo
 * CSS quando a página tem bloco marcado com data-exemplo (ver MarcaExemplo).
 */
export function BarraLateral({
  tema,
  nomeNegocio,
  detalhe,
  pendentes,
  novidades = 0,
  usuario,
}: {
  tema: "claro" | "escuro";
  nomeNegocio: string;
  detalhe: string;
  pendentes: number;
  /** Itens novos em Atualizações (versão, projetos, skills). */
  novidades?: number;
  /** Quem está logado: rodapé com avatar e o menu da conta. */
  usuario: UsuarioMenu;
}) {
  const caminho = usePathname();
  const pendentesAgora = usePendentes(pendentes);
  const [aberto, setAberto] = useState(false);

  const grupos: Array<{ rotulo: string | null; itens: Item[] }> = [
    {
      rotulo: null,
      itens: [
        { href: "/central", rotulo: "Início", icone: "inicio" },
        { href: "/central/decisoes", rotulo: "Decisões", icone: "decisoes", contador: pendentesAgora },
        { href: "/central/linha", rotulo: "Linha do tempo", icone: "linha" },
      ],
    },
    {
      rotulo: "Departamentos",
      itens: [
        { href: "/central/presenca", rotulo: "Presença", icone: { chefe: "rastro" } },
        { href: "/central/redes", rotulo: "Redes", icone: { chefe: "pauta" } },
        { href: "/central/vendas", rotulo: "Vendas", icone: { chefe: "trato" } },
        { href: "/central/estrategia", rotulo: "Estratégia", icone: { chefe: "conselho" } },
        { href: "/central/operacao", rotulo: "Operação", icone: { chefe: "rotina" } },
      ],
    },
    {
      rotulo: "Ajustes",
      itens: [
        { href: "/central/ficha", rotulo: "Ficha", icone: "ficha" },
        { href: "/central/conexoes", rotulo: "Conexões", icone: "conexoes" },
        { href: "/central/skills", rotulo: "Skills", icone: "skills" },
        { href: "/central/execucoes", rotulo: "Execuções", icone: "execucoes" },
      ],
    },
    {
      rotulo: "Projeto aberto",
      itens: [
        { href: "/central/atualizacoes", rotulo: "Atualizações", icone: "atualizar", contador: novidades },
        { href: "/central/pedagio", rotulo: "Pedágio", icone: "pedagio" },
      ],
    },
  ];

  const ativo = (href: string) => (href === "/central" ? caminho === "/central" : caminho.startsWith(href));
  const desenho = (i: Item["icone"]): ReactNode =>
    typeof i === "string" ? (
      <Icone nome={i} />
    ) : (
      <span data-chefe={i.chefe} className="cx-nav-chefe">
        <SimboloCx id={i.chefe} tamanho={20} />
      </span>
    );

  return (
    <aside className="cx-lateral" data-aberto={aberto ? "true" : "false"}>
      <div className="cx-lateral-topo">
        <Link href="/central" className="cx-logo" aria-label="Central · Início">
          <LogoCentral />
        </Link>
        <div className="cx-lateral-topo-acoes">
          <TemaBotao inicial={tema} />
          <button
            type="button"
            className="cx-menu-botao"
            aria-expanded={aberto}
            aria-controls="cx-navegacao"
            onClick={() => setAberto((a) => !a)}
          >
            <Icone nome={aberto ? "fechar" : "menu"} tamanho={22} />
            <span className="cx-so-leitor">{aberto ? "Fechar menu" : "Abrir menu"}</span>
          </button>
        </div>
      </div>

      <div
        className="cx-lateral-corpo"
        id="cx-navegacao"
        onClick={(e) => {
          // No celular, escolher um item fecha o menu.
          if ((e.target as HTMLElement).closest("a")) setAberto(false);
        }}
      >
        <div className="cx-negocio">
          <span className="cx-negocio-nome">{nomeNegocio}</span>
          <span className="cx-negocio-detalhe">{detalhe}</span>
        </div>

        <nav aria-label="Central" className="cx-nav">
          {grupos.map((g, i) => (
            <div key={i} className="cx-nav-grupo">
              {g.rotulo ? <p className="cx-nav-rotulo">{g.rotulo}</p> : null}
              <ul>
                {g.itens.map((it) => (
                  <li key={it.href}>
                    <Link href={it.href} className="cx-nav-item" aria-current={ativo(it.href) ? "page" : undefined}>
                      {desenho(it.icone)}
                      <span>{it.rotulo}</span>
                      {it.contador ? (
                        <span className="cx-contador" aria-label={`${it.contador} esperando`}>
                          {it.contador}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <p className="cx-pilula-exemplo" role="note">
          <span aria-hidden="true" className="cx-pilula-ponto" /> Dados de exemplo
        </p>

        <MenuConta usuario={usuario} />
      </div>
    </aside>
  );
}
