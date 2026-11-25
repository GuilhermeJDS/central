/**
 * Nome de ação de cada skill, em português, do jeito que o cliente entende.
 * É o único nome que a Central mostra: cardápios, chips, entregas, correntes
 * ("veio de"), decisões, Execuções e textos de erro. Os ids internos
 * (repositório e skill) e a API dos agentes continuam iguais; só não vão para
 * a tela.
 *
 * Módulo puro (vai para o cliente e para o teste que barra id na tela).
 */

/** `repositorio/skill` → nome da ação. */
export const NOME_DA_ACAO: Record<string, string> = {
  // Negociador Trato (vendas e clientes)
  "closer/win-back": "Mensagem para cliente sumido",
  "closer/follow-up": "Mensagens para quem não respondeu",
  "closer/pipeline": "Organizar o funil de vendas",
  "closer/forecaster": "Previsão de faturamento do mês",
  "closer/record-keeper": "Registro das conversas",
  "closer/scheduler": "Resposta para marcar horário",
  "closer/prospector": "Onde achar clientes novos",
  "closer/researcher": "Pesquisa antes da conversa",
  "closer/sales-coach": "Treino de venda da equipe",
  "closer/proposal-writer": "Proposta para o cliente",
  "closer/contract-writer": "Contrato de serviço",
  "whale/objection-handler": "Respostas para objeções",
  "whale/whale-hunter": "Plano para fechar cliente grande",
  "whale/follow-up": "Acompanhar proposta grande",
  "whale/market-researcher": "Problema que já custa caro",
  "whale/offer-builder": "Página da oferta",
  "whale/pricing": "Preço pelo que já gastam",
  "whale/pre-sale": "Pré-venda",
  "whale/requirements": "O que os clientes pedem",
  "whale/launch-planner": "Datas do lançamento",
  "whale/demo-builder": "Demonstração do serviço",
  "whale/case-study": "Caso de sucesso",
  // Conselho (ideia, oferta e números)
  "founder/founder-board": "Conselho de sócios",
  "founder/founder-competitors": "Mapa dos concorrentes",
  "founder/founder-consumer": "Painel de clientes",
  "founder/founder-offer": "Oferta irrecusável",
  "founder/founder-pricing": "Preço certo",
  "founder/founder-cfo": "Conta do lucro",
  "founder/founder-ops": "Como a casa roda",
  "founder/founder-marketing": "Plano de marketing",
  "founder/founder-brand": "Marca do negócio",
  "founder/founder-launch": "Plano de lançamento",
  "founder/founder-plan": "Plano de negócio",
  "illegal/larp": "Teste sem dó da ideia",
  "illegal/crash-out": "Checagem dos fatos",
  "illegal/aura-farming": "Acabamento visual",
  "illegal/67": "Seis caminhos e o melhor deles",
  "illegal/china-maxing": "Pedido enxuto",
  // Editora Pauta (redes)
  "instagram/ig-viral": "O que viralizou no nicho",
  "instagram/ig-reel": "Roteiro de Reels",
  "instagram/ig-carousel": "Carrossel",
  "instagram/ig-plan": "Plano da semana",
  "instagram/ig-profile": "Ajuste do perfil",
  "instagram/ig-caption": "Legenda",
  "instagram/ig-story": "Stories do dia",
  "instagram/ig-reply": "Respostas aos comentários",
  "instagram/ig-comment": "Comentários em outros perfis",
  "instagram/ig-dm": "Mensagens no Direct",
  "instagram/ig-repurpose": "Reaproveitar conteúdo",
  "instagram/ig-audit": "Análise do perfil",
  "instagram/ig-human": "Tirar cara de IA",
  "youtube/yt-plan": "Ideias de vídeo",
  "youtube/yt-package": "Ideias de título e thumbnail",
  "youtube/yt-script": "Roteiro do vídeo",
  "youtube/yt-shorts": "Shorts",
  "youtube/yt-audit": "Análise do canal",
  "youtube/yt-seo": "Descrição e tags",
  "youtube/yt-chapters": "Capítulos do vídeo",
  "youtube/yt-comment": "Respostas aos comentários",
  "youtube/yt-retention": "Onde as pessoas saem do vídeo",
  "youtube/yt-edit": "Lista de cortes",
  "youtube/yt-viral": "O que viralizou no nicho",
  "x/x-thread": "Sequência de posts",
  "x/x-post": "Posts",
  "x/x-viral": "O que viralizou no nicho",
  "x/x-profile": "Ajuste do perfil",
  "x/x-plan": "Plano da semana",
  "x/x-reply": "Respostas às respostas",
  "x/x-comment": "Comentários em outros perfis",
  "x/x-dm": "Mensagens diretas",
  "x/x-repurpose": "Reaproveitar conteúdo",
  "x/x-audit": "Análise do perfil",
  "x/x-human": "Tirar cara de IA",
  "linkedin/li-post": "Posts",
  "linkedin/li-carousel": "Carrossel em PDF",
  "linkedin/li-profile": "Ajuste do perfil",
  "linkedin/li-plan": "Plano da semana",
  "linkedin/li-reply": "Respostas aos comentários",
  "linkedin/li-comment": "Comentários em outros perfis",
  "linkedin/li-dm": "Convite e mensagem",
  "linkedin/li-inbox": "Caixa de entrada organizada",
  "linkedin/li-repurpose": "Reaproveitar conteúdo",
  "linkedin/li-audit": "Análise do perfil",
  "linkedin/li-human": "Tirar cara de IA",
  "tiktok/tt-ideias": "Ideias de vídeo",
  "tiktok/tt-ganchos": "Primeiras frases do vídeo",
  "tiktok/tt-roteiro": "Roteiro do vídeo",
  "tiktok/tt-fotos": "Carrossel de fotos",
  "tiktok/tt-legenda": "Legenda e hashtags",
  "master/virality": "O que viralizou em todas as redes",
  "master/edit": "Edição de vídeo curto",
  "master/build": "Montar site ou app",
  "promptmaster/promptmaster": "Pedido afinado",
};

/** Trabalhos internos da Central gravados no campo skill (sem repositório). */
export const NOME_INTERNO: Record<string, string> = {
  "producao-carrossel": "Montar o carrossel",
  "producao-post": "Montar o post",
  "producao-texto": "Montar o texto",
  "producao-titulo": "Montar os títulos",
  "producao-thumbnail": "Montar a thumbnail",
  "producao-roteiro": "Montar o roteiro",
  "producao-thread": "Montar a sequência de posts",
  "ficha-colar-contexto": "Ler o texto colado na ficha",
};

/** Só o nome da skill, sem o repositório (para registros antigos sem repositório). */
const POR_SKILL: Record<string, string> = { ...NOME_INTERNO };
for (const [k, v] of Object.entries(NOME_DA_ACAO)) {
  const s = k.slice(k.indexOf("/") + 1);
  if (!(s in POR_SKILL)) POR_SKILL[s] = v;
}

const PADRAO = "Trabalho do chefe";

/**
 * Nome de ação de uma skill. Nunca devolve o id: skill desconhecida vira
 * "Trabalho do chefe".
 */
export function nomeDaAcao(repositorio: string | null | undefined, skill: string | null | undefined): string {
  const s = (skill ?? "").replace(/^\//, "").trim();
  if (!s) return PADRAO;
  return NOME_DA_ACAO[`${repositorio ?? ""}/${s}`] ?? POR_SKILL[s] ?? PADRAO;
}

/** Todos os ids (skills e repositórios que não são nome de rede) que não podem ir para a tela. */
export function idsProibidosNaTela(): string[] {
  const redes = new Set(["instagram", "youtube", "x", "linkedin", "tiktok"]);
  const ids = new Set<string>();
  for (const k of Object.keys(NOME_DA_ACAO)) {
    const [repo, skill] = k.split("/");
    if (!redes.has(repo)) ids.add(repo);
    ids.add(skill);
  }
  for (const k of Object.keys(NOME_INTERNO)) ids.add(k);
  for (const r of ["closer", "whale", "founder", "illegal", "illegal-codes", "master", "promptmaster"]) ids.add(r);
  return [...ids];
}

/** As skills (só o id) que têm este nome de ação: o filtro "Ação" de Execuções. */
export function skillsDoNome(nome: string): string[] {
  const ids = new Set<string>();
  for (const [k, v] of Object.entries(NOME_DA_ACAO)) if (v === nome) ids.add(k.slice(k.indexOf("/") + 1));
  return [...ids];
}

/** Ids que também são palavras comuns: no texto livre só troca quando vêm como "repo/skill" ou "/skill". */
const PALAVRA_COMUM = new Set(["edit", "build", "pricing", "pipeline", "requirements", "scheduler", "researcher", "prospector", "forecaster", "67", "virality", "follow-up"]);

/**
 * Troca o id de skill que tenha sobrado num texto (erro antigo, título
 * gravado) pelo nome da ação: "whale/pricing", "/edit", "ig-carousel".
 */
export function semIdDeSkill(texto: string): string {
  return texto
    .replace(/\b([a-z]+(?:-[a-z]+)*)\/([a-z0-9]+(?:-[a-z0-9]+)*)\b/g, (m, repo: string, skill: string) => NOME_DA_ACAO[`${repo}/${skill}`] ?? m)
    .replace(/(^|[^\w/-])(\/?)([a-z0-9]+(?:-[a-z0-9]+)+|[a-z]+)(?![\w-])/g, (m, antes: string, barra: string, id: string) => {
      const nome = POR_SKILL[id];
      if (!nome) return m;
      if (PALAVRA_COMUM.has(id) && !barra) return m;
      return `${antes}${nome}`;
    })
    .replace(/\b(claude-illegal-codes|master-skills|promptmaster|illegal-codes|whale|closer|founder|larp|crash-out)\b/gi, "chefe")
    .replace(/\bSkills\b/g, "Ações")
    .replace(/\bskills\b/g, "ações")
    .replace(/\bSkill\b/g, "Ação")
    .replace(/\bskill\b/g, "ação");
}
