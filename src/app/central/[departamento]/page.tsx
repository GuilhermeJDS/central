import { notFound } from "next/navigation";

import { NumerosMes, type NumerosMesView } from "@/components/central/numeros-mes";
import { mesesAtualEAnterior } from "@/lib/chefes/gerente-rotina";
import { prisma } from "@/lib/prisma";
import { MarcaExemplo, SeletorPeriodo } from "@/components/central/cabeca";
import { GraficoOperacao, LeituraChefe, ProntoParaVoce, QuadroConselho, RankingVizinhos } from "@/components/central/departamento";
import { EsperandoSim, TopoChefe } from "@/components/central/departamento-chefe";
import { CardapioChefe } from "@/components/central/cardapio-chefe";
import { EntregasProntas } from "@/components/central/entregas-prontas";
import { acoesDoChefe } from "@/lib/chefes/cardapio";
import { numerosExemplo } from "@/components/central/exemplo";
import { PedirAnalise } from "@/components/central/pedir-analise";
import { PedirChefe } from "@/components/central/pedir-chefe";
import { departamentoPorSlug, type SlugDepartamento } from "@/lib/central/departamentos";
import { decodificarTicket } from "@/lib/central/disparar";
import { listarEntregas } from "@/lib/central/entregas";

import {
  blocoAnalise,
  blocoDecisoes,
  blocoEntregas,
  blocoNumeros,
  blocoSerie,
  blocoVizinhos,
  contexto,
  lerPeriodo,
} from "../_lib/painel";
import { podeGerarNaCentral } from "../_lib/sessao";

type Props = {
  params: Promise<{ departamento: string }>;
  searchParams: Promise<{ t?: string; p?: string }>;
};

const SUBTITULO: Record<SlugDepartamento, string> = {
  presenca: "Como você aparece no Google perto dos vizinhos.",
  redes: "O que postar, quando postar e o que está dando resultado.",
  vendas: "Quem compra, quem sumiu e o que mandar para cada um.",
  estrategia: "Preço, pacotes e para onde o negócio vai.",
  operacao: "Os números do mês e o dia a dia da casa.",
};

/**
 * Departamento, na ordem: o chefe (retrato, frase e o pedido com os chips),
 * o cardápio dele em cards, os números (Presença = ranking contra os
 * vizinhos; Operação = gráfico), as Entregas, o "Esperando o seu sim" e a
 * última leitura, curta. Texto longo sempre cortado com "Ver tudo".
 * Redes tem rota própria (/central/redes: o estúdio).
 */
/** O mês atual já informado (ou vazio) para o formulário de Operação. */
async function numerosIniciais(accountId: string): Promise<NumerosMesView> {
  const { atual } = mesesAtualEAnterior();
  const m = await prisma.numeroMes.findUnique({ where: { accountId_mes: { accountId, mes: atual } } });
  return {
    mes: atual,
    receita: m ? (m.receitaCentavos / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "",
    atendimentos: m?.atendimentos ?? 0,
    cancelados: m?.cancelados ?? 0,
    faltas: m?.faltas ?? 0,
    clientesAtivos: m?.clientesAtivos ?? 0,
    clientesNovos: m?.clientesNovos ?? 0,
    clientesSumidos: m?.clientesSumidos ?? 0,
  };
}

export default async function PaginaDepartamento({ params, searchParams }: Props) {
  const { departamento } = await params;
  const info = departamentoPorSlug(departamento);
  if (!info) notFound();
  const c = await contexto();
  if (!c) return null;
  const { t, p } = await searchParams;
  const dias = lerPeriodo(p);
  const slug = info.slug;

  const [analise, numeros, entregas, vizinhos, serie, decisoes, prontas, podeGerar] = await Promise.all([
    blocoAnalise(c, info, dias),
    slug === "operacao" ? blocoNumeros(c, info, dias) : null,
    blocoEntregas(c, info),
    slug === "presenca" ? blocoVizinhos(c) : null,
    slug === "operacao" ? blocoSerie(c, dias) : null,
    blocoDecisoes(),
    c.accountId ? listarEntregas(c.accountId, { departamento: info.departamento }) : Promise.resolve([]),
    c.accountId ? podeGerarNaCentral(c.accountId) : Promise.resolve(false),
  ]);
  const semConta = !c.accountId;
  const doDepartamento = decisoes.dado.filter((d) => d.slug === slug);
  const algumExemplo = [analise, numeros, entregas, vizinhos, serie, decisoes].some((b) => b?.exemplo);

  // Números do departamento (Presença e Operação): dado, não texto.
  let numerosDep: React.ReactNode = null;
  if (slug === "presenca" && vizinhos) numerosDep = <RankingVizinhos v={vizinhos.dado} />;
  if (slug === "operacao" && serie && numeros) {
    // Gráfico e números contam a mesma história: se um caiu no exemplo, o outro também.
    const nums = serie.exemplo && !numeros.exemplo ? numerosExemplo("operacao", dias) : numeros.dado;
    numerosDep = <GraficoOperacao s={serie.dado} dias={dias} numeros={nums} />;
  }

  return (
    <>
      <MarcaExemplo ativo={algumExemplo} />
      {/* Topo: retrato, nome, frase e o pedido logo ali, com os chips. */}
      <TopoChefe
        secao={info.nome}
        chefe={info.chefe}
        frase={SUBTITULO[slug]}
        acoes={
          <>
            {slug === "operacao" ? <SeletorPeriodo caminho={`/central/${slug}`} atual={dias} /> : null}
            {info.leitura ? null : <PedirAnalise slug={slug} exemplo={semConta} rotulo="Pedir análise" />}
          </>
        }
      >
        <PedirChefe
          key={t ?? "sem-ticket"}
          slug={slug}
          chefe={info.chefe}
          leitura={info.leitura}
          ticketInicial={decodificarTicket(t)}
          exemplo={semConta}
          embutido
        />
      </TopoChefe>

      <div className="cx-departamento" data-departamento={slug}>
        {/* Cardápio: cada skill do chefe vira um card com botão. */}
        {acoesDoChefe(info.chefe).length ? <CardapioChefe chefe={info.chefe} ativo={podeGerar} /> : null}
        {numerosDep}
        {slug === "operacao" && c.accountId ? <NumerosMes inicial={await numerosIniciais(c.accountId)} /> : null}
        {/* Peças prontas: nascem do "Aprovar" (Presença e Operação só leem números). */}
        {info.leitura ? (
          entregas.dado.length ? <ProntoParaVoce entregas={entregas.dado} /> : null
        ) : (
          <EntregasProntas
            entregas={prontas}
            titulo="Entregas"
            vazio={semConta ? undefined : "Aprove um trabalho e o chefe entrega a peça pronta aqui."}
          />
        )}
        <EsperandoSim itens={doDepartamento} exemplo={decisoes.exemplo || semConta} />
        {/* A última leitura do chefe, curta (Estratégia: o quadro do Conselho). */}
        {/* Vendas: com mensagens esperando, a leitura repetiria a primeira delas. */}
        {slug === "estrategia" ? (
          <QuadroConselho a={analise.dado} />
        ) : slug === "vendas" && doDepartamento.some((d) => d.estado === "pendente") ? null : (
          <LeituraChefe chefe={info.chefe} a={analise.dado} />
        )}
      </div>
    </>
  );
}
