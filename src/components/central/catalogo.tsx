"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

/** Ferramenta grátis: o mesmo /api/ferramentas/[slug]/obter-gratis de hoje, ficando na Central. */
export function ObterGratis({ slug }: { slug: string }) {
  const router = useRouter();
  const [estado, setEstado] = useState<"livre" | "enviando" | "feito">("livre");
  async function obter() {
    setEstado("enviando");
    try {
      const res = await fetch(`/api/ferramentas/${encodeURIComponent(slug)}/obter-gratis`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Não foi possível liberar a ferramenta.");
        setEstado("livre");
        return;
      }
      toast.success("Ferramenta liberada.");
      setEstado("feito");
      router.refresh();
    } catch {
      toast.error("Erro de conexão.");
      setEstado("livre");
    }
  }
  return (
    <button type="button" className="cx-botao cx-botao--azul" disabled={estado !== "livre"} onClick={() => void obter()}>
      {estado === "enviando" ? "Liberando…" : estado === "feito" ? "Liberada" : "Obter grátis"}
    </button>
  );
}
