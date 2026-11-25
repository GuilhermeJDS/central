import { GalleryHorizontalEnd } from "lucide-react";
import Link from "next/link";

import { CabecaPagina } from "@/components/central/cabeca";
import { ChipChefe } from "@/components/central/chefe";
import { BibliotecaPecas } from "@/components/central/estudio/biblioteca";
import { NovaPeca } from "@/components/central/estudio/nova-peca";
import { comRede } from "@/lib/central/estudio/secoes";
import { listarPecas, pautasBase } from "@/lib/central/estudio/pecas";
import { TIPOS_CARROSSEL } from "@/lib/central/estudio/tipos";

import { contexto } from "../../_lib/painel";
import { podeGerarNaCentral } from "../../_lib/sessao";
import { filtroDaBusca, secaoCom, type BuscaEstudio } from "../_comum";

/** Estúdio › Carrosséis. Estrutura dominante: a grade de capas. */
export default async function PaginaCarrosseis({ searchParams }: { searchParams: BuscaEstudio }) {
  const c = await contexto();
  if (!c) return null;
  const { filtro } = await filtroDaBusca(searchParams, "/central/redes/carrosseis");
  const [pecas, pautas, podeGerar] = c.accountId
    ? await Promise.all([
        listarPecas(c.accountId, { tipos: TIPOS_CARROSSEL, rede: filtro?.rede }),
        pautasBase(c.accountId),
        podeGerarNaCentral(c.accountId),
      ])
    : [[], [], false];
  return (
    <>
      <CabecaPagina
        secao={secaoCom("Carrosséis", filtro)}
        titulo={filtro?.slug === "linkedin" ? "Carrosséis em PDF" : "Carrosséis"}
        subtitulo={
          filtro?.slug === "linkedin"
            ? "Os documentos em PDF do LinkedIn, com as versões e o que já foi ao ar."
            : "Cada carrossel da Editora Pauta, com as versões e o que já foi ao ar."
        }
        chip={<ChipChefe nome="Editora Pauta" />}
      >
        <NovaPeca secao="carrosseis" redeInicial={filtro?.rede} pautas={pautas} ativo={podeGerar} />
      </CabecaPagina>
      <BibliotecaPecas
        pecas={pecas}
        base="/central/redes/carrosseis"
        rede={filtro?.slug ?? null}
        nomeNegocio={c.nomeNegocio}
        vazio={
          <>
            <span className="cx-vazio-icone" aria-hidden="true">
              <GalleryHorizontalEnd size={28} strokeWidth={1.6} />
            </span>
            <p className="cx-vazio-titulo">
              {filtro ? `Nenhum carrossel para o ${filtro.nome} ainda.` : "Nenhum carrossel ainda."}
            </p>
            <p className="cx-vazio-texto">Peça um carrossel em Pautas e aprove: ele cai aqui pronto para revisar.</p>
            <Link href={comRede("/central/redes/pautas", filtro?.slug ?? "instagram")} className="cx-botao cx-botao--azul">
              Criar carrossel
            </Link>
          </>
        }
      />
    </>
  );
}
