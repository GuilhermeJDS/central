import { PlugZap } from "lucide-react";
import Link from "next/link";

import { FormIntegracao } from "@/components/central/form-integracao";
import { grupo } from "@/lib/catalogo-integracoes";
import { resumoIntegracoes } from "@/lib/config";

import { PainelConexoes } from "@/components/central/painel-conexoes";
import { auth } from "@/lib/auth";
import { leiturasDasRedes } from "@/lib/central/conexoes-painel";
import { CHEFES_COM_MODELO, listarChaves, listarModelosChefe } from "@/lib/ia/chaves-conta";
import { listarConexoes } from "@/lib/redes/contas";
import { oauthLigado, redesComOAuth } from "@/lib/redes/oauth";
import type { lerAviso } from "@/app/api/central/conectar/_comum";

import { agoraMs } from "../_lib/painel";
import {
  apagarChaveIaCentralAcao,
  modelosChaveNovaCentralAcao,
  modelosChaveSalvaCentralAcao,
  salvarChaveIaCentralAcao,
  salvarModeloChefeCentralAcao,
  testarChaveIaCentralAcao,
  usarChaveIaCentralAcao,
} from "../acoes-chave-ia";
import { apagarRedeCentralAcao, conectarRedeCentralAcao, testarRedeCentralAcao } from "../acoes-conexoes-redes";

/** Miolo de "IA e redes": a página de Conexões e o passo 2 do onboarding usam. */
export async function ConteudoConexoes({ contaId, aviso, comPublicacao = true }: { contaId: string | null; aviso: ReturnType<typeof lerAviso>; comPublicacao?: boolean }) {
  const resumo = comPublicacao ? await resumoIntegracoes() : null;
  const [chaves, modelos, conexoesRedes, session] = await Promise.all([
    contaId ? listarChaves(contaId) : Promise.resolve([]),
    contaId ? listarModelosChefe(contaId) : Promise.resolve([]),
    contaId ? listarConexoes(contaId) : Promise.resolve([]),
    auth(),
  ]);
  const leituras = contaId ? await leiturasDasRedes(contaId, conexoesRedes) : {};
  const papel = session?.user?.role;
  const podeEditar = papel === "CLIENT_ADMIN" || papel === "SUPER_ADMIN";
  return (
    <>
      {contaId ? (
        <PainelConexoes
          chaves={chaves}
          chefes={CHEFES_COM_MODELO}
          escolhas={modelos}
          conexoes={conexoesRedes}
          leituras={leituras}
          podeEditar={podeEditar}
          agora={agoraMs()}
          oauth={{ redes: redesComOAuth(), openrouter: oauthLigado("openrouter") }}
          aviso={aviso}
          acoes={{
            salvarChave: salvarChaveIaCentralAcao,
            usarChave: usarChaveIaCentralAcao,
            apagarChave: apagarChaveIaCentralAcao,
            testarChave: testarChaveIaCentralAcao,
            modelosChaveNova: modelosChaveNovaCentralAcao,
            modelosChaveSalva: modelosChaveSalvaCentralAcao,
            salvarModeloChefe: salvarModeloChefeCentralAcao,
            conectarRede: conectarRedeCentralAcao,
            apagarRede: apagarRedeCentralAcao,
            testarRede: testarRedeCentralAcao,
          }}
        />
      ) : null}
      {contaId && resumo ? (
        <section className="cx-con-publicacao" aria-labelledby="cx-con-publicacao-t">
          <div className="cx-con-secao-cabeca">
            <h2 id="cx-con-publicacao-t" className="cx-con-secao-titulo">
              Publicação
            </h2>
            <p className="cx-con-secao-apoio">
              Pulou no começo? Ligue o Buffer aqui: peça aprovada e com data no Cronograma sai sozinha. Rastro e e-mail ficam em{" "}
              <Link href="/central/configuracoes">Configurações</Link>.
            </p>
          </div>
          <FormIntegracao grupo="buffer" provedor={grupo("buffer").provedores[0]} resumo={resumo.buffer?.provedores.buffer} />
        </section>
      ) : null}
      {contaId ? null : (
        <div className="cx-painel cx-vazio-conexoes">
          <span className="cx-pilha-vazia-icone cx-vazio-conexoes-icone" aria-hidden="true">
            <PlugZap size={28} strokeWidth={1.8} />
          </span>
          <p className="cx-pilha-vazia-titulo">Sem conta nesta Central.</p>
          <p className="cx-dica">A chave de IA e as contas das redes ficam guardadas na conta do seu negócio.</p>
        </div>
      )}
    </>
  );
}

