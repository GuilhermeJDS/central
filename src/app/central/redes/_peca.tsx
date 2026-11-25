import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CabecaPagina } from "@/components/central/cabeca";
import { ChipChefe } from "@/components/central/chefe";
import { EstudioTexto } from "@/components/central/estudio/estudio-texto";
import { MandarBuffer } from "@/components/central/estudio/mandar-buffer";
import { MARCA_PADRAO } from "@/lib/central/marca";
import { ROTULO_TIPO, type TipoEntrega } from "@/lib/central/entregas-tipos";
import { comRede, redeDoFiltro } from "@/lib/central/estudio/secoes";
import { obterPecaDetalhe } from "@/lib/central/estudio/pecas";

import { contexto } from "../_lib/painel";
import type { BuscaEstudio } from "./_comum";

/** Peça de texto aberta (Reels e Vídeos, Pautas). Estrutura dominante: a folha grande. */
export async function PaginaPecaTexto({
  id,
  searchParams,
  tipos,
  voltar,
}: {
  id: string;
  searchParams: BuscaEstudio;
  tipos: TipoEntrega[];
  voltar: { href: string; rotulo: string };
}) {
  const c = await contexto();
  if (!c) return null;
  if (!c.accountId) notFound();
  const [peca, sp] = await Promise.all([obterPecaDetalhe(c.accountId, id), searchParams]);
  if (!peca || !tipos.includes(peca.tipo)) notFound();
  const filtro = redeDoFiltro(sp.rede);
  return (
    <>
      <Link href={comRede(voltar.href, filtro?.slug)} className="cx-voltar">
        <ArrowLeft size={18} strokeWidth={1.8} aria-hidden="true" /> {voltar.rotulo}
      </Link>
      <CabecaPagina
        secao={`Redes · ${voltar.rotulo}`}
        titulo={peca.titulo}
        subtitulo={peca.descricao || `${ROTULO_TIPO[peca.tipo]} da Editora Pauta.`}
        chip={<ChipChefe nome="Editora Pauta" />}
      />
      {peca.producao === "PRONTA" ? (
        <>
          <EstudioTexto peca={peca} />
          <div className="cx-painel">
            <MandarBuffer entregaId={peca.id} slides={[]} marca={MARCA_PADRAO} nomeNegocio={c.nomeNegocio} aprovada={peca.etapa !== "EM_REVISAO"} buffer={peca.buffer} />
          </div>
        </>
      ) : (
        <p className="cx-dica">{peca.producao === "ERRO" ? peca.erro ?? "Não saiu. Tente de novo." : "A Editora Pauta ainda está produzindo esta peça."}</p>
      )}
    </>
  );
}
