import { MarcaExemplo } from "@/components/central/cabeca";
import { LeituraChefe } from "@/components/central/departamento";
import { TopoChefe } from "@/components/central/departamento-chefe";
import { PedirChefe } from "@/components/central/pedir-chefe";
import { Cronograma } from "@/components/central/estudio/cronograma";
import { departamentoPorSlug } from "@/lib/central/departamentos";
import { listarPecas } from "@/lib/central/estudio/pecas";

import { agoraMs, blocoAnalise, contexto, lerPeriodo } from "../_lib/painel";
import { filtroDaBusca, secaoCom, type BuscaEstudio } from "./_comum";

const chaveDia = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });

/** Estúdio › Cronograma. Estrutura dominante: o calendário do mês. */
export default async function PaginaCronograma({ searchParams }: { searchParams: BuscaEstudio }) {
  const info = departamentoPorSlug("redes")!;
  const c = await contexto();
  if (!c) return null;
  const { sp, filtro } = await filtroDaBusca(searchParams);
  const hoje = chaveDia.format(agoraMs());
  const mes = typeof sp.mes === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.mes) ? sp.mes : hoje.slice(0, 7);
  const [analise, pecas] = await Promise.all([
    blocoAnalise(c, info, lerPeriodo(undefined)),
    c.accountId ? listarPecas(c.accountId, { rede: filtro?.rede }, 300) : Promise.resolve([]),
  ]);
  return (
    <>
      <MarcaExemplo ativo={analise.exemplo} />
      <TopoChefe secao={secaoCom("Cronograma", filtro)} titulo="Cronograma" chefe={info.chefe} frase="O que sai em cada dia, em todas as redes. Arraste para mudar a data.">
        <PedirChefe slug="redes" chefe={info.chefe} leitura={false} ticketInicial={null} exemplo={!c.accountId} embutido />
      </TopoChefe>
      <Cronograma pecas={pecas} mes={mes} hoje={hoje} rede={filtro?.slug ?? null} nomeNegocio={c.nomeNegocio} />
      <LeituraChefe chefe={info.chefe} a={analise.dado} />
    </>
  );
}
