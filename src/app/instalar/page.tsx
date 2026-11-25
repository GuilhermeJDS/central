import { redirect } from "next/navigation";

import { instalar } from "@/acoes/acesso";
import { Campo, Enviar, FormAcesso } from "@/components/acesso/form";
import { TelaAcesso } from "@/components/acesso/tela";
import { instalado } from "@/lib/config";
import { ehSqlite } from "@/lib/db";

import "../acesso.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Começar" };

/** Primeiro acesso: a conta. Os outros passos vêm depois, e todos dá para pular. */
export default async function Instalar() {
  if (await instalado()) redirect("/entrar");
  return (
    <TelaAcesso titulo="Vamos montar a sua equipe" sub="Primeiro, a sua conta. Depois a chave de IA, a sua empresa e as redes, um por vez. Todo passo dá para pular.">
      <FormAcesso acao={instalar}>
        <Campo rotulo="Seu nome">
          <input name="nome" className="ac-entrada" autoComplete="name" required autoFocus />
        </Campo>
        <Campo rotulo="Nome da empresa" dica="Os chefes chamam o negócio por esse nome. Dá para trocar depois.">
          <input name="empresa" className="ac-entrada" autoComplete="organization" required />
        </Campo>
        <Campo rotulo="E-mail de acesso">
          <input name="email" type="email" className="ac-entrada" autoComplete="email" required />
        </Campo>
        <Campo rotulo="Senha" dica="8 caracteres ou mais.">
          <input name="senha" type="password" className="ac-entrada" autoComplete="new-password" minLength={8} required />
        </Campo>
        <Enviar>Criar conta e continuar</Enviar>
        <p className="ac-dica">Banco em uso: {ehSqlite() ? "arquivo local (pasta dados/)" : "Postgres (DATABASE_URL)"}.</p>
      </FormAcesso>
    </TelaAcesso>
  );
}
