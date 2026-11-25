import { redirect } from "next/navigation";

import { CabecaPagina } from "@/components/central/cabeca";
import { FormPerfil, FormSenha, FotoConta } from "@/components/central/conta-forms";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { AbasConta } from "./_abas";

export const metadata = { title: "Minha conta" };

const fmtData = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", month: "long", year: "numeric" });

/** Minha conta: cartão com a foto à esquerda (4/12); dados e senha à direita (8/12). */
export default async function PaginaMinhaConta() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?redirect=%2Fcentral%2Fconta");
  const u = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { nome: true, sobrenome: true, email: true, telefone: true, fotoPerfil: true, createdAt: true },
  });
  if (!u) redirect("/login");
  const nome = [u.nome, u.sobrenome].filter(Boolean).join(" ");

  return (
    <>
      <CabecaPagina secao="Conta" titulo="Minha conta" subtitulo="Seu nome, e-mail, foto e senha de acesso.">
        <AbasConta atual="/central/conta" />
      </CabecaPagina>
      <div className="cx-g12 cx-conta-grade">
        <section className="cx-bloco cx-card cx-conta-cartao" aria-label="Foto">
          <FotoConta usuario={{ nome, email: u.email, foto: u.fotoPerfil }} />
          <div className="cx-conta-cartao-quem">
            <p className="cx-conta-cartao-nome">{nome}</p>
            <p className="cx-conta-cartao-email">{u.email}</p>
            <p className="cx-dica">Na Central desde {fmtData.format(u.createdAt)}</p>
          </div>
        </section>
        <div className="cx-bloco cx-card cx-conta-forms">
          <FormPerfil nome={nome} email={u.email} telefone={u.telefone ?? ""} />
          <FormSenha />
        </div>
      </div>
    </>
  );
}
