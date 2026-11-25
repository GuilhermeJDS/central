import { redirect } from "next/navigation";

import { contexto } from "../../_lib/painel";
import { REDES_VISAO, SLUG_REDE, visaoDaRede } from "@/lib/redes/visao";

/** Abre a primeira rede com dados (API ou agente); sem nenhuma, o Instagram. */
export default async function Contas() {
  const c = await contexto();
  if (!c?.accountId) redirect("/central/redes/conta/instagram");
  for (const r of REDES_VISAO) {
    const v = await visaoDaRede(c.accountId, r);
    if (v.origem) redirect(`/central/redes/conta/${SLUG_REDE[r]}`);
  }
  redirect("/central/redes/conta/instagram");
}
