/**
 * Áreas das Redes na Central: uma por rede, cada botão roda uma skill do
 * repositório daquela rede (vendor/skills) direto, sem o chefe escolher.
 * Módulo puro: a tela usa para montar os botões; o servidor valida por aqui.
 *
 * TikTok tem repositório próprio (vendor/skills/tiktok, escrito pela Korely):
 * ideias, ganchos, roteiro, carrossel de fotos e legenda com hashtags.
 */
import type { TipoEntrega } from "@/lib/central/entregas-tipos";
import type { RedeConectavel } from "@/lib/redes/catalogo";

export type SlugRede = "instagram" | "youtube" | "x" | "linkedin" | "tiktok";

export type AcaoRede = {
  id: string;
  rotulo: string;
  /** Uma linha: o que sai. */
  sai: string;
  repositorio: string;
  skill: string;
  /** O que vai para a skill (a ficha entra junto). */
  pedido: string;
  /** Peça final quando o dono aprovar (sem isto, a skill decide). */
  formato?: TipoEntrega;
  /** Só roda com esta rede conectada (Conexões). */
  precisa?: RedeConectavel;
  /** Tema de busca para as skills de viral (vazio = o nicho da ficha). */
  busca?: string;
  /** A skill trabalha em cima de um texto do dono (comentários, rascunho, transcrição). */
  pedeTexto?: TextoDoDono;
};

export type TextoDoDono = {
  /** Rótulo do campo ("Cole os comentários"). */
  rotulo: string;
  /** Sem texto a skill não tem com o que trabalhar. */
  obrigatorio: boolean;
};

export type AreaRede = {
  slug: SlugRede;
  /** Valor gravado nas entregas (EntregaChefe.rede). */
  rede: string;
  nome: string;
  /** Repositório de vendor/skills. */
  repositorio: string;
  acoes: AcaoRede[];
};

export const AREAS_REDES: readonly AreaRede[] = [
  {
    slug: "instagram",
    rede: "INSTAGRAM",
    nome: "Instagram",
    repositorio: "instagram",
    acoes: [
      {
        id: "viral",
        rotulo: "Viral do nicho",
        sai: "O que bomba no seu nicho e 3 ideias suas",
        repositorio: "instagram",
        skill: "ig-viral",
        pedido: "Ache o que está viralizando no meu nicho no Instagram agora e me dê 3 ideias adaptadas ao meu negócio, com gancho.",
        precisa: "INSTAGRAM",
      },
      {
        id: "reels",
        rotulo: "Roteiro de Reels",
        sai: "Roteiro de 30 s com gancho e texto na tela",
        repositorio: "instagram",
        skill: "ig-reel",
        pedido: "Escreva um Reel de 30 segundos sobre o serviço mais procurado do negócio, com gancho forte e chamada para agendar.",
        formato: "ROTEIRO",
      },
      {
        id: "carrossel",
        rotulo: "Carrossel",
        sai: "Slides prontos para o editor",
        repositorio: "instagram",
        skill: "ig-carousel",
        pedido: "Monte um carrossel de dicas que faça a pessoa salvar e mandar para um amigo, ligado ao que o negócio vende.",
        formato: "CARROSSEL",
      },
      {
        id: "plano",
        rotulo: "Plano da semana",
        sai: "O que postar em cada dia, formato e gancho",
        repositorio: "instagram",
        skill: "ig-plan",
        pedido: "Monte o plano de posts desta semana no Instagram: o que postar em cada dia, em que formato e com qual gancho.",
        formato: "TEXTO",
      },
      {
        id: "perfil",
        rotulo: "Ajuste do perfil",
        sai: "Bio, nome, destaques e link revisados",
        repositorio: "instagram",
        skill: "ig-profile",
        pedido: "Revise o meu perfil do Instagram (nome, bio, destaques e link) e me entregue a versão nova pronta para colar.",
        formato: "TEXTO",
      },
      {
        id: "legenda",
        rotulo: "Legenda",
        sai: "Legenda com gancho, pedido e 3 hashtags",
        repositorio: "instagram",
        skill: "ig-caption",
        pedido: "Escreva a legenda do próximo post do negócio: a primeira linha que segura antes do mais, o corpo, um único pedido e as 3 hashtags.",
        formato: "POST",
        pedeTexto: { rotulo: "Do que é o post? (opcional)", obrigatorio: false },
      },
      {
        id: "stories",
        rotulo: "Stories do dia",
        sai: "Sequência de stories com figurinhas",
        repositorio: "instagram",
        skill: "ig-story",
        pedido: "Escreva os stories de hoje: a sequência quadro a quadro, que figurinha usar em cada um e o story que leva a pessoa para o direct.",
        formato: "ROTEIRO",
      },
      {
        id: "responder",
        rotulo: "Responder comentários",
        sai: "Respostas para os comentários que valem",
        repositorio: "instagram",
        skill: "ig-reply",
        pedido: "Responda os comentários abaixo dos meus posts, na ordem dos que mais valem responder.",
        formato: "TEXTO",
        pedeTexto: { rotulo: "Cole os comentários", obrigatorio: true },
      },
      {
        id: "comentar",
        rotulo: "Comentar em outros perfis",
        sai: "Comentários com opinião, sem cara de robô",
        repositorio: "instagram",
        skill: "ig-comment",
        pedido: "Escreva comentários com opinião para o post abaixo, de alguém do meu nicho ou da cidade.",
        formato: "TEXTO",
        pedeTexto: { rotulo: "Cole o post ou o link", obrigatorio: true },
      },
      {
        id: "direct",
        rotulo: "Mensagens no Direct",
        sai: "Primeira mensagem e 2 follow-ups",
        repositorio: "instagram",
        skill: "ig-dm",
        pedido: "Escreva as mensagens de direct para quem interagiu com o perfil: a primeira, e os 2 follow-ups se não responder.",
        formato: "TEXTO",
        pedeTexto: { rotulo: "Para quem é? (opcional)", obrigatorio: false },
      },
      {
        id: "reaproveitar",
        rotulo: "Reaproveitar conteúdo",
        sai: "Um conteúdo longo vira uma semana de posts",
        repositorio: "instagram",
        skill: "ig-repurpose",
        pedido: "Transforme o conteúdo abaixo numa semana de reels e carrosséis para o Instagram.",
        formato: "TEXTO",
        pedeTexto: { rotulo: "Cole o texto, a transcrição ou o link", obrigatorio: true },
      },
      {
        id: "analise",
        rotulo: "Análise do perfil",
        sai: "O que funcionou, por quê e o que parar",
        repositorio: "instagram",
        skill: "ig-audit",
        pedido: "Analise o que o perfil já postou: o que funcionou, por quê e o que parar de fazer.",
        formato: "TEXTO",
        pedeTexto: { rotulo: "Cole os números dos posts (opcional se o Instagram estiver conectado)", obrigatorio: false },
      },
      {
        id: "sem-cara-de-ia",
        rotulo: "Tirar cara de IA",
        sai: "O texto revisado, sem marcas de IA",
        repositorio: "instagram",
        skill: "ig-human",
        pedido: "Tire as marcas de texto de IA do rascunho abaixo, mantendo o que ele diz, e dê a nota de cada checagem.",
        formato: "TEXTO",
        pedeTexto: { rotulo: "Cole o rascunho", obrigatorio: true },
      },
      {
        id: "viral-geral",
        rotulo: "Viral em todas as redes",
        sai: "O que bomba no nicho em todas as redes",
        repositorio: "master",
        skill: "virality",
        pedido: "Ache o que está viralizando no meu nicho no Instagram, no YouTube e no X e me dê 3 ideias adaptadas ao negócio, com gancho.",
        precisa: "INSTAGRAM",
      },
    ],
  },
  {
    slug: "youtube",
    rede: "YOUTUBE",
    nome: "YouTube",
    repositorio: "youtube",
    acoes: [
      {
        id: "ideias",
        rotulo: "Ideias de vídeo",
        sai: "Os próximos vídeos, em ordem",
        repositorio: "youtube",
        skill: "yt-plan",
        pedido: "Me dê as ideias dos próximos 5 vídeos do canal, na ordem certa, pensando em quem pode virar cliente.",
        formato: "TEXTO",
      },
      {
        id: "titulos",
        rotulo: "Ideias de título",
        sai: "5 títulos, o melhor primeiro",
        repositorio: "youtube",
        skill: "yt-package",
        pedido: "Escreva 5 títulos para o próximo vídeo do canal sobre o serviço mais procurado do negócio.",
        formato: "TITULO",
      },
      {
        id: "thumbnail",
        rotulo: "Ideias de thumbnail",
        sai: "Texto, foto e cores de 3 thumbnails",
        repositorio: "youtube",
        skill: "yt-package",
        pedido: "Crie 3 ideias de thumbnail para o próximo vídeo do canal: texto na imagem, o que aparece na foto e as cores.",
        formato: "THUMBNAIL",
      },
      {
        id: "roteiro",
        rotulo: "Roteiro do vídeo",
        sai: "Vídeo longo pronto para gravar",
        repositorio: "youtube",
        skill: "yt-script",
        pedido: "Escreva o roteiro de um vídeo de 6 a 8 minutos que tire a principal dúvida de quem procura o negócio.",
        formato: "ROTEIRO",
      },
      {
        id: "shorts",
        rotulo: "Shorts",
        sai: "3 Shorts de até 50 s",
        repositorio: "youtube",
        skill: "yt-shorts",
        pedido: "Escreva 3 Shorts originais de até 50 segundos sobre o que o negócio faz, cada um com gancho no primeiro segundo. Sem vídeo longo: crie do zero.",
        formato: "ROTEIRO",
      },
      {
        id: "auditoria",
        rotulo: "Auditoria do canal",
        sai: "O que está travando o canal e o que fazer",
        repositorio: "youtube",
        skill: "yt-audit",
        pedido: "Faça a auditoria do canal: o que está travando o crescimento e as 3 mudanças que dão mais resultado.",
        formato: "TEXTO",
      },
      {
        id: "descricao",
        rotulo: "Descrição e tags",
        sai: "Descrição, tags e texto de busca",
        repositorio: "youtube",
        skill: "yt-seo",
        pedido: "Escreva a descrição, as tags e o texto de busca do próximo vídeo do canal, mirando o que uma pessoa digita.",
        formato: "TEXTO",
        pedeTexto: { rotulo: "Do que é o vídeo? (opcional)", obrigatorio: false },
      },
      {
        id: "capitulos",
        rotulo: "Capítulos do vídeo",
        sai: "Capítulos que o YouTube aceita",
        repositorio: "youtube",
        skill: "yt-chapters",
        pedido: "Escreva os capítulos do vídeo a partir da transcrição abaixo, no formato que o YouTube aceita.",
        formato: "TEXTO",
        pedeTexto: { rotulo: "Cole a transcrição com os tempos", obrigatorio: true },
      },
      {
        id: "comentarios",
        rotulo: "Responder comentários",
        sai: "Respostas para os comentários que valem",
        repositorio: "youtube",
        skill: "yt-comment",
        pedido: "Responda os comentários abaixo do canal, na minha voz, na ordem dos que mais valem.",
        formato: "TEXTO",
        pedeTexto: { rotulo: "Cole os comentários", obrigatorio: true },
      },
      {
        id: "retencao",
        rotulo: "Onde as pessoas saem",
        sai: "Onde o público para de ver e o que mudar",
        repositorio: "youtube",
        skill: "yt-retention",
        pedido: "Leia a retenção do vídeo e diga onde as pessoas saem e o que mudar.",
        formato: "TEXTO",
        pedeTexto: { rotulo: "Cole a retenção do YouTube Studio (opcional se o canal estiver conectado)", obrigatorio: false },
      },
      {
        id: "edicao",
        rotulo: "Lista de cortes",
        sai: "Onde cortar silêncio, ééé e repetição",
        repositorio: "youtube",
        skill: "yt-edit",
        pedido: "Transforme a transcrição abaixo na lista de cortes: silêncios, vícios de fala e repetições, com os tempos.",
        formato: "TEXTO",
        pedeTexto: { rotulo: "Cole a transcrição com os tempos", obrigatorio: true },
      },
      {
        id: "edicao-curta",
        rotulo: "Edição de vídeo curto",
        sai: "Plano de edição com legenda e ritmo",
        repositorio: "master",
        skill: "edit",
        pedido: "Monte o plano de edição do vídeo curto abaixo (Reels, Shorts e TikTok): cortes, legendas no tempo da fala, visuais e áudio.",
        formato: "ROTEIRO",
        pedeTexto: { rotulo: "Cole a transcrição ou descreva o vídeo", obrigatorio: true },
      },
      {
        id: "viral",
        rotulo: "Viral do nicho",
        sai: "Os vídeos que mais passaram do normal no nicho",
        repositorio: "youtube",
        skill: "yt-viral",
        pedido: "Ache o que está funcionando no meu nicho no YouTube agora e me dê 3 ideias de vídeo adaptadas ao negócio.",
        precisa: "YOUTUBE",
      },
    ],
  },
  {
    slug: "x",
    rede: "X",
    nome: "X",
    repositorio: "x",
    acoes: [
      {
        id: "thread",
        rotulo: "Sequência de posts",
        sai: "Thread pronta, post a post",
        repositorio: "x",
        skill: "x-thread",
        pedido: "Escreva uma thread que ensine algo útil ligado ao negócio e termine chamando para conhecer o serviço.",
        formato: "THREAD",
      },
      {
        id: "posts",
        rotulo: "Posts",
        sai: "Posts curtos prontos para publicar",
        repositorio: "x",
        skill: "x-post",
        pedido: "Escreva 3 posts curtos para o X sobre o dia a dia do negócio, um com opinião forte.",
        formato: "THREAD",
      },
      {
        id: "viral",
        rotulo: "Viral do nicho",
        sai: "O que viralizou na semana e como usar",
        repositorio: "x",
        skill: "x-viral",
        pedido: "Ache o que viralizou no meu nicho no X esta semana e me dê 3 posts no meu jeito a partir disso.",
        precisa: "X",
      },
      {
        id: "perfil",
        rotulo: "Ajuste do perfil",
        sai: "Bio e post fixado revisados",
        repositorio: "x",
        skill: "x-profile",
        pedido: "Revise o meu perfil no X (nome, bio e post fixado) e me entregue a versão nova pronta para colar.",
        formato: "TEXTO",
      },
      {
        id: "plano",
        rotulo: "Plano da semana",
        sai: "O que postar, quando e com quem interagir",
        repositorio: "x",
        skill: "x-plan",
        pedido: "Monte a minha semana no X: o que postar em cada dia, a que horas e com quem interagir.",
        formato: "TEXTO",
      },
      {
        id: "responder",
        rotulo: "Responder respostas",
        sai: "Respostas na ordem que importa",
        repositorio: "x",
        skill: "x-reply",
        pedido: "Responda as respostas abaixo dos meus posts no X, na ordem que importa.",
        formato: "TEXTO",
        pedeTexto: { rotulo: "Cole as respostas", obrigatorio: true },
      },
      {
        id: "comentar",
        rotulo: "Comentar em outros perfis",
        sai: "Respostas que acrescentam, sem cara de robô",
        repositorio: "x",
        skill: "x-comment",
        pedido: "Escreva respostas que acrescentam para o post abaixo.",
        formato: "TEXTO",
        pedeTexto: { rotulo: "Cole o post", obrigatorio: true },
      },
      {
        id: "dm",
        rotulo: "Mensagens diretas",
        sai: "Primeira mensagem e 2 follow-ups",
        repositorio: "x",
        skill: "x-dm",
        pedido: "Escreva a DM para a pessoa abaixo: a primeira mensagem e 2 follow-ups.",
        formato: "TEXTO",
        pedeTexto: { rotulo: "Para quem é? (opcional)", obrigatorio: false },
      },
      {
        id: "reaproveitar",
        rotulo: "Reaproveitar conteúdo",
        sai: "Um conteúdo longo vira uma semana no X",
        repositorio: "x",
        skill: "x-repurpose",
        pedido: "Transforme o conteúdo abaixo numa semana de posts no X e uma thread.",
        formato: "THREAD",
        pedeTexto: { rotulo: "Cole o texto, a transcrição ou o link", obrigatorio: true },
      },
      {
        id: "analise",
        rotulo: "Análise do perfil",
        sai: "O que funcionou no X e o que parar",
        repositorio: "x",
        skill: "x-audit",
        pedido: "Analise o que já publiquei no X: o que funcionou, por quê e o que parar.",
        formato: "TEXTO",
        pedeTexto: { rotulo: "Cole os números dos posts (opcional)", obrigatorio: false },
      },
      {
        id: "sem-cara-de-ia",
        rotulo: "Tirar cara de IA",
        sai: "O texto revisado, sem marcas de IA",
        repositorio: "x",
        skill: "x-human",
        pedido: "Tire as marcas de texto de IA do rascunho abaixo, mantendo o que ele diz.",
        formato: "TEXTO",
        pedeTexto: { rotulo: "Cole o rascunho", obrigatorio: true },
      },
    ],
  },
  {
    slug: "linkedin",
    rede: "LINKEDIN",
    nome: "LinkedIn",
    repositorio: "linkedin",
    acoes: [
      {
        id: "posts",
        rotulo: "Posts",
        sai: "Post pronto para colar",
        repositorio: "linkedin",
        skill: "li-post",
        pedido: "Escreva um post para o LinkedIn com uma história real do negócio e uma lição prática no fim.",
        formato: "POST",
      },
      {
        id: "carrossel",
        rotulo: "Carrossel em PDF",
        sai: "Slides para o editor, sai em PDF",
        repositorio: "linkedin",
        skill: "li-carousel",
        pedido: "Monte um carrossel (documento em PDF) para o LinkedIn com um passo a passo útil ligado ao negócio.",
        formato: "CARROSSEL",
      },
      {
        id: "perfil",
        rotulo: "Ajuste do perfil",
        sai: "Título, sobre e destaque revisados",
        repositorio: "linkedin",
        skill: "li-profile",
        pedido: "Revise o meu perfil do LinkedIn (título, sobre e destaque) e me entregue a versão nova pronta para colar.",
        formato: "TEXTO",
      },
      {
        id: "plano",
        rotulo: "Plano da semana",
        sai: "O que postar, quando e com quem interagir",
        repositorio: "linkedin",
        skill: "li-plan",
        pedido: "Monte a minha semana no LinkedIn: o que postar em cada dia, a que horas e com quem interagir.",
        formato: "TEXTO",
      },
      {
        id: "responder",
        rotulo: "Responder comentários",
        sai: "Respostas para cada comentário",
        repositorio: "linkedin",
        skill: "li-reply",
        pedido: "Responda os comentários abaixo dos meus posts no LinkedIn, na ordem dos que mais valem.",
        formato: "TEXTO",
        pedeTexto: { rotulo: "Cole os comentários", obrigatorio: true },
      },
      {
        id: "comentar",
        rotulo: "Comentar em outros perfis",
        sai: "Comentários com opinião",
        repositorio: "linkedin",
        skill: "li-comment",
        pedido: "Escreva um comentário com opinião para o post abaixo.",
        formato: "TEXTO",
        pedeTexto: { rotulo: "Cole o post", obrigatorio: true },
      },
      {
        id: "convite",
        rotulo: "Convite e DM",
        sai: "Convite de 200 caracteres e as mensagens",
        repositorio: "linkedin",
        skill: "li-dm",
        pedido: "Escreva o convite de conexão (até 200 caracteres), a primeira mensagem e 2 follow-ups para a pessoa abaixo.",
        formato: "TEXTO",
        pedeTexto: { rotulo: "Para quem é? (opcional)", obrigatorio: false },
      },
      {
        id: "caixa",
        rotulo: "Caixa de entrada",
        sai: "Mensagens separadas e as respostas",
        repositorio: "linkedin",
        skill: "li-inbox",
        pedido: "Separe as mensagens abaixo em clientes, parceiros, recrutadores e spam e escreva as respostas que valem.",
        formato: "TEXTO",
        pedeTexto: { rotulo: "Cole as mensagens", obrigatorio: true },
      },
      {
        id: "reaproveitar",
        rotulo: "Reaproveitar conteúdo",
        sai: "Um conteúdo longo vira uma semana de posts",
        repositorio: "linkedin",
        skill: "li-repurpose",
        pedido: "Transforme o conteúdo abaixo numa semana de posts no LinkedIn.",
        formato: "POST",
        pedeTexto: { rotulo: "Cole o texto, a transcrição ou o link", obrigatorio: true },
      },
      {
        id: "analise",
        rotulo: "Análise do perfil",
        sai: "O que funcionou e o que parar",
        repositorio: "linkedin",
        skill: "li-audit",
        pedido: "Analise o que já publiquei no LinkedIn: o que funcionou, por quê e o que parar.",
        formato: "TEXTO",
        pedeTexto: { rotulo: "Cole os números dos posts (opcional)", obrigatorio: false },
      },
      {
        id: "sem-cara-de-ia",
        rotulo: "Tirar cara de IA",
        sai: "O texto revisado, sem marcas de IA",
        repositorio: "linkedin",
        skill: "li-human",
        pedido: "Tire as marcas de texto de IA do rascunho abaixo, mantendo o que ele diz.",
        formato: "TEXTO",
        pedeTexto: { rotulo: "Cole o rascunho", obrigatorio: true },
      },
    ],
  },
  {
    slug: "tiktok",
    rede: "TIKTOK",
    nome: "TikTok",
    repositorio: "tiktok",
    acoes: [
      {
        id: "ideias",
        rotulo: "Ideias de vídeo",
        sai: "5 ideias de vídeo com formato e gancho",
        repositorio: "tiktok",
        skill: "tt-ideias",
        pedido: "Me dê 5 ideias de vídeo para o TikTok do negócio, cada uma com o formato, o gancho do primeiro segundo e as buscas que acham o vídeo.",
        formato: "TEXTO",
      },
      {
        id: "ganchos",
        rotulo: "Primeiras frases do vídeo",
        sai: "10 começos de vídeo com nota, o melhor primeiro",
        repositorio: "tiktok",
        skill: "tt-ganchos",
        pedido: "Escreva 10 ganchos para o próximo vídeo do TikTok sobre o serviço mais procurado do negócio: fala, texto na tela e nota de cada um.",
        formato: "TITULO",
        pedeTexto: { rotulo: "Do que é o vídeo? (opcional)", obrigatorio: false },
      },
      {
        id: "roteiros",
        rotulo: "Roteiro do vídeo",
        sai: "Vídeo de 20 a 40 s com tempos, fala e texto na tela",
        repositorio: "tiktok",
        skill: "tt-roteiro",
        pedido: "Escreva um roteiro de TikTok de 20 a 40 segundos sobre o serviço mais procurado do negócio, com gancho no primeiro segundo, cortes rápidos e um só pedido no fim.",
        formato: "ROTEIRO",
        pedeTexto: { rotulo: "Ideia do vídeo (opcional)", obrigatorio: false },
      },
      {
        id: "fotos",
        rotulo: "Carrossel de fotos",
        sai: "Post de fotos com o texto de cada quadro",
        repositorio: "tiktok",
        skill: "tt-fotos",
        pedido: "Monte um carrossel de fotos para o TikTok (modo foto) com dicas ligadas ao serviço do negócio, do quadro de capa ao pedido do fim.",
        formato: "CARROSSEL",
      },
      {
        id: "legenda",
        rotulo: "Legenda e hashtags",
        sai: "Legenda para a busca do TikTok e 3 a 5 hashtags",
        repositorio: "tiktok",
        skill: "tt-legenda",
        pedido: "Escreva a legenda e as hashtags do próximo vídeo do TikTok do negócio, pensando no que as pessoas da cidade buscam.",
        formato: "POST",
        pedeTexto: { rotulo: "Do que é o vídeo? (opcional)", obrigatorio: false },
      },
      {
        id: "edicao-curta",
        rotulo: "Edição do vídeo",
        sai: "Plano de edição com legenda e ritmo",
        repositorio: "master",
        skill: "edit",
        pedido: "Monte o plano de edição do vídeo do TikTok abaixo: cortes, legendas no tempo da fala, visuais e áudio.",
        formato: "ROTEIRO",
        pedeTexto: { rotulo: "Cole a transcrição ou descreva o vídeo", obrigatorio: true },
      },
    ],
  },
];

export function areaPorSlug(slug: string): AreaRede | null {
  return AREAS_REDES.find((a) => a.slug === slug) ?? null;
}

export function acaoDaArea(area: AreaRede, id: string): AcaoRede | null {
  return area.acoes.find((a) => a.id === id) ?? null;
}
