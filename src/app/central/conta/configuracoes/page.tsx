import { redirect } from "next/navigation";

import { CabecaPagina } from "@/components/central/cabeca";
import { FormPreferencias } from "@/components/central/conta-forms";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { temaCentral } from "../../_lib/sessao";
import { AbasConta } from "../_abas";

export const metadata = { title: "Korely — Configurações" };

/** Configurações: aparência e avisos por e-mail. */
export default async function PaginaConfiguracoes() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?redirect=%2Fcentral%2Fconta%2Fconfiguracoes");
  const [tema, u] = await Promise.all([
    temaCentral(),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { notificacoesEmail: true } }),
  ]);
  return (
    <>
      <CabecaPagina secao="Conta" titulo="Configurações" subtitulo="Como a Korely aparece e o que chega no seu e-mail.">
        <AbasConta atual="/central/conta/configuracoes" />
      </CabecaPagina>
      <div className="cx-g12">
        <div className="cx-bloco cx-card cx-conta-config">
          <FormPreferencias tema={tema} notificacoesEmail={u?.notificacoesEmail ?? true} />
        </div>
      </div>
    </>
  );
}
