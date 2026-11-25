import { CabecaPagina } from "@/components/central/cabeca";
import { ChipChefe } from "@/components/central/chefe";
import { BibliotecaImagens } from "@/components/central/estudio/biblioteca-imagens";
import { listarImagens, NOME_PROVEDOR_IMAGEM, provedoresDeImagem } from "@/lib/central/estudio/imagens";

import { contexto } from "../../../_lib/painel";

/** Estúdio › Marca › Biblioteca de imagens. Estrutura dominante: o mural de fotos. */
export default async function PaginaImagens() {
  const c = await contexto();
  if (!c) return null;
  const conta = c.accountId;
  const [imagens, provedores] = conta ? await Promise.all([listarImagens(conta), provedoresDeImagem(conta)]) : [[], []];
  return (
    <>
      <CabecaPagina
        secao="Redes · Marca"
        titulo="Biblioteca de imagens"
        subtitulo="As fotos geradas e enviadas, prontas para qualquer slide."
        chip={<ChipChefe nome="Editora Pauta" />}
      />
      {conta ? (
        <BibliotecaImagens imagens={imagens} provedores={provedores.map((p) => NOME_PROVEDOR_IMAGEM[p])} />
      ) : (
        <p className="cx-dica">Com o plano liberado, as imagens da sua marca ficam aqui.</p>
      )}
    </>
  );
}
