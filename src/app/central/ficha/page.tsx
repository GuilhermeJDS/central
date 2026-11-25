import { CabecaPagina, MarcaExemplo } from "@/components/central/cabeca";
import { FichaProntuario } from "@/components/central/ficha-prontuario";
import type { FichaView } from "@/components/central/tipos";
import { prisma } from "@/lib/prisma";

import { contexto } from "../_lib/painel";

const VAZIA: FichaView = {
  nomeNegocio: "",
  cidade: "",
  oQueVende: "",
  paraQuem: "",
  objetivo: "",
  objetivoOutro: "",
  instagram: "",
  site: "",
  google: "",
  youtube: "",
  linkedin: "",
  x: "",
  comoFala: "",
  naoQuer: "",
};

export default async function PaginaFicha() {
  const c = await contexto();
  if (!c) return null;
  // Conta sem ficha: formulário vazio (nunca salvar o exemplo numa conta real).
  const exemplo = !c.accountId;
  const inicial = c.temFicha || exemplo ? c.ficha.dado : VAZIA;
  // Sem site da unidade na versão aberta: a ficha mostra as iniciais.
  const logo: string | null = null;

  return (
    <>
      <MarcaExemplo ativo={exemplo} />
      <CabecaPagina
        secao="Ajustes"
        titulo="Ficha"
        subtitulo={c.temFicha ? "O prontuário do negócio: todos os chefes leem antes de trabalhar." : "Conte do seu negócio. Leva dois minutos."}
      />
      <FichaProntuario inicial={inicial} exemplo={exemplo} logo={logo} />
    </>
  );
}
