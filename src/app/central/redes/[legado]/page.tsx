import { notFound, redirect } from "next/navigation";

import { areaPorSlug } from "@/lib/central/redes-areas";

/** Endereços antigos (/central/redes/instagram…) viram Pautas com o filtro da rede. */
export default async function RedeLegado({ params }: { params: Promise<{ legado: string }> }) {
  const { legado } = await params;
  const area = areaPorSlug(legado);
  if (!area) notFound();
  redirect(`/central/redes/pautas?rede=${area.slug}`);
}
