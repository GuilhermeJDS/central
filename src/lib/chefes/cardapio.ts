/**
 * Cardápio dos chefes de pedido livre (Negociador Trato e Conselho): cada
 * skill do repositório vira uma ação com nome claro, o que entrega, o pedido
 * pronto e o chip de sugestão. A Editora Pauta usa o mesmo formato, por rede,
 * em redes-areas.ts.
 *
 * Encadeamento: `proxima` aponta a ação que continua o trabalho (pode ser de
 * outro chefe). A entrega mostra o botão e, quando roda, a corrente fica
 * gravada na execução ("veio do Conselho · Oferta irrecusável → Negociador Trato · Página da oferta").
 *
 * Módulo puro: vai para a tela. O servidor valida sempre por aqui + pela
 * config do chefe (a skill tem que estar na lista dele).
 */
import type { TipoEntrega } from "@/lib/central/entregas-tipos";
import type { TextoDoDono } from "@/lib/central/redes-areas";

export type RefAcao = { chefe: string; acao: string };

export type AcaoCardapio = {
  id: string;
  rotulo: string;
  /** Uma linha: o que sai. */
  sai: string;
  repositorio: string;
  skill: string;
  /** O que vai para a skill (a ficha e os dados do negócio entram junto). */
  pedido: string;
  /** Pergunta curta que vira chip em "Pedir ao chefe". */
  chip: string;
  /** Grupo no cardápio (as ações aparecem em blocos). */
  grupo: string;
  formato?: TipoEntrega;
  /** O passo seguinte natural (pode ser de outro chefe). */
  proxima?: RefAcao;
  /** A skill trabalha em cima de um texto do dono. */
  pedeTexto?: TextoDoDono;
};

export const TRATO = "Negociador Trato";
export const CONSELHO_NOME = "Conselho";

export const CARDAPIO: Record<string, readonly AcaoCardapio[]> = {
  [TRATO]: [
    // ----------------------------------------------------------- clientes
    {
      id: "cliente-sumido",
      grupo: "Clientes",
      rotulo: "Mensagem para cliente sumido",
      sai: "Mensagem para quem parou de vir, pronta para o WhatsApp",
      repositorio: "closer",
      skill: "win-back",
      pedido:
        "Escreva a mensagem para trazer de volta os clientes que sumiram (lista real abaixo, quando houver): uma versão curta para WhatsApp, uma segunda mensagem para quem não responder em 5 dias e para quem mandar primeiro.",
      chip: "Mensagem para cliente sumido",
      formato: "TEXTO",
    },
    {
      id: "follow-up",
      grupo: "Clientes",
      rotulo: "Mensagens para quem não respondeu",
      sai: "As próximas 3 mensagens para quem não respondeu",
      repositorio: "closer",
      skill: "follow-up",
      pedido:
        "Monte a sequência de follow-up para quem pediu orçamento ou informação e não respondeu: 3 mensagens (lembrete, algo útil, última), com o intervalo entre elas.",
      chip: "Mensagens para quem não respondeu",
      formato: "TEXTO",
    },
    {
      id: "funil",
      grupo: "Clientes",
      rotulo: "Organizar o funil de vendas",
      sai: "Quem está em cada etapa e o próximo passo de cada um",
      repositorio: "closer",
      skill: "pipeline",
      pedido:
        "Organize o funil de vendas do negócio com os dados abaixo: etapas (contato, conversa, orçamento, fechado, perdido), quem está em cada uma e o próximo passo de cada cliente.",
      chip: "Organizar o meu funil",
      formato: "TEXTO",
    },
    {
      id: "previsao",
      grupo: "Clientes",
      rotulo: "Previsão de faturamento do mês",
      sai: "Quanto deve entrar no mês: certo, provável e melhor caso",
      repositorio: "closer",
      skill: "forecaster",
      pedido:
        "Faça a previsão de vendas deste mês com os números abaixo: o que é certo, o provável e o melhor caso, e o que fazer para chegar no provável.",
      chip: "Quanto vou faturar este mês?",
      formato: "TEXTO",
    },
    {
      id: "registro",
      grupo: "Clientes",
      rotulo: "Registro das conversas",
      sai: "Resumo de cada conversa e o que ficou combinado",
      repositorio: "closer",
      skill: "record-keeper",
      pedeTexto: { rotulo: "Cole as conversas", obrigatorio: true },
      pedido:
        "Transforme as conversas recentes com clientes (cole abaixo ou use o que houver) num registro: com quem falou, o que ficou combinado e o próximo passo de cada um.",
      chip: "Registrar as conversas da semana",
      formato: "TEXTO",
    },
    {
      id: "agenda",
      grupo: "Clientes",
      rotulo: "Resposta para marcar horário",
      sai: "Resposta com os horários livres para o cliente escolher",
      repositorio: "closer",
      skill: "scheduler",
      pedido:
        "Escreva a resposta para o cliente que pediu um horário: ofereça 3 opções nos horários livres da agenda (abaixo, quando houver) e confirme o que ele precisa trazer.",
      chip: "Responder quem quer marcar horário",
      formato: "TEXTO",
    },
    // ----------------------------------------------------------- vender
    {
      id: "prospeccao",
      grupo: "Vender",
      rotulo: "Onde achar clientes novos",
      sai: "Quem procurar na cidade e a primeira mensagem",
      repositorio: "closer",
      skill: "prospector",
      pedido:
        "Liste os tipos de cliente e de parceiro local que mais combinam com o negócio na cidade (empresas, academias, salões vizinhos…), onde achar e a primeira mensagem para cada tipo.",
      chip: "Onde achar clientes novos",
      formato: "TEXTO",
    },
    {
      id: "pesquisa",
      grupo: "Vender",
      rotulo: "Pesquisa antes da conversa",
      sai: "Ficha do cliente ou parceiro antes de você ligar",
      repositorio: "closer",
      skill: "researcher",
      pedeTexto: { rotulo: "Quem você vai abordar?", obrigatorio: true },
      pedido:
        "Monte a ficha de quem vou abordar (descrevo abaixo): o que eles fazem, o que provavelmente precisam, como abrir a conversa e as 3 perguntas que devo fazer.",
      chip: "Pesquisar um cliente antes de ligar",
      formato: "TEXTO",
    },
    {
      id: "objecoes",
      grupo: "Vender",
      rotulo: "Respostas às objeções",
      sai: "O que responder para \"tá caro\", \"vou pensar\" e as outras",
      repositorio: "whale",
      skill: "objection-handler",
      pedido:
        "Escreva as respostas para as objeções que mais aparecem no negócio (\"tá caro\", \"vou pensar\", \"depois eu vejo\", \"a outra é mais barata\"): o que responder e quando aceitar o não.",
      chip: "Resposta para quem achou caro",
      formato: "TEXTO",
    },
    {
      id: "treino",
      grupo: "Vender",
      rotulo: "Treino de venda da equipe",
      sai: "Roteiro da conversa e o que falar em cada objeção",
      repositorio: "closer",
      skill: "sales-coach",
      pedido:
        "Monte o roteiro de uma conversa de venda do serviço principal (abertura, perguntas, oferta, objeções e fechamento) para eu treinar a equipe.",
      chip: "Treinar a equipe para vender",
      formato: "TEXTO",
    },
    {
      id: "cliente-grande",
      grupo: "Vender",
      rotulo: "Plano para fechar cliente grande",
      sai: "Quem decide numa empresa e a mensagem para essa pessoa",
      repositorio: "whale",
      skill: "whale-hunter",
      pedido:
        "Escolha um tipo de empresa da cidade que pode virar um contrato grande para o negócio (convênio, pacote para funcionários, evento), diga quem decide lá dentro e escreva a mensagem para essa pessoa.",
      chip: "Fechar com uma empresa",
      formato: "TEXTO",
      proxima: { chefe: TRATO, acao: "proposta" },
    },
    {
      id: "acompanhar-grande",
      grupo: "Vender",
      rotulo: "Acompanhar proposta grande",
      sai: "As mensagens depois da proposta, até o sim ou o não",
      repositorio: "whale",
      skill: "follow-up",
      pedido:
        "Escreva o acompanhamento de uma proposta grande que mandei e ficou sem resposta: até 3 mensagens, cada uma com algo útil, e quando parar.",
      chip: "Acompanhar uma proposta sem resposta",
      formato: "TEXTO",
    },
    // ----------------------------------------------------------- fechar
    {
      id: "proposta",
      grupo: "Fechar",
      rotulo: "Proposta para o cliente",
      sai: "Proposta com 2 ou 3 opções de preço, pronta para mandar",
      repositorio: "closer",
      skill: "proposal-writer",
      pedido:
        "Escreva a proposta comercial do serviço principal com 2 ou 3 opções (avulso, pacote, plano mensal), o que cada uma inclui, o preço e o prazo para responder.",
      chip: "Montar uma proposta",
      formato: "TEXTO",
      proxima: { chefe: TRATO, acao: "contrato" },
    },
    {
      id: "contrato",
      grupo: "Fechar",
      rotulo: "Contrato de serviço",
      sai: "Contrato simples do que foi combinado",
      repositorio: "closer",
      skill: "contract-writer",
      pedido:
        "Escreva o contrato simples do que foi combinado com o cliente: serviço, valor, forma de pagamento, prazo, cancelamento e assinaturas.",
      chip: "Fazer um contrato",
      formato: "TEXTO",
    },
  ],

  [CONSELHO_NOME]: [
    // ----------------------------------------------------------- ideia
    {
      id: "conselho",
      grupo: "Ideia",
      rotulo: "Conselho de sócios",
      sai: "Três olhares sobre a ideia, os riscos e o voto",
      repositorio: "founder",
      skill: "founder-board",
      pedido: "Coloque a ideia abaixo (ou o próximo passo do negócio) na frente do conselho: nota, riscos que matariam e o voto de cada um.",
      chip: "Testar uma ideia nova",
      formato: "TEXTO",
      proxima: { chefe: CONSELHO_NOME, acao: "oferta" },
    },
    {
      id: "teste-sem-do",
      grupo: "Ideia",
      rotulo: "Teste sem dó da ideia",
      sai: "A ideia desmontada sem pena e a versão mais forte dela",
      repositorio: "illegal",
      skill: "larp",
      pedido: "Desmonte sem pena a ideia que descrevo abaixo (ou o próximo serviço que o negócio quer lançar) e monte a versão mais forte dela.",
      chip: "Desmontar a minha ideia",
      formato: "TEXTO",
    },
    {
      id: "concorrentes",
      grupo: "Ideia",
      rotulo: "Mapa dos concorrentes",
      sai: "Quem disputa o seu cliente e o espaço que eles deixam",
      repositorio: "founder",
      skill: "founder-competitors",
      pedido: "Mapeie os concorrentes do negócio na cidade (diretos, indiretos e o que o cliente faz em vez de vir), o preço e a fraqueza de cada um e o espaço que sobra.",
      chip: "Quem são os meus concorrentes?",
      formato: "TEXTO",
    },
    {
      id: "clientes-simulados",
      grupo: "Ideia",
      rotulo: "Painel de clientes",
      sai: "20 clientes simulados reagem à oferta: quem compra e por quê",
      repositorio: "founder",
      skill: "founder-consumer",
      pedido: "Rode o painel rápido (--quick, 20 compradores) com o cliente do negócio: quem compraria o serviço principal, quem não, por quê e o que faria mudar de ideia.",
      chip: "Os clientes comprariam isso?",
      formato: "TEXTO",
      proxima: { chefe: CONSELHO_NOME, acao: "preco" },
    },
    {
      id: "dor-cara",
      grupo: "Ideia",
      rotulo: "Problema que já custa caro",
      sai: "O que o cliente já paga caro para resolver e você pode vender",
      repositorio: "whale",
      skill: "market-researcher",
      pedido: "Ache os problemas que os clientes do negócio já pagam caro para resolver (com quem gastam hoje, quanto) e qual deles o negócio pode vender.",
      chip: "O que os clientes já pagam caro?",
      formato: "TEXTO",
    },
    // ----------------------------------------------------------- oferta
    {
      id: "oferta",
      grupo: "Oferta e preço",
      rotulo: "Oferta irrecusável",
      sai: "O pacote com bônus, garantia e nome",
      repositorio: "founder",
      skill: "founder-offer",
      pedido: "Monte uma oferta irrecusável para o serviço principal: o que entra, bônus honestos, garantia que o negócio aguenta, urgência real e um nome.",
      chip: "Montar um pacote irresistível",
      formato: "TEXTO",
      proxima: { chefe: CONSELHO_NOME, acao: "pagina-oferta" },
    },
    {
      id: "pagina-oferta",
      grupo: "Oferta e preço",
      rotulo: "Página da oferta",
      sai: "A oferta em uma página: problema, o que leva, preço, prazo",
      repositorio: "whale",
      skill: "offer-builder",
      pedido: "Escreva a oferta em uma página para o cliente dizer sim: o problema nos números dele, o que ele leva, o preço, quando começa e como desistir.",
      chip: "Escrever a página de uma oferta",
      formato: "TEXTO",
      proxima: { chefe: TRATO, acao: "proposta" },
    },
    {
      id: "preco",
      grupo: "Oferta e preço",
      rotulo: "Preço certo",
      sai: "O preço que o cliente paga e a escada básico/médio/top",
      repositorio: "founder",
      skill: "founder-pricing",
      pedido: "Defina o preço do serviço principal: a faixa que o cliente aceita, o que os concorrentes cobram, a margem, e a escada básico, médio e top.",
      chip: "Vale a pena subir o preço?",
      formato: "TEXTO",
    },
    {
      id: "preco-pelo-gasto",
      grupo: "Oferta e preço",
      rotulo: "Preço pelo que já gastam",
      sai: "3 preços a partir do que o cliente já gasta hoje",
      repositorio: "whale",
      skill: "pricing",
      pedido: "Calcule o preço do serviço a partir do que o cliente já gasta hoje com o problema: o ano todo, e 3 preços com o que cada um deixa para ele.",
      chip: "Quanto cobrar por um pacote?",
      formato: "TEXTO",
    },
    {
      id: "pre-venda",
      grupo: "Oferta e preço",
      rotulo: "Pré-venda",
      sai: "Condições para vender antes de abrir a agenda nova",
      repositorio: "whale",
      skill: "pre-sale",
      pedido: "Monte a pré-venda de um serviço novo: condições honestas (quando começa, como devolve o dinheiro), a mensagem para os clientes e a meta de vendas.",
      chip: "Vender antes de lançar",
      formato: "TEXTO",
    },
    // ----------------------------------------------------------- números
    {
      id: "numeros",
      grupo: "Números",
      rotulo: "Conta do lucro",
      sai: "Quanto sobra por atendimento, o ponto de equilíbrio e o caixa",
      repositorio: "founder",
      skill: "founder-cfo",
      pedido: "Faça a conta do lucro do serviço principal: quanto sobra por atendimento, a margem, quantos atendimentos por dia pagam as contas e o caixa mês a mês.",
      chip: "Qual serviço dá mais lucro?",
      formato: "TEXTO",
    },
    {
      id: "operacao",
      grupo: "Números",
      rotulo: "Como a casa roda",
      sai: "Fornecedores, escala, rotina de abrir e fechar e riscos",
      repositorio: "founder",
      skill: "founder-ops",
      pedido: "Desenhe como o negócio roda: fornecedores e custo, escala da equipe, rotina de abrir e fechar, ferramentas e o que fazer quando algo dá errado.",
      chip: "Organizar a operação",
      formato: "TEXTO",
    },
    {
      id: "o-que-construir",
      grupo: "Números",
      rotulo: "O que os clientes pedem",
      sai: "Os pedidos dos clientes em ordem do dinheiro por trás",
      repositorio: "whale",
      skill: "requirements",
      pedeTexto: { rotulo: "O que os clientes pediram? (opcional)", obrigatorio: false },
      pedido: "Transforme o que os clientes pedem (descrevo abaixo ou use o que houver) numa lista do que criar no negócio, em ordem do dinheiro que tem por trás de cada pedido.",
      chip: "O que os clientes mais pedem?",
      formato: "TEXTO",
    },
    // ----------------------------------------------------------- crescer
    {
      id: "marketing",
      grupo: "Crescer",
      rotulo: "Plano de marketing",
      sai: "Posicionamento, canais e 30 dias de campanha",
      repositorio: "founder",
      skill: "founder-marketing",
      pedido: "Monte o plano de marketing do negócio: posicionamento, os canais que o cliente usa, 30 dias de campanha com datas e os números para acompanhar.",
      chip: "Plano de marketing do mês",
      formato: "TEXTO",
    },
    {
      id: "marca",
      grupo: "Crescer",
      rotulo: "Marca do negócio",
      sai: "Promessa, voz, frase e o visual que combina",
      repositorio: "founder",
      skill: "founder-brand",
      pedido: "Revise a marca do negócio: a promessa em uma linha, a voz, uma frase de efeito e o visual (cores, letras, primeiras coisas que o cliente vê).",
      chip: "Melhorar a minha marca",
      formato: "TEXTO",
    },
    {
      id: "lancamento",
      grupo: "Crescer",
      rotulo: "Plano de lançamento",
      sai: "Teste barato, contagem regressiva e os primeiros 30 dias",
      repositorio: "founder",
      skill: "founder-launch",
      pedido: "Monte o plano de lançamento do próximo serviço: um teste barato primeiro, a contagem até o dia, o roteiro do dia e o que medir nos 30 dias seguintes.",
      chip: "Lançar um serviço novo",
      formato: "TEXTO",
    },
    {
      id: "cronograma-lancamento",
      grupo: "Crescer",
      rotulo: "Datas do lançamento",
      sai: "As datas de trás para frente a partir do que foi prometido",
      repositorio: "whale",
      skill: "launch-planner",
      pedido: "Monte as datas do lançamento de trás para frente, a partir do dia prometido aos clientes: o que precisa estar pronto em cada semana.",
      chip: "Datas para lançar",
      formato: "TEXTO",
    },
    {
      id: "demonstracao",
      grupo: "Crescer",
      rotulo: "Demonstração do serviço",
      sai: "Página simples que mostra o serviço funcionando",
      repositorio: "whale",
      skill: "demo-builder",
      pedido: "Monte uma demonstração em uma página (HTML simples) que mostre como o serviço novo funciona para o cliente, do pedido ao resultado.",
      chip: "Mostrar o serviço funcionando",
      formato: "TEXTO",
    },
    {
      id: "caso",
      grupo: "Crescer",
      rotulo: "Caso de sucesso",
      sai: "Antes e depois de um cliente, com as palavras dele",
      repositorio: "whale",
      skill: "case-study",
      pedeTexto: { rotulo: "Conte o caso do cliente", obrigatorio: true },
      pedido: "Escreva um caso de sucesso de antes e depois com um cliente real (descrevo abaixo), marcado como rascunho até ele aprovar o texto.",
      chip: "Contar o caso de um cliente",
      formato: "TEXTO",
    },
    {
      id: "plano",
      grupo: "Crescer",
      rotulo: "Plano de negócio",
      sai: "Tudo junto num plano, com o veredito dos números",
      repositorio: "founder",
      skill: "founder-plan",
      pedido: "Junte o que o conselho já produziu num plano de negócio para os próximos 90 dias, com o veredito pelos números e um resumo de uma página.",
      chip: "Plano para os próximos 90 dias",
      formato: "TEXTO",
    },
  ],
};

export function acoesDoChefe(chefe: string): readonly AcaoCardapio[] {
  return CARDAPIO[chefe] ?? [];
}

export function acaoDoCardapio(chefe: string, id: string): AcaoCardapio | null {
  return acoesDoChefe(chefe).find((a) => a.id === id) ?? null;
}

/** Chips de "Pedir ao chefe": um por ação, na ordem do cardápio. */
export function chipsDoChefe(chefe: string): string[] {
  return acoesDoChefe(chefe).map((a) => a.chip);
}

// ---------------------------------------------------------------------------
// Corrente de trabalho (encadeamento)
// ---------------------------------------------------------------------------

export type EloView = { chefe: string; rotulo: string; quem: string };

/** Elos gravados na entrada de uma execução SKILL (`cadeia`). */
export function cadeiaDaEntrada(entrada: unknown): Array<{ chefe: string; repositorio: string; skill: string; rotulo: string; execucaoId: string }> {
  const c = entrada && typeof entrada === "object" ? (entrada as { cadeia?: unknown }).cadeia : null;
  if (!Array.isArray(c)) return [];
  return c
    .filter((x) => !!x && typeof x === "object" && typeof (x as { chefe?: unknown }).chefe === "string")
    .map((x) => {
      const e = x as Record<string, unknown>;
      return {
        chefe: String(e.chefe),
        repositorio: String(e.repositorio ?? ""),
        skill: String(e.skill ?? ""),
        rotulo: String(e.rotulo ?? ""),
        execucaoId: String(e.execucaoId ?? ""),
      };
    });
}

/** A ação do cardápio que gerou esta execução (pelo id gravado ou pela skill). */
export function acaoDaExecucao(chefe: string, repositorio: string | null, skill: string | null, acaoId?: string | null): AcaoCardapio | null {
  const lista = acoesDoChefe(chefe);
  const id = acaoId?.startsWith("cardapio-") ? acaoId.slice("cardapio-".length) : null;
  return (id ? lista.find((a) => a.id === id) : null) ?? lista.find((a) => a.repositorio === repositorio && a.skill === skill) ?? null;
}

/** O próximo passo desta execução, se o cardápio tiver um. */
export function proximaDaExecucao(
  chefe: string,
  repositorio: string | null,
  skill: string | null,
  acaoId?: string | null,
): { chefe: string; acao: AcaoCardapio } | null {
  const atual = acaoDaExecucao(chefe, repositorio, skill, acaoId);
  if (!atual?.proxima) return null;
  const acao = acaoDoCardapio(atual.proxima.chefe, atual.proxima.acao);
  return acao ? { chefe: atual.proxima.chefe, acao } : null;
}
