"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { pedirAnaliseAcao } from "@/app/central/acoes-departamento";
import { Icone } from "@/components/central/icones";
import { useTrava } from "@/components/central/trava";

/** "Pedir análise agora": dispara o chefe e põe o ticket na URL (o PedirChefe acompanha). */
export function PedirAnalise({ slug, exemplo, rotulo = "Pedir análise agora" }: { slug: string; exemplo: boolean; rotulo?: string }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [aviso, setAviso] = useState<string | null>(null);
  const trava = useTrava();

  function pedir() {
    setAviso(null);
    if (trava.bloquear()) return;
    if (exemplo) {
      setAviso("Exemplo: nada foi enviado.");
      return;
    }
    iniciar(async () => {
      const r = await pedirAnaliseAcao(slug);
      if (r.erro || !r.t) {
        setAviso(r.erro ?? "Não deu para enviar agora.");
        return;
      }
      router.replace(`/central/${slug}?t=${r.t}`, { scroll: false });
    });
  }

  return (
    <div className="cx-pedir-analise">
      <button type="button" className="cx-botao cx-botao--branco" disabled={pendente} onClick={pedir}>
        <Icone nome="brilho" tamanho={18} className="cx-laranja" />
        {pendente ? "Pedindo…" : rotulo}
      </button>
      {aviso ? (
        <p className="cx-dica" role="status">
          {aviso}
        </p>
      ) : null}
    </div>
  );
}
