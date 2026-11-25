import { CheckCheck } from "lucide-react";

import { CabecaPagina } from "@/components/central/cabeca";
import { ChipChefe } from "@/components/central/chefe";
import { BibliotecaPecas } from "@/components/central/estudio/biblioteca";
import { listarPecas } from "@/lib/central/estudio/pecas";

import { contexto } from "../../_lib/painel";
import { filtroDaBusca, secaoCom, type BuscaEstudio } from "../_comum";

/** Estúdio › Publicados: o que já foi ao ar (abre a peça com os números do post). */
export default async function PaginaPublicados({ searchParams }: { searchParams: BuscaEstudio }) {
  const c = await contexto();
  if (!c) return null;
  const { filtro } = await filtroDaBusca(searchParams);
  const pecas = c.accountId ? await listarPecas(c.accountId, { rede: filtro?.rede, etapas: ["PUBLICADO"] }) : [];
  pecas.sort((a, b) => (b.publicadaEm ?? b.em).localeCompare(a.publicadaEm ?? a.em));
  const vinculadas = pecas.filter((p) => p.vinculado).length;
  return (
    <>
      <CabecaPagina
        secao={secaoCom("Publicados", filtro)}
        titulo="Publicados"
        subtitulo={
          pecas.length
            ? `${vinculadas} de ${pecas.length} com o post vinculado. Abra uma peça para ver alcance, curtidas e salvos.`
            : "O que já foi ao ar e quanto rendeu."
        }
        chip={<ChipChefe nome="Editora Pauta" />}
      />
      <BibliotecaPecas
        pecas={pecas}
        rede={filtro?.slug ?? null}
        nomeNegocio={c.nomeNegocio}
        semEtapas
        vazio={
          <>
            <span className="cx-vazio-icone" aria-hidden="true">
              <CheckCheck size={28} strokeWidth={1.6} />
            </span>
            <p className="cx-vazio-titulo">Nada publicado ainda.</p>
            <p className="cx-vazio-texto">Quando uma peça for ao ar, marque como Publicado ou vincule ao post: ela aparece aqui com os números.</p>
          </>
        }
      />
    </>
  );
}
