import type { ReactNode } from "react";

import { LogoCentral } from "@/components/central/logo";
import { Mascote, type IdMascote } from "@/components/central/mascote";

const EQUIPE: Array<{ id: IdMascote; nome: string; faz: string }> = [
  { id: "rastro", nome: "Inspetor Rastro", faz: "acha o seu negócio no Google e vigia os vizinhos" },
  { id: "pauta", nome: "Editora Pauta", faz: "planeja, escreve e monta os posts" },
  { id: "trato", nome: "Negociador Trato", faz: "copy, proposta e follow-up" },
  { id: "conselho", nome: "Conselho", faz: "oferta, preço e concorrentes" },
  { id: "rotina", nome: "Gerente Rotina", faz: "lê os números do mês" },
  { id: "norte", nome: "Norte", faz: "escolhe a ação da semana" },
  { id: "revisor", nome: "Revisor", faz: "tira a cara de IA antes de você ver" },
];

/** Tela de acesso: a equipe de um lado (viva, olha o cursor), o formulário do outro. */
export function TelaAcesso({ titulo, sub, children }: { titulo: string; sub?: ReactNode; children: ReactNode }) {
  return (
    <div className="ac">
      <aside className="ac-equipe" aria-label="A sua equipe">
        <div className="ac-equipe-topo">
          <p className="ac-sobrelinha">Projeto aberto · grátis para sempre</p>
          <p className="ac-manchete">A sua empresa, tocada por uma equipe que não dorme.</p>
        </div>
        <ul className="ac-equipe-lista">
          {EQUIPE.map((c, i) => (
            <li key={c.id} className="ac-membro">
              <Mascote id={c.id} tamanho={56} humor={i % 3 === 0 ? "happy" : "neutral"} />
              <span>
                <strong>{c.nome}</strong>
                <span>{c.faz}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="ac-rodape-equipe">Tudo o que eles fazem passa por você antes de sair.</p>
      </aside>
      <main className="ac-lado">
        <LogoCentral tamanho={34} vivo />
        <div className="ac-miolo">
          <h1 className="ac-titulo">{titulo}</h1>
          {sub ? <p className="ac-sub">{sub}</p> : null}
          <div className="ac-corpo">{children}</div>
        </div>
        <p className="ac-pedagio">
          Grátis e aberto. O pedágio é seguir o{" "}
          <a href="https://x.com/mongarde_" target="_blank" rel="noreferrer">
            @mongarde_
          </a>{" "}
          no X.
        </p>
      </main>
    </div>
  );
}
