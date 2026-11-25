import { redirect } from "next/navigation";

/** O editor de carrossel agora mora no estúdio de Redes (modo Editar do visualizador). */
export default async function PaginaEditor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/central/redes/carrosseis/${encodeURIComponent(id)}`);
}
