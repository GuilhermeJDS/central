"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { estadoProducaoAcao } from "@/app/central/acoes-entregas";

/**
 * Enquanto houver trabalho na fila ou produzindo, pergunta a cada 2,5 s e
 * recarrega quando qualquer um muda de status ou de etapa (o progresso anda
 * no card). O servidor destrava os que passaram do tempo limite.
 */
export function VigiaProducao({ ids }: { ids: string[] }) {
  const router = useRouter();
  const chave = ids.join(",");
  useEffect(() => {
    const lista = chave.split(",");
    let vivo = true;
    let antes: string | null = null;
    const t = setInterval(async () => {
      try {
        const agora = await estadoProducaoAcao(lista);
        if (!vivo) return;
        if (antes !== null && agora !== antes) router.refresh();
        antes = agora;
      } catch {
        /* tenta de novo no próximo ciclo */
      }
    }, 2500);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, [chave, router]);
  return null;
}
