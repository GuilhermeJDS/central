"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Icone } from "@/components/central/icones";

/** Relê os dados da página no servidor. */
export function AtualizarAgora() {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  return (
    <button
      type="button"
      className="cx-botao cx-botao--branco"
      disabled={pendente}
      onClick={() => iniciar(() => router.refresh())}
    >
      <Icone nome="atualizar" tamanho={18} className={pendente ? "cx-girando" : undefined} />
      {pendente ? "Atualizando…" : "Atualizar agora"}
    </button>
  );
}
