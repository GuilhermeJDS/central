/**
 * Dados de exemplo da Central: um negócio fictício completo (Studio
 * Aurora Estética, Muriaé-MG). Entra em qualquer bloco que não tenha dado real —
 * sem conta, sem ficha, sem conexão ou sem histórico. Nada aqui vai ao banco.
 * Módulo puro (sem servidor): pode ser lido por componentes de cliente.
 */
import type { SlugDepartamento } from "@/lib/central/departamentos";

import type {
  AcaoNorteView,
  AnaliseView,
  DecisaoView,
  EntregaView,
  EventoView,
  FichaView,
  NumeroView,
  Periodo,
  PulsoView,
  SerieView,
  VizinhosView,
} from "./tipos";

const DIA_MS = 86_400_000;
const HORA_MS = 3_600_000;

function ha(agora: Date, dias: number, horas = 0): string {
  return new Date(agora.getTime() - dias * DIA_MS - horas * HORA_MS).toISOString();
}

// ---------------------------------------------------------------------------
// Negócio
// ---------------------------------------------------------------------------

export const NEGOCIO_EXEMPLO = { nome: "Studio Aurora Estética", cidade: "Muriaé, MG" } as const;

export const FICHA_EXEMPLO: FichaView = {
  nomeNegocio: "Studio Aurora Estética",
  cidade: "Muriaé, MG",
  oQueVende: "Limpeza de pele, design de sobrancelha, drenagem linfática e pacote mensal (4 sessões).",
  paraQuem: "Mulheres de 25 a 50 anos que trabalham no centro de Muriaé e querem se cuidar sem perder a tarde.",
  objetivo: "MAIS_CLIENTES",
  objetivoOutro: "",
  instagram: "@studioaurora.muriae",
  site: "studioaurora.com.br",
  google: "Studio Aurora Estética, R. Coronel Domiciano, Centro",
  youtube: "",
  linkedin: "",
  x: "",
  comoFala: "Acolhedor e direto, sem promessa milagrosa. Trata a cliente pelo nome.",
  naoQuer: "Promoção de preço baixo, foto de antes e depois sem autorização.",
};

export const PRIMEIRO_NOME_EXEMPLO = "Matheus";

// ---------------------------------------------------------------------------
// Início
// ---------------------------------------------------------------------------

export const ACAO_EXEMPLO: AcaoNorteView = {
  execucaoId: null,
  chefe: "Inspetor Rastro",
  departamentoNome: "Presença",
  slug: "presenca",
  titulo: "Pedir avaliação no Google para quem foi atendida esta semana.",
  porQue:
    "Você tem 86 avaliações e a clínica mais perto tem 214. Quem procura no Google escolhe pelo número de avaliações antes de olhar a nota.",
  decisao: "PENDENTE",
  equipeFaz: false,
};

/** As ações da semana do exemplo (setas no card do Norte). */
export const ACOES_EXEMPLO: AcaoNorteView[] = [
  ACAO_EXEMPLO,
  {
    execucaoId: null,
    chefe: "Editora Pauta",
    departamentoNome: "Redes",
    slug: "redes",
    titulo: "Postar um carrossel de antes e depois da limpeza de pele.",
    porQue: "Os posts com resultado real são os que mais trouxeram mensagens no último mês.",
    decisao: "APROVADA",
    equipeFaz: true,
  },
  {
    execucaoId: null,
    chefe: "Negociador Trato",
    departamentoNome: "Vendas",
    slug: "vendas",
    titulo: "Chamar de volta quem não volta há mais de 45 dias.",
    porQue: "São clientes que já confiam em você: voltar custa menos que conquistar uma nova.",
    decisao: "APROVADA",
    equipeFaz: false,
  },
];

/** Ações aprovadas desde segunda (0 a 5). */
export const CEU_EXEMPLO = 2;

export const VIZINHOS_EXEMPLO: VizinhosView = {
  voce: { nota: 4.8, avaliacoes: 86 },
  vizinhos: [
    { nome: "Clínica Bella Pele", nota: 4.6, avaliacoes: 214 },
    { nome: "Espaço Renova", nota: 4.4, avaliacoes: 151 },
    { nome: "Ateliê da Sobrancelha", nota: 4.7, avaliacoes: 97 },
  ],
};

/** 60 dias de atendimentos (domingo fechado, sexta e sábado cheios). */
const ATENDIMENTOS_60 = [
  0, 14, 12, 15, 17, 24, 27, 0, 13, 14, 13, 18, 23, 26, 0, 12, 15, 16, 17, 25, 28, 0, 14, 13, 16, 19, 24, 27, 0, 15,
  0, 15, 14, 16, 18, 26, 29, 0, 16, 15, 17, 20, 27, 30, 0, 15, 16, 18, 19, 26, 31, 0, 17, 16, 18, 21, 28, 30, 0, 18,
];

export function serieExemplo(dias: Periodo, agora = new Date()): SerieView {
  const atual = ATENDIMENTOS_60.slice(-dias);
  const antes = ATENDIMENTOS_60.slice(-dias * 2, -dias);
  return {
    dias: atual.map((total, i) => ({ data: ha(agora, dias - 1 - i).slice(0, 10), total })),
    total: atual.reduce((a, b) => a + b, 0),
    anterior: antes.reduce((a, b) => a + b, 0),
  };
}

export function pulsoExemplo(agora = new Date()): PulsoView {
  return [
    { slug: "presenca", nome: "Presença", chefe: "Inspetor Rastro", estado: "ativo", ultima: ha(agora, 1), entregas: 2, pendentes: 1, semana: [0, 1, 0, 0, 1, 0, 0] },
    { slug: "redes", nome: "Redes", chefe: "Editora Pauta", estado: "ativo", ultima: ha(agora, 2), entregas: 5, pendentes: 1, semana: [1, 0, 2, 1, 0, 1, 0] },
    { slug: "vendas", nome: "Vendas", chefe: "Negociador Trato", estado: "ativo", ultima: ha(agora, 4), entregas: 3, pendentes: 1, semana: [0, 1, 0, 1, 0, 1, 0] },
    { slug: "estrategia", nome: "Estratégia", chefe: "Conselho", estado: "ativo", ultima: ha(agora, 6), entregas: 1, pendentes: 1, semana: [0, 0, 0, 1, 0, 0, 0] },
    { slug: "operacao", nome: "Operação", chefe: "Gerente Rotina", estado: "ativo", ultima: ha(agora, 0, 5), entregas: 7, pendentes: 0, semana: [1, 1, 1, 0, 2, 1, 1] },
  ];
}

// ---------------------------------------------------------------------------
// Decisões
// ---------------------------------------------------------------------------

export function decisoesExemplo(agora = new Date()): DecisaoView[] {
  return [
    {
      id: "ex-d1",
      chefe: "Editora Pauta",
      departamento: "Redes",
      slug: "redes",
      titulo: "Carrossel: 5 cuidados de pele para o calor",
      porQue: "Os posts de lista foram os mais salvos do mês. Este fala com quem não tem tempo de vir toda semana.",
      conteudo:
        "**Capa:** 5 cuidados de pele para o calor de Muriaé.\n\n1. Protetor a cada 3 horas\n2. Limpeza leve de manhã\n3. Hidratante em gel\n4. Esfoliação só uma vez por semana\n5. Limpeza de pele a cada 30 dias\n\n**Legenda:** Marque aquela amiga que vive dizendo que não tem tempo de se cuidar.",
      estado: "pendente",
      em: ha(agora, 0, 3),
    },
    {
      id: "ex-d2",
      chefe: "Negociador Trato",
      departamento: "Vendas",
      slug: "vendas",
      titulo: "Mensagem para quem não volta há 45 dias",
      porQue: "31 clientes vieram em setembro e não marcaram de novo. Um lembrete pessoal costuma trazer um terço de volta.",
      conteudo:
        "Oi, {nome}! Aqui é do Studio Aurora. Faz um tempinho que você não aparece — quer que eu separe um horário no almoço desta semana? É só responder com o dia.",
      estado: "pendente",
      em: ha(agora, 0, 7),
    },
    {
      id: "ex-d3",
      chefe: "Inspetor Rastro",
      departamento: "Presença",
      slug: "presenca",
      titulo: "Responder as 4 avaliações sem resposta",
      porQue: "Avaliação respondida mostra que tem gente cuidando. Duas delas são de 3 estrelas.",
      conteudo:
        "**Para a Renata (3★):** Renata, obrigada por falar da espera. Desde outubro abrimos um horário a mais no almoço — volta aqui e me diz se melhorou.\n\n**Para a Bia (5★):** Obrigada, Bia! A Carol vai adorar saber.",
      estado: "pendente",
      em: ha(agora, 1, 2),
    },
    {
      id: "ex-d4",
      chefe: "Conselho",
      departamento: "Estratégia",
      slug: "estrategia",
      titulo: "Testar pacote de 4 sessões por R$ 289",
      porQue: "Quem faz limpeza e drenagem todo mês gasta R$ 360. O pacote prende a cliente e enche a terça e a quarta.",
      conteudo:
        "Pacote mensal: 4 sessões por R$ 289, válidas de segunda a quinta. Oferecer só para quem veio 3 vezes ou mais nos últimos 60 dias (42 clientes).",
      estado: "pendente",
      em: ha(agora, 2),
    },
    {
      id: "ex-d5",
      chefe: "Editora Pauta",
      departamento: "Redes",
      slug: "redes",
      titulo: "Reel: um sábado no studio em 30 segundos",
      porQue: "Os vídeos de bastidor tiveram o dobro de alcance dos de antes e depois.",
      conteudo: "Roteiro: 7h40 porta abrindo → chá → primeira maca → sala cheia no fim da tarde → luz apagando. Música sem letra.",
      estado: "aprovada",
      em: ha(agora, 3),
    },
    {
      id: "ex-d6",
      chefe: "Gerente Rotina",
      departamento: "Operação",
      slug: "operacao",
      titulo: "Lembrete no WhatsApp 2 horas antes do horário",
      porQue: "Foram 9 faltas em 30 dias, quase todas no fim da tarde.",
      conteudo: "Ativar o lembrete automático 2 horas antes, com botão para remarcar.",
      estado: "aprovada",
      em: ha(agora, 4),
    },
    {
      id: "ex-d7",
      chefe: "Negociador Trato",
      departamento: "Vendas",
      slug: "vendas",
      titulo: "Desconto de 20% para indicação",
      porQue: "Indicação traz cliente que fica, mas desconto alto ensina a esperar promoção.",
      conteudo: "Quem indicar ganha 20% na próxima sessão.",
      estado: "passada",
      em: ha(agora, 6),
    },
    {
      id: "ex-d8",
      chefe: "Editora Pauta",
      departamento: "Redes",
      slug: "redes",
      titulo: "Post: a história da primeira maca do studio",
      porQue: "Posts com história do lugar trazem comentário e marcação.",
      conteudo: "A primeira maca do studio foi comprada com as economias de um ano inteiro, em 2014…",
      estado: "ajuste",
      em: ha(agora, 7),
    },
  ];
}

// ---------------------------------------------------------------------------
// Linha do tempo
// ---------------------------------------------------------------------------

export function linhaExemplo(agora = new Date()): EventoView[] {
  const e = (
    id: string,
    dias: number,
    horas: number,
    chefe: string,
    linha: string,
    slug: SlugDepartamento | null,
    tipo: EventoView["tipo"] = "resultado",
  ): EventoView => ({ id, em: ha(agora, dias, horas), chefe, linha, slug, tipo });
  return [
    e("ex-l1", 0, 3, "Editora Pauta", "Carrossel pronto: 5 cuidados de pele para o calor.", "redes"),
    e("ex-l2", 0, 5, "Gerente Rotina", "Leu a rotina: sábado lotou antes das 11h.", "operacao"),
    e("ex-l3", 0, 7, "Negociador Trato", "Mensagem pronta para 31 clientes que não voltaram.", "vendas"),
    e("ex-l4", 1, 2, "Inspetor Rastro", "Achou 4 avaliações sem resposta no Google.", "presenca"),
    e("ex-l5", 1, 6, "Norte", "Ação da semana: pedir avaliação para quem foi atendida esta semana.", null),
    e("ex-l6", 2, 0, "Conselho", "Proposta de pacote mensal com 4 sessões.", "estrategia"),
    e("ex-l7", 3, 1, "Editora Pauta", "Você aprovou: Reel de um sábado no studio em 30 segundos.", "redes", "decisao"),
    e("ex-l8", 4, 3, "Gerente Rotina", "Você aprovou: lembrete 2 horas antes do horário.", "operacao", "decisao"),
    e("ex-l9", 5, 2, "Inspetor Rastro", "Comparou com 3 clínicas de estética num raio de 1 km.", "presenca"),
    e("ex-l10", 6, 4, "Negociador Trato", "Você passou: desconto de 20% para indicação.", "vendas", "decisao"),
    e("ex-l11", 7, 1, "Editora Pauta", "Você pediu ajuste: post da primeira maca do studio.", "redes", "decisao"),
    e("ex-l12", 9, 5, "Gerente Rotina", "Leu a rotina: 9 faltas, quase todas depois das 17h.", "operacao"),
    e("ex-l13", 2, 4, "Editora Pauta", "Publicado no Instagram: 5 cuidados de pele para o calor.", "redes", "marco"),
    e("ex-l14", 4, 1, "Gerente Rotina", "Venda: kit de hidratação · R$ 89,00", "operacao", "marco"),
    e("ex-l15", 6, 2, "Negociador Trato", "Contrato fechado: pacote mensal de 4 sessões.", "vendas", "marco"),
  ].map((x) => ({
    ...x,
    decisao: x.linha.startsWith("Você aprovou")
      ? "APROVADA"
      : x.linha.startsWith("Você passou")
        ? "PASSADA"
        : x.linha.startsWith("Você pediu")
          ? "AJUSTAR"
          : undefined,
    marco: x.tipo !== "marco" ? undefined : x.linha.startsWith("Publicado") ? "publicado" : x.linha.startsWith("Venda") ? "venda" : "contrato",
  }));
}

// ---------------------------------------------------------------------------
// Departamentos
// ---------------------------------------------------------------------------

type DepartamentoExemplo = {
  analise: Omit<AnaliseView, "periodo">;
  /** Números de 30 dias; 7 e 14 dias saem proporcionais. */
  numeros: Array<{ rotulo: string; valor30: number; anterior30: number; formato?: "nota" | "real" | "pct"; menosEMelhor?: boolean; fixo?: boolean }>;
  entregas: Array<{ titulo: string; tipo: string; dias: number; estado: EntregaView["estado"] }>;
};

const DEPARTAMENTOS_EXEMPLO: Record<SlugDepartamento, DepartamentoExemplo> = {
  presenca: {
    analise: {
      frase: "Sua nota é a melhor da rua; o que falta é volume de avaliações.",
      paragrafo:
        "Com 4,8 você está acima dos três vizinhos, mas aparece depois deles no Maps porque tem menos da metade das avaliações da Clínica Bella Pele. Quatro avaliações seguem sem resposta, duas delas de 3 estrelas.",
      funcionando: ["Nota 4,8, a maior entre as 4 clínicas do raio de 1 km.", "Fotos novas no perfil renderam 38% mais visitas à rota."],
      fazer: ["Pedir avaliação no WhatsApp logo depois da sessão.", "Responder as 4 avaliações pendentes ainda hoje."],
      proximos: ["Colocar o QR de avaliação na recepção.", "Nova leitura dos vizinhos em 7 dias."],
    },
    numeros: [
      { rotulo: "Nota no Google", valor30: 4.8, anterior30: 4.7, formato: "nota", fixo: true },
      { rotulo: "Avaliações novas", valor30: 9, anterior30: 5 },
      { rotulo: "Visitas ao perfil", valor30: 1240, anterior30: 980 },
      { rotulo: "Pedidos de rota", valor30: 212, anterior30: 154 },
    ],
    entregas: [
      { titulo: "Respostas para 4 avaliações", tipo: "Texto", dias: 1, estado: "pendente" },
      { titulo: "Comparação com 3 vizinhos", tipo: "Leitura", dias: 5, estado: "pronto" },
      { titulo: "QR de avaliação para o espelho", tipo: "Arte", dias: 8, estado: "aprovada" },
    ],
  },
  redes: {
    analise: {
      frase: "Bastidor puxa alcance; lista prática puxa salvamento.",
      paragrafo:
        "Em 30 dias o perfil alcançou 18,4 mil pessoas, 64% fora dos seguidores. Os vídeos do dia a dia tiveram o dobro do alcance dos de antes e depois, e os carrosséis de lista foram os mais salvos.",
      funcionando: ["Reels de bastidor: 2,1× o alcance médio.", "Carrossel de lista: o formato mais salvo do mês."],
      fazer: ["Alternar carrossel e reel da mesma ideia por 3 semanas.", "Postar terça e sexta às 12h, quando o público mais abre."],
      proximos: ["Carrossel: 5 cuidados de pele para o calor.", "Reel: um sábado no studio em 30 segundos.", "Stories com enquete do tratamento do mês."],
    },
    numeros: [
      { rotulo: "Alcance", valor30: 18_420, anterior30: 12_910 },
      { rotulo: "Seguidores novos", valor30: 146, anterior30: 98 },
      { rotulo: "Salvamentos", valor30: 512, anterior30: 340 },
      { rotulo: "Mensagens recebidas", valor30: 63, anterior30: 51 },
    ],
    entregas: [
      { titulo: "Carrossel: 5 cuidados de pele para o calor", tipo: "Carrossel", dias: 0, estado: "pendente" },
      { titulo: "Reel: um sábado no studio em 30 segundos", tipo: "Reel", dias: 3, estado: "aprovada" },
      { titulo: "Post: a primeira maca do studio", tipo: "Post", dias: 7, estado: "ajuste" },
    ],
  },
  vendas: {
    analise: {
      frase: "O dinheiro está em quem já veio e sumiu.",
      paragrafo:
        "31 clientes vieram em setembro e não marcaram de novo. O ticket médio subiu para R$ 118 com a drenagem, mas só 1 em cada 4 limpezas leva o combo.",
      funcionando: ["Combo limpeza + drenagem subiu o ticket para R$ 118.", "Pacote mensal já tem 12 assinantes."],
      fazer: ["Mandar a mensagem de volta para os 31 que sumiram.", "Oferecer a drenagem na hora de marcar, não na maca."],
      proximos: ["Mensagem de retorno pronta para aprovar.", "Roteiro de oferta do combo para o WhatsApp."],
    },
    numeros: [
      { rotulo: "Receita", valor30: 26_840, anterior30: 23_310, formato: "real" },
      { rotulo: "Ticket médio", valor30: 118, anterior30: 104, formato: "real", fixo: true },
      { rotulo: "Combos vendidos", valor30: 118, anterior30: 96 },
      { rotulo: "Clientes que voltaram", valor30: 64, anterior30: 71 },
    ],
    entregas: [
      { titulo: "Mensagem para quem não volta há 45 dias", tipo: "Mensagem", dias: 0, estado: "pendente" },
      { titulo: "Roteiro de oferta do combo", tipo: "Roteiro", dias: 4, estado: "pronto" },
      { titulo: "Desconto de 20% para indicação", tipo: "Proposta", dias: 6, estado: "passada" },
    ],
  },
  estrategia: {
    analise: {
      frase: "Terça e quarta vazias pagam o pacote mensal.",
      paragrafo:
        "A agenda fica 92% cheia na sexta e no sábado e 48% no começo da semana. Um pacote que só vale de segunda a quinta usa a maca parada sem baixar o preço do fim de semana.",
      funcionando: ["Sexta e sábado com 92% de ocupação.", "Preço da limpeza de pele sem desconto há 8 meses."],
      fazer: ["Testar o pacote de 4 sessões por R$ 289 com as 42 clientes fiéis.", "Medir a ocupação de terça e quarta por 4 semanas."],
      proximos: ["Decisão do pacote mensal.", "Revisão do preço da drenagem em janeiro."],
    },
    numeros: [
      { rotulo: "Ocupação da agenda", valor30: 71, anterior30: 66, formato: "pct", fixo: true },
      { rotulo: "Clientes fiéis (3+ visitas)", valor30: 42, anterior30: 37, fixo: true },
      { rotulo: "Horários vagos", valor30: 186, anterior30: 214, menosEMelhor: true },
      { rotulo: "Margem estimada", valor30: 38, anterior30: 35, formato: "pct", fixo: true },
    ],
    entregas: [
      { titulo: "Pacote de 4 sessões por R$ 289", tipo: "Proposta", dias: 2, estado: "pendente" },
      { titulo: "Mapa de ocupação por dia da semana", tipo: "Leitura", dias: 19, estado: "pronto" },
    ],
  },
  operacao: {
    analise: {
      frase: "Sábado lota antes das 11h; as faltas moram no fim da tarde.",
      paragrafo:
        "Foram 482 atendimentos em 30 dias, 9% a mais que no mês anterior. Das 9 faltas, 7 foram depois das 17h, quando a cliente sai do trabalho atrasada.",
      funcionando: ["Atendimentos 9% acima do mês anterior.", "Cancelamentos caíram de 14 para 8."],
      fazer: ["Lembrete no WhatsApp 2 horas antes.", "Abrir o sábado às 7h30 para quem trabalha."],
      proximos: ["Lembrete automático já aprovado.", "Nova leitura da rotina na segunda."],
    },
    numeros: [
      { rotulo: "Atendimentos", valor30: 482, anterior30: 442 },
      { rotulo: "Faltas", valor30: 9, anterior30: 12, menosEMelhor: true },
      { rotulo: "Cancelamentos", valor30: 8, anterior30: 14, menosEMelhor: true },
      { rotulo: "Sem voltar há 60 dias", valor30: 31, anterior30: 27, menosEMelhor: true, fixo: true },
    ],
    entregas: [
      { titulo: "Leitura da rotina", tipo: "Leitura", dias: 0, estado: "pronto" },
      { titulo: "Lembrete 2 horas antes do horário", tipo: "Ajuste", dias: 4, estado: "aprovada" },
    ],
  },
};

function formatar(v: number, formato?: "nota" | "real" | "pct"): string {
  if (formato === "nota") return v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  if (formato === "real") return `R$ ${Math.round(v).toLocaleString("pt-BR")}`;
  if (formato === "pct") return `${Math.round(v)}%`;
  return Math.round(v).toLocaleString("pt-BR");
}

export function analiseExemplo(slug: SlugDepartamento, periodo: string): AnaliseView {
  return { ...DEPARTAMENTOS_EXEMPLO[slug].analise, periodo };
}

export function numerosExemplo(slug: SlugDepartamento, dias: Periodo): NumeroView[] {
  return DEPARTAMENTOS_EXEMPLO[slug].numeros.map((n) => {
    const f = n.fixo ? 1 : dias / 30;
    const valor = n.valor30 * f;
    const anterior = n.anterior30 * f;
    return {
      rotulo: n.rotulo,
      valor: formatar(valor, n.formato),
      variacao: anterior ? Math.round(((valor - anterior) / anterior) * 1000) / 10 : null,
      menosEMelhor: n.menosEMelhor,
      base: `antes: ${formatar(anterior, n.formato)}`,
    };
  });
}

export function entregasExemplo(slug: SlugDepartamento, agora = new Date()): EntregaView[] {
  return DEPARTAMENTOS_EXEMPLO[slug].entregas.map((e, i) => ({
    id: `ex-${slug}-${i}`,
    titulo: e.titulo,
    tipo: e.tipo,
    em: ha(agora, e.dias, 2),
    estado: e.estado,
  }));
}
