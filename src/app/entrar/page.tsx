import Link from "next/link";
import { redirect } from "next/navigation";

import { entrar } from "@/acoes/acesso";
import { Campo, Enviar, FormAcesso } from "@/components/acesso/form";
import { TelaAcesso } from "@/components/acesso/tela";
import { instalado } from "@/lib/config";
import { usuarioAtual } from "@/lib/sessao";

import "../acesso.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Entrar" };

export default async function Entrar() {
  if (!(await instalado())) redirect("/instalar");
  if (await usuarioAtual()) redirect("/central");
  return (
    <TelaAcesso titulo="Bom te ver de novo" sub="A equipe deixou trabalho esperando a sua decisão.">
      <FormAcesso acao={entrar}>
        <Campo rotulo="E-mail">
          <input name="email" type="email" className="ac-entrada" autoComplete="email" required autoFocus />
        </Campo>
        <Campo rotulo="Senha">
          <input name="senha" type="password" className="ac-entrada" autoComplete="current-password" required />
        </Campo>
        <Enviar>Entrar</Enviar>
        <div className="ac-linha-baixo">
          <Link href="/esqueci" className="ac-link">
            Esqueci a senha
          </Link>
        </div>
      </FormAcesso>
    </TelaAcesso>
  );
}
