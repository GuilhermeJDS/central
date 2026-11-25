import { redefinirSenha } from "@/acoes/acesso";
import { Campo, Enviar, FormAcesso } from "@/components/acesso/form";
import { TelaAcesso } from "@/components/acesso/tela";

import "../../acesso.css";

export const metadata = { title: "Senha nova" };

export default async function Redefinir({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <TelaAcesso titulo="Senha nova" sub="Escolha uma senha com 8 caracteres ou mais.">
      <FormAcesso acao={redefinirSenha}>
        <input type="hidden" name="token" value={token} />
        <Campo rotulo="Senha nova">
          <input name="senha" type="password" className="ac-entrada" autoComplete="new-password" minLength={8} required autoFocus />
        </Campo>
        <Enviar>Salvar e entrar</Enviar>
      </FormAcesso>
    </TelaAcesso>
  );
}
