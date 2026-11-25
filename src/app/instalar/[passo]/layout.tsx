import type { ReactNode } from "react";

import { temaCentral } from "@/app/central/_lib/sessao";

import "@/app/central/central.css";
import "@/app/central/central-equipe.css";
import "@/app/central/estudio.css";
import "@/app/central/paineis.css";
import "@/app/central/conta.css";
import "@/app/central/guias.css";

export const dynamic = "force-dynamic";

/** Passos do onboarding: o visual da Central, sem a barra lateral. */
export default async function LayoutPassos({ children }: { children: ReactNode }) {
  const tema = await temaCentral();
  return (
    <div className="central cx-onboarding" data-tema={tema}>
      <div className="cx-fundo" aria-hidden="true" />
      {children}
    </div>
  );
}
