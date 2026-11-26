import { AtualizarAgora } from "@/components/central/atualizar";
import { CabecaPagina, MarcaExemplo, SeletorPeriodo } from "@/components/central/cabeca";
import { EquipeChefes } from "@/components/central/inicio";
import { CardNorte } from "@/components/central/norte-acao";
import { PrimeirosPassos, type PassoInicial } from "@/components/central/primeiros-passos";
import { bufferLigado } from "@/lib/central/publicar";
import { temChaveConectada } from "@/lib/ia/credencial";
import { prisma } from "@/lib/prisma";
import { redesConectadas } from "@/lib/redes/contas";

import { agoraMs, blocoDecisoes, blocoNorte, blocoPulso, contexto, lerPeriodo } from "./_lib/painel";

/**
 * Início (DESIGN.md 6.2): estrutura dominante = o bloco do Norte (único
 * preenchido) e a equipe de chefes em linha, cada um com o número do período.
 */
export default async function PaginaInicio({ searchParams }: { searchParams: Promise<{ p?: string; exemplo?: string }> }) {
  const c = await contexto();
  if (!c) return null;
  const sp = await searchParams;
  const dias = lerPeriodo(sp.p);

  // Conta sem nenhum trabalho ainda: os primeiros passos, sem dado de exemplo.
  if (c.accountId && sp.exemplo !== "1" && (await prisma.execucaoSkill.count({ where: { accountId: c.accountId } })) === 0) {
    const [ia, redesApi, redesAgente, buffer] = await Promise.all([
      temChaveConectada(c.accountId),
      redesConectadas(c.accountId),
      prisma.dadoRede.count({ where: { accountId: c.accountId } }),
      bufferLigado(),
    ]);
    const passos: PassoInicial[] = [
      { id: "ia", mascote: "norte", titulo: "Conectar a chave de IA", texto: "É ela que paga o trabalho dos chefes, direto no provedor. OpenRouter conecta com um clique.", href: "/central/conexoes", acao: "Conectar", feito: ia },
      { id: "ficha", mascote: "rastro", titulo: "Contar da empresa", texto: "O Inspetor Rastro acha a empresa no Google Maps e preenche a ficha. Todos os chefes leem antes de trabalhar.", href: "/instalar/negocio", acao: "Preencher", feito: c.temFicha },
      { id: "redes", mascote: "pauta", titulo: "Trazer as redes", texto: "Pela API (métricas completas) ou pelo seu agente (sem API). A Pauta usa os números reais.", href: "/central/conexoes", acao: "Conectar", feito: redesApi.size > 0 || redesAgente > 0, opcional: true },
      { id: "buffer", mascote: "trato", titulo: "Ligar o Buffer", texto: "Peça aprovada e com data no Cronograma sai sozinha no horário.", href: "/central/conexoes", acao: "Ligar", feito: buffer, opcional: true },
      { id: "pedido", mascote: "conselho", titulo: "Pedir o primeiro trabalho", texto: "Um plano do mês para as redes, uma mensagem para cliente sumido, a conta do lucro. Chega em Decisões.", href: "/central/redes", acao: "Pedir", feito: false },
    ];
    return (
      <>
        <CabecaPagina secao="Início" titulo={c.nomeNegocio ? `Bem-vindo à ${c.nomeNegocio}` : "Bem-vindo"} subtitulo="Antes do primeiro trabalho, três passos rápidos. Os opcionais dá para fazer depois." />
        <PrimeirosPassos passos={passos} nomeNegocio={c.nomeNegocio || "sua empresa"} />
      </>
    );
  }

  const [norte, decisoes, pulso] = await Promise.all([blocoNorte(c), blocoDecisoes(), blocoPulso(c, dias)]);
  const pendentes = decisoes.dado.filter((d) => d.estado === "pendente").length;
  const algumExemplo = [norte, decisoes, pulso].some((b) => b.exemplo);

  const subtitulo =
    pendentes === 0
      ? "Nenhuma decisão esperando você hoje."
      : `${pendentes} ${pendentes === 1 ? "decisão esperando" : "decisões esperando"} você e uma ação para a semana.`;

  return (
    <>
      <MarcaExemplo ativo={algumExemplo} />
      <CabecaPagina secao="Início" titulo={c.nomeNegocio ? `Hoje na ${c.nomeNegocio}` : "Hoje na sua empresa"} subtitulo={subtitulo}>
        <SeletorPeriodo caminho="/central" atual={dias} />
        <AtualizarAgora />
      </CabecaPagina>

      <CardNorte
        acoes={norte.dado.acoes}
        ceu={norte.dado.ceu}
        exemplo={norte.exemplo}
        podeGerar={norte.exemplo && !!c.accountId && c.temFicha}
        podeMais={!norte.exemplo && norte.dado.podeMais}
      />
      <EquipeChefes estados={pulso.dado} agora={agoraMs()} dias={dias} />
    </>
  );
}
