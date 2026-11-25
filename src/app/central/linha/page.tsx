import { AtualizarAgora } from "@/components/central/atualizar";
import { CabecaPagina, MarcaExemplo } from "@/components/central/cabeca";
import { GraficoLinha } from "@/components/central/linha-grafico";

import { agoraMs, blocoLinha, contexto, DIAS_HISTORICO_LINHA, lerPeriodo } from "../_lib/painel";

const chaveDia = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" });

/**
 * Linha do tempo (DESIGN.md 6.2): estrutura dominante = o gráfico dos dias,
 * com a legenda do dia escolhido embaixo.
 */
export default async function PaginaLinha({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const c = await contexto();
  if (!c) return null;
  const dias = lerPeriodo((await searchParams).p);
  const linha = await blocoLinha(c);

  return (
    <>
      <MarcaExemplo ativo={linha.exemplo} />
      <CabecaPagina secao="Linha do tempo" titulo="Linha do tempo" subtitulo="O que cada chefe entregou, o que você aprovou e o que foi ao ar, dia a dia.">
        <AtualizarAgora />
      </CabecaPagina>
      <GraficoLinha eventos={linha.dado} periodo={dias} hoje={chaveDia.format(agoraMs())} historico={DIAS_HISTORICO_LINHA} />
    </>
  );
}
