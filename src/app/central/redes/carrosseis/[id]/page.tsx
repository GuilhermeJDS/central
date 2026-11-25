import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CabecaPagina } from "@/components/central/cabeca";
import { ChipChefe } from "@/components/central/chefe";
import { EstudioCarrossel } from "@/components/central/estudio/estudio-carrossel";
import { comRede, redeDoFiltro } from "@/lib/central/estudio/secoes";
import { NOME_PROVEDOR_IMAGEM, provedoresDeImagem } from "@/lib/central/estudio/imagens";
import { obterPecaDetalhe } from "@/lib/central/estudio/pecas";
import { marcaDoCliente } from "@/lib/central/marca";

import { contexto } from "../../../_lib/painel";
import type { BuscaEstudio } from "../../_comum";

/** Estúdio › Carrosséis › peça. Estrutura dominante: o slide grande. */
export default async function PaginaCarrossel({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: BuscaEstudio }) {
  const { id } = await params;
  const c = await contexto();
  if (!c) return null;
  if (!c.accountId) notFound();
  const [peca, marca, sp, provedores] = await Promise.all([
    obterPecaDetalhe(c.accountId, id),
    marcaDoCliente(c.accountId),
    searchParams,
    provedoresDeImagem(c.accountId),
  ]);
  if (!peca || peca.tipo !== "CARROSSEL") notFound();
  const filtro = redeDoFiltro(sp.rede);

  return (
    <>
      <Link href={comRede("/central/redes/carrosseis", filtro?.slug)} className="cx-voltar">
        <ArrowLeft size={18} strokeWidth={1.8} aria-hidden="true" /> Carrosséis
      </Link>
      <CabecaPagina secao="Redes · Carrosséis" titulo={peca.titulo} subtitulo={peca.descricao || "Carrossel da Editora Pauta."} chip={<ChipChefe nome="Editora Pauta" />} />
      <EstudioCarrossel
        peca={peca}
        nomeNegocio={c.nomeNegocio}
        marcaCliente={marca}
        provedoresImagem={provedores.map((p) => NOME_PROVEDOR_IMAGEM[p])}
      />
    </>
  );
}
