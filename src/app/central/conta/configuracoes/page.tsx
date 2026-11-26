import { redirect } from "next/navigation";

/** A tela de configurações mudou para /central/configuracoes. */
export default function ConfiguracoesAntigas() {
  redirect("/central/configuracoes");
}
