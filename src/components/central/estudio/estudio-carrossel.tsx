"use client";

/** Carrossel aberto no estúdio: visualizador + painel da peça. */
import { SeletorImagem } from "@/components/central/estudio/seletor-imagem";
import { PainelPeca } from "@/components/central/estudio/painel-peca";
import { Visualizador } from "@/components/central/estudio/visualizador";
import type { MarcaCarrossel } from "@/lib/central/carrossel";
import type { PecaDetalhe } from "@/lib/central/estudio/pecas";

export function EstudioCarrossel({
  peca,
  nomeNegocio,
  marcaCliente,
  provedoresImagem,
}: {
  peca: PecaDetalhe;
  nomeNegocio: string;
  marcaCliente: MarcaCarrossel;
  /** Nomes dos modelos de imagem com chave (OpenAI, Gemini). */
  provedoresImagem: string[];
}) {
  return (
    <Visualizador
      peca={peca}
      nomeNegocio={nomeNegocio}
      marcaCliente={marcaCliente}
      painel={(api) => <PainelPeca api={api} />}
      extraImagem={(api) => <SeletorImagem api={api} provedores={provedoresImagem} />}
    />
  );
}
