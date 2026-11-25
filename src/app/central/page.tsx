import { AtualizarAgora } from "@/components/central/atualizar";
import { CabecaPagina, MarcaExemplo, SeletorPeriodo } from "@/components/central/cabeca";
import { EquipeChefes } from "@/components/central/inicio";
import { CardNorte } from "@/components/central/norte-acao";
import { saudacao } from "@/lib/central/dados";

import { agoraMs, blocoDecisoes, blocoNorte, blocoPulso, contexto, lerPeriodo } from "./_lib/painel";

/**
 * Início (DESIGN.md 6.2): estrutura dominante = o bloco do Norte (único
 * preenchido) e a equipe de chefes em linha, cada um com o número do período.
 */
export default async function PaginaInicio({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const c = await contexto();
  if (!c) return null;
  const dias = lerPeriodo((await searchParams).p);

  const [norte, decisoes, pulso] = await Promise.all([blocoNorte(c), blocoDecisoes(), blocoPulso(c, dias)]);
  const pendentes = decisoes.dado.filter((d) => d.estado === "pendente").length;
  const algumExemplo = [norte, decisoes, pulso].some((b) => b.exemplo);

  const subtitulo =
    pendentes === 0
      ? "Nenhuma decisão esperando você hoje."
      : `${pendentes} ${pendentes === 1 ? "decisão esperando" : "decisões esperando"} você e uma ação para a semana.`;

  return (
    <>
      <MarcaExemplo ativo={algumExemplo} />
      <CabecaPagina secao="Início" titulo={c.nomeNegocio ? `Hoje na ${c.nomeNegocio}` : "Hoje na sua empresa"} subtitulo={subtitulo}>
        <SeletorPeriodo caminho="/central" atual={dias} />
        <AtualizarAgora />
      </CabecaPagina>

      <CardNorte
        acoes={norte.dado.acoes}
        ceu={norte.dado.ceu}
        exemplo={norte.exemplo}
        podeGerar={norte.exemplo && !!c.accountId && c.temFicha}
        podeMais={!norte.exemplo && norte.dado.podeMais}
      />
      <EquipeChefes estados={pulso.dado} agora={agoraMs()} dias={dias} />
    </>
  );
}
