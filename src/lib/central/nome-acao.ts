/**
 * Nome de ação de cada skill, em português, do jeito que o cliente entende.
 * É o único nome que a Central mostra: cardápios, chips, entregas, correntes
 * ("veio de"), decisões, Execuções e textos de erro. Os ids internos
 * (repositório e skill) e a API dos agentes continuam iguais; só não vão para
 * a tela.
 *
 * Módulo puro (vai para o cliente e para o teste que barra id na tela).
 */

/** Nome de cada skill da pasta skills/ (a mesma skill de redes serve todas as redes). */
const NOME_DA_SKILL: Record<string, string> = {
  // Editora Pauta (redes)
  "plano-do-mes": "Plano do mês",
  legenda: "Legenda e texto do post",
  carrossel: "Carrossel",
  "roteiro-curto": "Roteiro de vídeo curto",
  "roteiro-youtube": "Roteiro do vídeo",
  "titulo-e-capa": "Título e capa",
  stories: "Stories do dia",
  responder: "Respostas e mensagens",
  reaproveitar: "Reaproveitar conteúdo",
  "auditoria-do-perfil": "Análise do perfil",
  "o-que-viraliza": "O que viralizou no nicho",
  "tirar-cara-de-ia": "Tirar cara de IA",
  // Negociador Trato
  proposta: "Proposta para o cliente",
  contrato: "Contrato de serviço",
  funil: "Funil de vendas",
  agenda: "Resposta para marcar horário",
  "01-prospeccao-fria": "Prospecção de clientes novos",
  "02-pesquisa-de-lead": "Pesquisa antes da conversa",
  "03-negociacao-whatsapp": "Conversa no WhatsApp",
  "04-quebra-de-objecoes": "Respostas para objeções",
  "05-follow-up-e-reconquista": "Follow-up e cliente sumido",
  "06-lista-negra-e-governanca": "Regras das mensagens",
  "07-psicologia-por-perfil": "Venda por perfil de cliente",
  "08-arquitetura-operacao-24-7": "Vendas rodando 24 horas",
  chicote: "Página de vendas",
  // Conselho
  "avaliar-ideia": "Conselho sobre a ideia",
  concorrentes: "Mapa dos concorrentes",
  "teste-com-clientes": "Teste com clientes",
  oferta: "Oferta irrecusável",
  preco: "Preço certo",
  lancamento: "Plano de lançamento",
  marca: "Marca do negócio",
  marketing: "Plano de marketing",
  "numeros-e-caixa": "Conta do lucro",
  "operacao-do-dia": "Como a casa roda",
  "plano-do-negocio": "Plano de negócio",
  // Bastidor
  "afinar-pedido": "Pedido afinado",
  "checar-fatos": "Checagem dos fatos",
};

const AREA_DA_SKILL: Record<string, string> = {
  proposta: "vendas", contrato: "vendas", funil: "vendas", agenda: "vendas", chicote: "chicote",
  "avaliar-ideia": "estrategia", concorrentes: "estrategia", "teste-com-clientes": "estrategia", oferta: "estrategia",
  preco: "estrategia", lancamento: "estrategia", marca: "estrategia", marketing: "estrategia",
  "numeros-e-caixa": "operacao", "operacao-do-dia": "operacao", "plano-do-negocio": "operacao",
  "afinar-pedido": "bastidor", "checar-fatos": "bastidor",
};

const REDES_PAUTA = ["instagram", "youtube", "tiktok", "linkedin", "x"];
const SKILLS_DE_REDE = ["plano-do-mes", "legenda", "carrossel", "roteiro-curto", "roteiro-youtube", "titulo-e-capa", "stories", "responder", "reaproveitar", "auditoria-do-perfil", "o-que-viraliza", "tirar-cara-de-ia"];

/** `repositorio/skill` → nome da ação. */
export const NOME_DA_ACAO: Record<string, string> = {};
for (const [skill, nome] of Object.entries(NOME_DA_SKILL)) {
  if (SKILLS_DE_REDE.includes(skill)) for (const r of REDES_PAUTA) NOME_DA_ACAO[`${r}/${skill}`] = nome;
  else if (/^0\d-/.test(skill)) NOME_DA_ACAO[`prospeccao/${skill}`] = nome;
  else NOME_DA_ACAO[`${AREA_DA_SKILL[skill] ?? "bastidor"}/${skill}`] = nome;
}

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
  for (const r of ["vendas", "prospeccao", "chicote", "estrategia", "operacao", "bastidor"]) ids.add(r);
  return [...ids];
}

/** As skills (só o id) que têm este nome de ação: o filtro "Ação" de Execuções. */
export function skillsDoNome(nome: string): string[] {
  const ids = new Set<string>();
  for (const [k, v] of Object.entries(NOME_DA_ACAO)) if (v === nome) ids.add(k.slice(k.indexOf("/") + 1));
  return [...ids];
}

/** Ids que também são palavras comuns: no texto livre só troca quando vêm como "repo/skill" ou "/skill". */
const PALAVRA_COMUM = new Set(["legenda", "carrossel", "stories", "responder", "reaproveitar", "proposta", "contrato", "funil", "agenda", "chicote", "concorrentes", "oferta", "preco", "lancamento", "marca", "marketing", "vendas", "estrategia", "operacao", "bastidor"]);

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
