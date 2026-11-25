"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { reproduzirEntregaAcao } from "@/app/central/acoes-entregas";
import { useTrava } from "@/components/central/trava";

/** Pede ao chefe para produzir a peça de novo (depois de erro ou para outra versão). */
export function RefazerEntrega({ id }: { id: string }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const { bloquear } = useTrava();
  return (
    <div className="cx-refazer">
      <button
        type="button"
        className="cx-botao cx-botao--branco"
        disabled={pendente}
        onClick={() =>
          !bloquear() &&
          iniciar(async () => {
            const r = await reproduzirEntregaAcao(id);
            setErro(r.erro);
            if (!r.erro) router.refresh();
          })
        }
      >
        <RefreshCw size={17} strokeWidth={1.8} aria-hidden="true" className={pendente ? "cx-girando" : undefined} />
        {pendente ? "Pedindo…" : "Produzir de novo"}
      </button>
      {erro ? (
        <p role="status" className="cx-aviso cx-aviso--erro">
          {erro}
        </p>
      ) : null}
    </div>
  );
}
