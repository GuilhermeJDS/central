import { Suspense, type ReactNode } from "react";

import { EstudioNav } from "@/components/central/estudio/estudio-nav";

/** Estúdio de Redes: a navegação fica fixa em todas as páginas de Redes. */
export default function LayoutEstudio({ children }: { children: ReactNode }) {
  return (
    <div className="cx-estudio" data-chefe="pauta">
      <Suspense fallback={<div className="cx-estudio-barra" aria-hidden="true" />}>
        <EstudioNav />
      </Suspense>
      {children}
    </div>
  );
}
