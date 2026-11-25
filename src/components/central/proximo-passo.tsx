"use client";

/**
 * "Próximo passo" de um trabalho pronto: roda a ação seguinte do cardápio
 * (pode ser de outro chefe) com este trabalho junto e leva para lá.
 */
import { ArrowRight, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { continuarTrabalhoAcao } from "@/app/central/acoes-departamento";
import { useTrava } from "@/components/central/trava";
import { doChefe } from "@/components/central/chefe";

export function ProximoPasso({
  execucaoId,
  proxima,
  exemplo = false,
}: {
  execucaoId: string;
  proxima: { chefe: string; rotulo: string };
  exemplo?: boolean;
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [indo, iniciar] = useTransition();
  const { bloquear } = useTrava();
  return (
    <div className="cx-proximo">
      <button
        type="button"
        className="cx-botao cx-botao--suave cx-proximo-botao"
        disabled={indo || exemplo}
        onClick={() =>
          !bloquear() &&
          iniciar(async () => {
            setErro(null);
            const r = await continuarTrabalhoAcao(execucaoId);
            if (r.href) router.push(r.href);
            else setErro(r.erro ?? "Não deu para continuar agora.");
          })
        }
      >
        {indo ? (
          <LoaderCircle size={16} strokeWidth={2} className="cx-girando" aria-hidden="true" />
        ) : (
          <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
        )}
        <span>
          Próximo: {proxima.rotulo}
          <span className="cx-proximo-quem"> {doChefe(proxima.chefe)}</span>
        </span>
      </button>
      {erro ? (
        <p className="cx-aviso cx-aviso--erro" role="status">
          {erro}
        </p>
      ) : null}
    </div>
  );
}
