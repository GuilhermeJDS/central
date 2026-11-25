import { CabecaPagina, MarcaExemplo } from "@/components/central/cabeca";
import { PilhaDecisoes, SubtituloDecisoes } from "@/components/central/decisoes-pilha";

import { blocoDecisoes, contexto, inicioDoPeriodo } from "../_lib/painel";

/** Decisões (DESIGN.md 6.2): estrutura dominante = pilha de cartas, uma por vez. */
export default async function PaginaDecisoes() {
  const c = await contexto();
  if (!c) return null;
  const decisoes = await blocoDecisoes();
  // Pendentes sempre; as já decididas, só as dos últimos 30 dias (lista do canto).
  const limite = inicioDoPeriodo(30);
  const itens = decisoes.dado.filter((d) => d.estado === "pendente" || new Date(d.em).getTime() >= limite);
  // Mesmo número da barra lateral (todas as pendentes), para andarem juntos.
  const todasPendentes = decisoes.dado.filter((d) => d.estado === "pendente").length;

  return (
    <>
      <MarcaExemplo ativo={decisoes.exemplo} />
      <CabecaPagina
        secao="Decisões"
        titulo="Decisões"
        subtitulo={<SubtituloDecisoes pendentes={todasPendentes} />}
      />
      {/* key: recomeça a pilha quando o servidor manda outra leva */}
      <PilhaDecisoes key={itens.map((d) => `${d.id}:${d.estado}`).join(",").slice(0, 400)} itens={itens} exemplo={decisoes.exemplo} />
    </>
  );
}
