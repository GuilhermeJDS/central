import { TIPOS_PAUTA } from "@/lib/central/estudio/tipos";

import type { BuscaEstudio } from "../../_comum";
import { PaginaPecaTexto } from "../../_peca";

export default async function Pagina({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: BuscaEstudio }) {
  const { id } = await params;
  return <PaginaPecaTexto id={id} searchParams={searchParams} tipos={TIPOS_PAUTA} voltar={{ href: "/central/redes/pautas", rotulo: "Pautas" }} />;
}
