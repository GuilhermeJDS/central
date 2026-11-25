import { CabecaPagina } from "@/components/central/cabeca";
import { ChipChefe } from "@/components/central/chefe";
import { Referencias } from "@/components/central/estudio/referencias";
import { prisma } from "@/lib/prisma";

import { contexto } from "../../_lib/painel";
import { filtroDaBusca, secaoCom, type BuscaEstudio } from "../_comum";

/** Estúdio › Referências. Estrutura dominante: o mural de prints. */
export default async function PaginaReferencias({ searchParams }: { searchParams: BuscaEstudio }) {
  const c = await contexto();
  if (!c) return null;
  const { filtro } = await filtroDaBusca(searchParams);
  const lista = c.accountId
    ? await prisma.referenciaRede.findMany({
        where: { accountId: c.accountId, ...(filtro ? { OR: [{ rede: filtro.rede }, { rede: null }] } : {}) },
        orderBy: { criadaEm: "desc" },
        take: 120,
      })
    : [];
  return (
    <>
      <CabecaPagina
        secao={secaoCom("Referências", filtro)}
        titulo="Referências"
        subtitulo="Posts que servem de inspiração, com o que vale copiar de cada um."
        chip={<ChipChefe nome="Editora Pauta" />}
      />
      {c.accountId ? (
        <Referencias
          redePadrao={filtro?.rede ?? null}
          referencias={lista.map((r) => ({ id: r.id, rede: r.rede, link: r.link, imagem: r.imagem, nota: r.nota, em: r.criadaEm.toISOString() }))}
        />
      ) : (
        <p className="cx-dica">Com o plano liberado, as suas referências ficam aqui.</p>
      )}
    </>
  );
}
