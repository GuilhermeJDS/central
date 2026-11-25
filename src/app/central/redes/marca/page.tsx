import { CabecaPagina } from "@/components/central/cabeca";
import { ChipChefe } from "@/components/central/chefe";
import { IdentidadeForm } from "@/components/central/estudio/identidade";
import { listarImagens, obterIdentidade, provedoresDeImagem } from "@/lib/central/estudio/imagens";
import { MARCA_PADRAO, marcaDoSite } from "@/lib/central/marca";

import { contexto } from "../../_lib/painel";

/** Estúdio › Marca › Identidade. Estrutura dominante: a prancha de amostras. */
export default async function PaginaIdentidade() {
  const c = await contexto();
  if (!c) return null;
  const conta = c.accountId;
  const [identidade, marca, provedores, imagens] = conta
    ? await Promise.all([obterIdentidade(conta), marcaDoSite(conta), provedoresDeImagem(conta), listarImagens(conta, 24)])
    : [null, MARCA_PADRAO, [], []];
  return (
    <>
      <CabecaPagina
        secao="Redes · Marca"
        titulo="Identidade"
        subtitulo="Cores, fonte e o estilo das imagens de todas as peças."
        chip={<ChipChefe nome="Editora Pauta" />}
      />
      {identidade ? (
        <IdentidadeForm inicial={identidade} marcaSite={marca} provedores={provedores} imagens={imagens} nomeNegocio={c.nomeNegocio} />
      ) : (
        <p className="cx-dica">Com o plano liberado, a identidade da sua marca fica aqui.</p>
      )}
    </>
  );
}
