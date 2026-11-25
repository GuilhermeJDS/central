import { PlugZap } from "lucide-react";
import Link from "next/link";

import { CabecaPagina } from "@/components/central/cabeca";
import { PainelApiConta } from "@/components/central/painel-api-conta";
import { PainelConexoes } from "@/components/central/painel-conexoes";
import { ACOES_CONTA } from "@/lib/api-conta/acoes";
import { escoposDe } from "@/lib/api-conta/escopos";
import { auth } from "@/lib/auth";
import { leiturasDasRedes } from "@/lib/central/conexoes-painel";
import { CHEFES_COM_MODELO, listarChaves, listarModelosChefe } from "@/lib/ia/chaves-conta";
import { prisma } from "@/lib/prisma";
import { listarConexoes } from "@/lib/redes/contas";
import { oauthLigado, redesComOAuth } from "@/lib/redes/oauth";
import { lerAviso } from "@/app/api/central/conectar/_comum";

import { agoraMs, contexto } from "../_lib/painel";
import {
  apagarChaveIaCentralAcao,
  modelosChaveNovaCentralAcao,
  modelosChaveSalvaCentralAcao,
  salvarChaveIaCentralAcao,
  salvarModeloChefeCentralAcao,
  testarChaveIaCentralAcao,
  usarChaveIaCentralAcao,
} from "../acoes-chave-ia";
import { criarChaveContaAcao, revogarChaveContaAcao } from "../acoes-api-conta";
import { apagarRedeCentralAcao, conectarRedeCentralAcao, testarRedeCentralAcao } from "../acoes-conexoes-redes";

/**
 * Conexões (DESIGN.md 6.11): estrutura dominante = painel de controle. O
 * estado geral vem antes do detalhe: IA, redes conectadas e última leitura;
 * depois os provedores, o modelo de cada chefe e as redes.
 */
const BASE = (process.env.NEXT_PUBLIC_APP_URL || "https://korely.com.br").replace(/\/+$/, "");

/** IA e redes | API e MCP (fica na URL como ?aba=api). */
function AbasConexoes({ api }: { api: boolean }) {
  return (
    <nav className="cx-segmentos cx-abas-conexoes" aria-label="Conexões">
      <Link href="/central/conexoes" className="cx-segmento" aria-current={!api ? "page" : undefined} scroll={false}>
        IA e redes
      </Link>
      <Link href="/central/conexoes?aba=api" className="cx-segmento" aria-current={api ? "page" : undefined} scroll={false}>
        API e MCP
      </Link>
    </nav>
  );
}

export default async function PaginaConexoes({ searchParams }: { searchParams: Promise<{ aba?: string; r?: string }> }) {
  const c = await contexto();
  if (!c) return null;
  const sp = await searchParams;
  const api = sp.aba === "api";
  const aviso = lerAviso(sp.r);
  if (api) return <AbaApi contaId={c.contaId} />;
  const [chaves, modelos, conexoesRedes, session] = await Promise.all([
    c.contaId ? listarChaves(c.contaId) : Promise.resolve([]),
    c.contaId ? listarModelosChefe(c.contaId) : Promise.resolve([]),
    c.contaId ? listarConexoes(c.contaId) : Promise.resolve([]),
    auth(),
  ]);
  const leituras = c.contaId ? await leiturasDasRedes(c.contaId, conexoesRedes) : {};
  const papel = session?.user?.role;
  const podeEditar = papel === "CLIENT_ADMIN" || papel === "SUPER_ADMIN";

  return (
    <>
      <CabecaPagina secao="Ajustes" titulo="Conexões" subtitulo="A inteligência dos chefes e as contas que eles leem. A Korely só lê, não publica nada.">
        <AbasConexoes api={false} />
      </CabecaPagina>
      {c.contaId ? (
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
      ) : (
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

async function AbaApi({ contaId }: { contaId: string | null }) {
  const [chaves, session] = await Promise.all([
    contaId
      ? prisma.chaveConta.findMany({
          where: { accountId: contaId, revogadaEm: null },
          orderBy: { criadoEm: "desc" },
          select: { id: true, nome: true, prefixo: true, escopos: true, criadoEm: true, ultimoUsoEm: true },
        })
      : Promise.resolve([]),
    auth(),
  ]);
  const papel = session?.user?.role;
  const podeEditar = Boolean(contaId) && (papel === "CLIENT_ADMIN" || papel === "SUPER_ADMIN");

  return (
    <>
      <CabecaPagina secao="Ajustes" titulo="Conexões" subtitulo="Ligue o seu agente à Central: uma chave por ferramenta, só com o que ela precisa.">
        <AbasConexoes api />
      </CabecaPagina>
      <PainelApiConta
        chaves={chaves.map((k) => ({
          id: k.id,
          nome: k.nome,
          prefixo: k.prefixo,
          escopos: escoposDe(k),
          criadoEm: k.criadoEm.toISOString(),
          ultimoUsoEm: k.ultimoUsoEm?.toISOString() ?? null,
        }))}
        ferramentas={ACOES_CONTA.map((a) => ({ nome: a.nome, escopo: a.escopo, descricao: a.descricao }))}
        base={BASE}
        podeEditar={podeEditar}
        agora={agoraMs()}
        acoes={{ criar: criarChaveContaAcao, revogar: revogarChaveContaAcao }}
      />
    </>
  );
}
