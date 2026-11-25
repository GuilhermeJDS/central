import Link from "next/link";

import { pedirNovaSenha } from "@/acoes/acesso";
import { Campo, Enviar, FormAcesso } from "@/components/acesso/form";
import { TelaAcesso } from "@/components/acesso/tela";

import "../acesso.css";

export const metadata = { title: "Esqueci a senha" };

export default function Esqueci() {
  return (
    <TelaAcesso titulo="Trocar a senha" sub="Mando um link para o seu e-mail. Sem e-mail configurado, o link aparece no terminal onde a Central roda.">
      <FormAcesso acao={pedirNovaSenha}>
        <Campo rotulo="E-mail da conta">
          <input name="email" type="email" className="ac-entrada" autoComplete="email" required autoFocus />
        </Campo>
        <Enviar>Mandar o link</Enviar>
        <div className="ac-linha-baixo">
          <Link href="/entrar" className="ac-link">
            Voltar para entrar
          </Link>
        </div>
      </FormAcesso>
    </TelaAcesso>
  );
}
