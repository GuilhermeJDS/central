import { CabecaPagina } from "@/components/central/cabeca";
import { ChipChefe } from "@/components/central/chefe";
import { BibliotecaPecas } from "@/components/central/estudio/biblioteca";
import { listarPecas } from "@/lib/central/estudio/pecas";

import { contexto } from "../../../_lib/painel";
import { filtroDaBusca, secaoCom, type BuscaEstudio } from "../../_comum";

/** Estúdio › Marca › Capas: a primeira imagem de cada peça lado a lado, para ver se o feed conversa. */
export default async function PaginaCapas({ searchParams }: { searchParams: BuscaEstudio }) {
  const c = await contexto();
  if (!c) return null;
  const { filtro } = await filtroDaBusca(searchParams, "/central/redes/marca/capas");
  const pecas = c.accountId ? (await listarPecas(c.accountId, { rede: filtro?.rede })).filter((p) => p.capa || p.imagemPost) : [];
  return (
    <>
      <CabecaPagina
        secao={secaoCom("Capas", filtro)}
        titulo="Capas"
        subtitulo="A primeira imagem de cada peça, lado a lado, para ver se o perfil conversa."
        chip={<ChipChefe nome="Editora Pauta" />}
      />
      <BibliotecaPecas
        pecas={pecas}
        rede={filtro?.slug ?? null}
        nomeNegocio={c.nomeNegocio}
        rotuloBusca="Buscar capa"
        vazio={<p className="cx-vazio-texto">As capas dos carrosséis e dos vídeos aparecem aqui.</p>}
      />
    </>
  );
}
