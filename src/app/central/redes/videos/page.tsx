import { Clapperboard } from "lucide-react";
import Link from "next/link";

import { CabecaPagina } from "@/components/central/cabeca";
import { ChipChefe } from "@/components/central/chefe";
import { BibliotecaPecas } from "@/components/central/estudio/biblioteca";
import { NovaPeca } from "@/components/central/estudio/nova-peca";
import { comRede, GRUPOS_ESTUDIO, rotuloSecao } from "@/lib/central/estudio/secoes";
import { listarPecas, pautasBase } from "@/lib/central/estudio/pecas";
import { TIPOS_VIDEO } from "@/lib/central/estudio/tipos";

import { contexto } from "../../_lib/painel";
import { podeGerarNaCentral } from "../../_lib/sessao";
import { filtroDaBusca, secaoCom, type BuscaEstudio } from "../_comum";

/** Estúdio › Reels e Vídeos. Estrutura dominante: a grade de capas. */
export default async function PaginaVideos({ searchParams }: { searchParams: BuscaEstudio }) {
  const c = await contexto();
  if (!c) return null;
  const { filtro } = await filtroDaBusca(searchParams, "/central/redes/videos");
  const [pecas, pautas, podeGerar] = c.accountId
    ? await Promise.all([
        listarPecas(c.accountId, { tipos: TIPOS_VIDEO, rede: filtro?.rede }),
        pautasBase(c.accountId),
        podeGerarNaCentral(c.accountId),
      ])
    : [[], [], false];
  const secao = GRUPOS_ESTUDIO.flatMap((g) => g.secoes).find((s) => s.href === "/central/redes/videos")!;
  const nome = rotuloSecao(secao, filtro?.slug);
  const subtitulo =
    filtro?.slug === "youtube"
      ? "Roteiros, títulos e thumbnails dos vídeos e Shorts, com as versões e o vídeo no ar."
      : filtro?.slug === "instagram"
        ? "Roteiros de Reels, com as versões e o post no ar."
        : filtro?.slug === "tiktok"
          ? "Roteiros de vídeo do TikTok, com as versões."
          : "Roteiros, títulos e capas de vídeo, com as versões e o post no ar.";
  return (
    <>
      <CabecaPagina
        secao={secaoCom(nome, filtro)}
        titulo={nome}
        subtitulo={subtitulo}
        chip={<ChipChefe nome="Editora Pauta" />}
      >
        <NovaPeca secao="videos" redeInicial={filtro?.rede} pautas={pautas} ativo={podeGerar} />
      </CabecaPagina>
      <BibliotecaPecas
        pecas={pecas}
        base="/central/redes/videos"
        rede={filtro?.slug ?? null}
        nomeNegocio={c.nomeNegocio}
        rotuloBusca="Buscar roteiro ou título"
        vazio={
          <>
            <span className="cx-vazio-icone" aria-hidden="true">
              <Clapperboard size={28} strokeWidth={1.6} />
            </span>
            <p className="cx-vazio-titulo">Nenhum roteiro ainda.</p>
            <p className="cx-vazio-texto">
              {filtro?.slug === "youtube"
                ? "Peça um vídeo ou um Short em Pautas e aprove: o roteiro cai aqui."
                : filtro?.slug === "instagram"
                  ? "Peça um Reels em Pautas e aprove: o roteiro cai aqui."
                  : "Peça um vídeo em Pautas e aprove: o roteiro cai aqui."}
            </p>
            <Link href={comRede("/central/redes/pautas", filtro?.slug ?? "instagram")} className="cx-botao cx-botao--azul">
              Criar roteiro
            </Link>
          </>
        }
      />
    </>
  );
}
