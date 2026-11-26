import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { rascunhoFicha } from "@/acoes/onboarding";
import { contexto } from "@/app/central/_lib/painel";
import { ConteudoConexoes } from "@/app/central/conexoes/conteudo";
import { lerAviso } from "@/app/api/central/conectar/_comum";
import { AcharNoMaps } from "@/components/central/achar-no-maps";
import { FichaProntuario } from "@/components/central/ficha-prontuario";
import { FormIntegracao } from "@/components/central/form-integracao";
import { LogoCentral } from "@/components/central/logo";
import { Mascote, type IdMascote } from "@/components/central/mascote";
import type { FichaView } from "@/components/central/tipos";
import { grupo } from "@/lib/catalogo-integracoes";
import { marcarPasso, resumoIntegracoes } from "@/lib/config";
import { db } from "@/lib/db";
import { temChaveConectada } from "@/lib/ia/credencial";
import { exigirUsuario } from "@/lib/sessao";

export const metadata = { title: "Começar" };

const PASSOS = [
  { id: "ia", nome: "IA e redes", mascote: "norte" as IdMascote },
  { id: "negocio", nome: "A empresa", mascote: "rastro" as IdMascote },
  { id: "buffer", nome: "Publicação", mascote: "pauta" as IdMascote },
  { id: "pronto", nome: "Pronto", mascote: "central" as IdMascote },
] as const;

type IdPasso = (typeof PASSOS)[number]["id"];

const VAZIA: FichaView = {
  nomeNegocio: "", cidade: "", oQueVende: "", paraQuem: "", objetivo: "", objetivoOutro: "",
  instagram: "", site: "", google: "", youtube: "", linkedin: "", x: "", comoFala: "", naoQuer: "",
};

export default async function Passo({ params, searchParams }: { params: Promise<{ passo: string }>; searchParams: Promise<{ r?: string }> }) {
  const u = await exigirUsuario();
  const { passo } = await params;
  const i = PASSOS.findIndex((x) => x.id === passo);
  if (i < 0) notFound();
  const atual = PASSOS[i];
  const proximo = PASSOS[i + 1] ? `/instalar/${PASSOS[i + 1].id}` : "/central";
  await marcarPasso(`visto.${atual.id}`);

  const [temIa, temFicha, resumo] = await Promise.all([
    temChaveConectada(u.accountId),
    db.fichaNegocio.count({ where: { accountId: u.accountId } }).then((n) => n > 0),
    resumoIntegracoes(),
  ]);
  const feito: Record<IdPasso, boolean> = { ia: temIa, negocio: temFicha, buffer: !!resumo.buffer?.ativo, pronto: false };

  return (
    <div className="cx-ob">
      <header className="cx-ob-topo">
        <LogoCentral tamanho={30} />
        <Link href="/central" className="cx-ob-depois">
          Terminar depois
        </Link>
      </header>
      <ol className="cx-ob-passos" aria-label="Passos">
        <li data-feito="true">
          <Check size={15} aria-hidden="true" /> Conta
        </li>
        {PASSOS.map((x, j) => (
          <li key={x.id} data-feito={feito[x.id] ? "true" : undefined}>
            <Link href={`/instalar/${x.id}`} aria-current={j === i ? "step" : undefined}>
              {feito[x.id] ? <Check size={15} aria-hidden="true" /> : <span className="cx-ob-num">{j + 2}</span>} {x.nome}
            </Link>
          </li>
        ))}
      </ol>

      <main className="cx-ob-corpo">
        {passo === "ia" ? <PassoIa aviso={lerAviso((await searchParams).r)} contaId={u.accountId} feito={temIa} /> : null}
        {passo === "negocio" ? <PassoNegocio /> : null}
        {passo === "buffer" ? <PassoBuffer resumo={resumo.buffer?.provedores.buffer} /> : null}
        {passo === "pronto" ? <PassoPronto feito={feito} /> : null}

        {passo !== "pronto" ? (
          <div className="cx-ob-rodape">
            <Link href={proximo} className={feito[atual.id] ? "cx-botao cx-botao--azul" : "cx-botao cx-botao--suave"}>
              {feito[atual.id] ? "Continuar" : "Pular por agora"} <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>
        ) : null}
      </main>
    </div>
  );
}

function Cabeca({ mascote, titulo, sub, estado }: { mascote: IdMascote; titulo: string; sub: string; estado?: "idle" | "done" }) {
  return (
    <div className="cx-ob-cabeca">
      <Mascote id={mascote} tamanho={88} estado={estado} humor={estado === "done" ? "happy" : "neutral"} />
      <div>
        <h1 className="cx-ob-titulo">{titulo}</h1>
        <p className="cx-ob-sub">{sub}</p>
      </div>
    </div>
  );
}

async function PassoIa({ aviso, contaId, feito }: { aviso: ReturnType<typeof lerAviso>; contaId: string; feito: boolean }) {
  return (
    <>
      <Cabeca
        mascote="norte"
        titulo="A inteligência da equipe"
        sub="Cole a chave de IA (Claude, GPT, Gemini, DeepSeek, Grok ou OpenRouter): é ela que paga o trabalho dos chefes, direto no provedor, sem ninguém no meio. Se quiser, já conecte as redes."
        estado={feito ? "done" : "idle"}
      />
      <ConteudoConexoes contaId={contaId} aviso={aviso} comPublicacao={false} />
    </>
  );
}

async function PassoNegocio() {
  const c = await contexto();
  const r = await rascunhoFicha();
  // Sem ficha ainda: começa com o nome que a pessoa deu à empresa no cadastro.
  const conta = c?.accountId ? await db.account.findUnique({ where: { id: c.accountId }, select: { nome: true } }) : null;
  const base = c?.temFicha ? c.ficha.dado : { ...VAZIA, nomeNegocio: conta?.nome ?? "" };
  const inicial: FichaView = r
    ? { ...base, nomeNegocio: String(r.nomeNegocio ?? base.nomeNegocio), cidade: String(r.cidade ?? base.cidade), site: String(r.site ?? base.site), google: String(r.google ?? base.google), oQueVende: base.oQueVende || String(r.oQueVende ?? "") }
    : base;
  return (
    <>
      <Cabeca mascote="rastro" titulo="Conte da sua empresa" sub="Todos os chefes leem esta ficha antes de trabalhar. Quanto mais real, menos texto genérico." />
      <AcharNoMaps nomeInicial={inicial.nomeNegocio} />
      <FichaProntuario key={JSON.stringify(inicial)} inicial={inicial} exemplo={false} logo={null} />
    </>
  );
}

function PassoBuffer({ resumo }: { resumo?: Parameters<typeof FormIntegracao>[0]["resumo"] }) {
  const g = grupo("buffer");
  return (
    <>
      <Cabeca
        mascote="pauta"
        titulo="Peça aprovada sai sozinha"
        sub="Ligando o Buffer, toda peça que você aprovar e puser no Cronograma vai para a fila dele e é publicada no dia e na hora. Sem o Buffer, você baixa a peça e posta à mão."
      />
      <FormIntegracao grupo="buffer" provedor={g.provedores[0]} resumo={resumo} />
      <p className="cx-dica cx-ob-nota">
        O Buffer baixa as imagens da sua Central. Por isso ele só publica imagem quando a Central está num endereço público (VPS ou Vercel). No seu computador, o texto vai e a imagem você sobe no app do Buffer.
      </p>
    </>
  );
}

function PassoPronto({ feito }: { feito: Record<IdPasso, boolean> }) {
  const itens: Array<{ id: IdPasso; nome: string; falta: string }> = [
    { id: "ia", nome: "Chave de IA", falta: "sem ela, os chefes não trabalham" },
    { id: "negocio", nome: "Ficha da empresa", falta: "sem ela, o texto sai genérico" },
    { id: "buffer", nome: "Buffer", falta: "sem ele, você posta à mão" },
  ];
  return (
    <>
      <Cabeca mascote="central" titulo="A equipe está pronta" sub="Daqui para frente, eles trabalham e você decide. Tudo o que fizerem chega em Decisões." estado="done" />
      <ul className="cx-painel cx-ob-resumo">
        {itens.map((x) => (
          <li key={x.id}>
            <span className="cx-ob-selo" data-ok={feito[x.id] ? "true" : undefined}>
              {feito[x.id] ? "ligado" : "depois"}
            </span>
            <strong>{x.nome}</strong>
            {!feito[x.id] ? (
              <>
                <span className="cx-dica">{x.falta}</span>
                <Link href={`/instalar/${x.id}`} className="cx-ob-ligar">
                  Ligar agora
                </Link>
              </>
            ) : null}
          </li>
        ))}
      </ul>
      <Link href="/central/pedagio" className="cx-painel cx-ob-pedagio">
        <span>
          <strong>Antes de começar, o pedágio</strong>
          <span className="cx-dica">Quatro cliques que não custam nada e ajudam quem fez e quem está começando.</span>
        </span>
        <ArrowRight size={18} aria-hidden="true" />
      </Link>
      <div className="cx-ob-rodape">
        <Link href="/central" className="cx-botao cx-botao--azul">
          Entrar na Central <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </div>
    </>
  );
}
