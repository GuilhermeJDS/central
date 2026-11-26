import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AvisoAcesso } from "@/components/central/aviso-acesso";
import { BarraLateral } from "@/components/central/barra-lateral";
import { TravaChefes } from "@/components/central/trava";
import { planosQueLiberamChefes } from "@/lib/central/liberacao";
import { auth } from "@/lib/auth";
import { contarNovidades } from "@/lib/atualizacoes";
import { prisma } from "@/lib/prisma";

import { blocoDecisoes, contexto } from "./_lib/painel";
import { podeGerarNaCentral, temaCentral } from "./_lib/sessao";
import "./central.css";
import "./central-equipe.css";
import "./estudio.css";
import "./paineis.css";
import "./conta.css";
import "./guias.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Central", robots: { index: false, follow: false } };

export default async function LayoutCentral({ children }: { children: ReactNode }) {
  const [c, tema] = await Promise.all([contexto(), temaCentral()]);
  // Fontes do DESIGN.md (Bricolage + Source Sans) vêm do layout raiz.
  const fontes = "central";
  if (!c) {
    return (
      <div className={fontes} data-tema={tema}>
        <AvisoAcesso />
      </div>
    );
  }
  const session = await auth();
  const [decisoes, planos, podeGerar, eu, novidades] = await Promise.all([
    blocoDecisoes(),
    c.travado ? planosQueLiberamChefes() : Promise.resolve([]),
    c.accountId ? podeGerarNaCentral(c.accountId) : Promise.resolve(true),
    session?.user?.id
      ? prisma.user.findUnique({ where: { id: session.user.id }, select: { nome: true, sobrenome: true, email: true, fotoPerfil: true } })
      : Promise.resolve(null),
    contarNovidades().catch(() => 0),
  ]);
  const usuario = {
    nome: [eu?.nome, eu?.sobrenome].filter(Boolean).join(" ") || session?.user?.name || "Você",
    email: eu?.email ?? session?.user?.email ?? "",
    foto: eu?.fotoPerfil ?? null,
  };
  // Exemplo não conta: conta nova começa com zero esperando.
  const pendentes = decisoes.exemplo ? 0 : decisoes.dado.filter((d: { estado: string }) => d.estado === "pendente").length;
  const detalhe = c.accountId
    ? c.cidade || "Sua conta"
    : c.travado
      ? "Chefes em exemplo"
      : "Negócio de exemplo";

  return (
    <div className={`${fontes} cx`} data-tema={tema}>
      <BarraLateral tema={tema} nomeNegocio={c.nomeNegocio} detalhe={detalhe} pendentes={pendentes} novidades={novidades} iaLigada={podeGerar} usuario={usuario} />
      <main className="cx-principal">
        <div className="cx-fundo" aria-hidden="true" />
        <div className="cx-conteudo">
          <TravaChefes travado={c.travado} semChave={!podeGerar} planos={planos}>
            {children}
          </TravaChefes>
        </div>
      </main>
    </div>
  );
}
