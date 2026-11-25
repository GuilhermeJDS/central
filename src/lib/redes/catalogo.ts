/**
 * Catálogo das redes que o cliente conecta colando o token. Sem segredo
 * nenhum: pode ir para a tela (nomes, campos e links da documentação oficial).
 */
export const REDES_CONECTAVEIS = ["INSTAGRAM", "YOUTUBE", "LINKEDIN", "X", "GOOGLE_EMPRESA"] as const;

export type RedeConectavel = (typeof REDES_CONECTAVEIS)[number];

export function ehRedeConectavel(v: unknown): v is RedeConectavel {
  return typeof v === "string" && (REDES_CONECTAVEIS as readonly string[]).includes(v);
}

export type CampoExtra = {
  nome: "oauth" | "canal" | "usuario" | "clientId" | "clientSecret" | "appId" | "appSecret";
  rotulo: string;
  ajuda: string;
  secreto: boolean;
  obrigatorio: boolean;
};

/** Um passo do guia "Como pegar o token". `midia`: print (.webp/.png) ou vídeo (.mp4/.webm) em /public. */
export type PassoGuia = {
  titulo: string;
  texto: string;
  link?: { rotulo: string; url: string };
  midia?: string;
  /** O que o print mostra, embaixo dele. */
  legenda?: string;
};

export type InfoRede = {
  nome: string;
  /** O que os chefes fazem com a conta conectada. */
  paraQue: string;
  rotuloToken: string;
  dicaToken: string;
  /** Documentação oficial de como gerar o token. */
  comoPegar: string;
  extras: CampoExtra[];
  /** Guia passo a passo na própria Central. */
  guia: PassoGuia[];
  /** Quanto o token dura e como ele é renovado. */
  renovacao: string;
};

const PLAYGROUND = "https://developers.google.com/oauthplayground";

const APP_GOOGLE: CampoExtra[] = [
  {
    nome: "clientId",
    rotulo: "Client ID (para renovar sozinho)",
    ajuda: "Do seu app OAuth no Google Cloud. Termina com .apps.googleusercontent.com.",
    secreto: false,
    obrigatorio: false,
  },
  {
    nome: "clientSecret",
    rotulo: "Client secret",
    ajuda: "Do mesmo app. Fica guardado cifrado; nunca volta para a tela.",
    secreto: true,
    obrigatorio: false,
  },
];

export const CATALOGO_REDES: Record<RedeConectavel, InfoRede> = {
  INSTAGRAM: {
    nome: "Instagram",
    paraQue: "Perfil, últimas publicações com métricas, números da conta e o que bomba nas hashtags do nicho.",
    rotuloToken: "Token de acesso da Meta (EAA…)",
    dicaToken: "Gerado no seu app da Meta (login do Instagram, sem Página do Facebook). Começa com EAA. Também aceita o token do Instagram (IG…).",
    comoPegar: "https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/get-started",
    extras: [
      {
        nome: "appId",
        rotulo: "ID do app (para renovar sozinho)",
        ajuda: "Em Configurações do app → Básico, no Meta for Developers.",
        secreto: false,
        obrigatorio: false,
      },
      {
        nome: "appSecret",
        rotulo: "Chave secreta do app",
        ajuda: "Na mesma tela (Mostrar). Fica guardada cifrada.",
        secreto: true,
        obrigatorio: false,
      },
    ],
    guia: [
      {
        titulo: "Deixe o Instagram profissional",
        texto: "No app do Instagram: Configurações → Tipo de conta e ferramentas → Mudar para conta profissional. Não precisa de Página do Facebook.",
        link: { rotulo: "Como mudar para profissional", url: "https://help.instagram.com/502981923235522" },
        midia: "/central/guias/instagram/passo-1.webp",
        legenda: "Central de Ajuda do Instagram: como configurar a conta profissional.",
      },
      {
        titulo: "Crie um app na Meta for Developers",
        texto: "Entre com o seu Facebook (na primeira vez a Meta pede para registrar como desenvolvedor e confirmar por SMS). Criar app → nome e e-mail de contato → Avançar.",
        link: { rotulo: "Criar app", url: "https://developers.facebook.com/apps/creation/" },
        midia: "/central/guias/instagram/passo-2.webp",
        legenda: "Detalhes do app: nome e e-mail de contato (aqui borrados).",
      },
      {
        titulo: "Escolha o caso de uso do Instagram",
        texto: "Em Casos de uso, filtre por Tudo e marque Gerenciar mensagens e conteúdo no Instagram. Em Empresa, escolha Ainda não quero me conectar. Avance e clique em Criar app (a Meta pede a sua senha do Facebook).",
        midia: "/central/guias/instagram/passo-3.webp",
        legenda: "Caso de uso marcado: Gerenciar mensagens e conteúdo no Instagram.",
      },
      {
        titulo: "Conecte um portfólio empresarial",
        texto: "No app: Casos de uso → Personalizar → API setup with Unified login → Portfólio empresarial → Criar nova conta. Preencha o nome da empresa, o seu nome e o e-mail comercial e clique em Criar portfólio.",
        midia: "/central/guias/instagram/passo-4.webp",
        legenda: "Criar um portfólio empresarial: nome da empresa, seu nome e e-mail (aqui borrados).",
      },
      {
        titulo: "Crie a configuração de login",
        texto: "Ainda em API setup with Unified login, clique em Criar nova configuração e depois em Criar do modelo. Ela já vem com o token de usuário do sistema, que nunca expira.",
        midia: "/central/guias/instagram/passo-5.webp",
        legenda: "Confirmar detalhes: token de usuário do sistema e \"O token nunca expira\".",
      },
      {
        titulo: "Coloque o Instagram como testador",
        texto: "Funções do app → Funções → Adicionar pessoas → Testador do Instagram. Digite o @ da conta profissional, escolha na lista e clique em Adicionar.",
        midia: "/central/guias/instagram/passo-6.webp",
        legenda: "Adicionar pessoas: Testador do Instagram e o @ da conta (aqui borrado).",
      },
      {
        titulo: "Aceite o convite no Instagram",
        texto: "No Instagram da empresa: Configurações → Apps e sites → Convites do testador → Aceitar.",
        link: { rotulo: "Abrir Apps e sites", url: "https://www.instagram.com/accounts/manage_access/" },
        midia: "/central/guias/instagram/passo-7.webp",
        legenda: "Convite aceito: o app aparece como autorizado.",
      },
      {
        titulo: "Clique em Gerar token",
        texto: "Volte em API setup with Unified login → 2. Gerar tokens de acesso. A sua conta aparece na lista: clique em Gerar token.",
        midia: "/central/guias/instagram/passo-8.webp",
        legenda: "Gerar tokens de acesso: a conta do Instagram e o link Gerar token.",
      },
      {
        titulo: "Entre com o Instagram",
        texto: "Na janela da Meta, clique em Continuar com o Instagram e em Entrar com a conta da empresa.",
        midia: "/central/guias/instagram/passo-9.webp",
        legenda: "Entrar nas ferramentas comerciais da Meta: Continuar com o Instagram.",
      },
      {
        titulo: "Confirme o portfólio e a conta",
        texto: "Deixe marcados o seu portfólio e a conta do Instagram (contas de anúncio são opcionais) e clique em Continue até a janela fechar.",
        midia: "/central/guias/instagram/passo-10.webp",
        legenda: "Ativos compartilhados com o app: portfólio e conta do Instagram (aqui borrados).",
      },
      {
        titulo: "Copie o token",
        texto: "Clique em Gerar token de novo se a caixa não abrir. Marque Estou ciente e clique em Copiar: ele só aparece uma vez. Começa com EAA.",
        midia: "/central/guias/instagram/passo-11.webp",
        legenda: "Token gerado (mascarado): marque Estou ciente e copie.",
      },
      {
        titulo: "Cole aqui e teste",
        texto: "Cole o token no campo ao lado e clique em Testar. Funcionou? Salve.",
      },
    ],
    renovacao: "Esse token é de usuário do sistema e não vence. Só para de funcionar se você remover o app em Apps e sites do Instagram ou apagar a configuração no app.",
  },
  YOUTUBE: {
    nome: "YouTube",
    paraQue: "Canal, vídeos com estatísticas, os vídeos que mais cresceram no nicho e, com o token OAuth, a retenção.",
    rotuloToken: "API key do YouTube",
    dicaToken: "Chave da YouTube Data API v3 (começa com AIza).",
    comoPegar: "https://developers.google.com/youtube/v3/getting-started",
    extras: [
      {
        nome: "canal",
        rotulo: "Canal (@ ou link)",
        ajuda: "Obrigatório sem o token OAuth.",
        secreto: false,
        obrigatorio: false,
      },
      {
        nome: "oauth",
        rotulo: "Token OAuth (opcional, para a retenção)",
        ajuda: "O de renovação (1//…) não vence: com o Client ID e o secret, renova sozinho. O de acesso (ya29.) dura 1 hora.",
        secreto: true,
        obrigatorio: false,
      },
      ...APP_GOOGLE,
    ],
    guia: [
      {
        titulo: "Crie um projeto no Google Cloud",
        texto: "Entre com a conta Google do canal e crie um projeto (ex.: Central).",
        link: { rotulo: "Criar projeto", url: "https://console.cloud.google.com/projectcreate" },
        midia: "/central/guias/youtube/passo-1.webp",
        legenda: "Novo projeto: dê um nome e clique em Criar.",
      },
      {
        titulo: "Ative a YouTube Data API v3",
        texto: "Com o projeto escolhido no topo, clique em Ativar.",
        link: { rotulo: "Ativar a API", url: "https://console.cloud.google.com/apis/library/youtube.googleapis.com" },
        midia: "/central/guias/youtube/passo-2.webp",
        legenda: "Com o projeto no topo, o botão Ativar da YouTube Data API v3.",
      },
      {
        titulo: "Crie a chave de API",
        texto: "Credenciais → Criar credenciais → Chave de API. Em Restringir chave, deixe só a YouTube Data API v3. Copie (começa com AIza).",
        link: { rotulo: "Abrir Credenciais", url: "https://console.cloud.google.com/apis/credentials" },
        midia: "/central/guias/youtube/passo-3.webp",
        legenda: "Credenciais → Criar credenciais → Chave de API.",
      },
      {
        titulo: "Cole a chave e o @ do canal e teste",
        texto: "Só com isso os chefes já leem o canal e os vídeos. Os passos abaixo são para a retenção (opcional).",
      },
      {
        titulo: "Retenção: ative a YouTube Analytics API",
        texto: "No mesmo projeto, abra a YouTube Analytics API e clique em Ativar.",
        link: { rotulo: "Ativar a Analytics API", url: "https://console.cloud.google.com/apis/library/youtubeanalytics.googleapis.com" },
        midia: "/central/guias/youtube/passo-5.webp",
        legenda: "YouTube Analytics API ativada no mesmo projeto.",
      },
      {
        titulo: "Retenção: Configure a tela de permissão",
        texto: "Google Auth Platform → Começar: nome do app, e-mail de suporte, público Externo e e-mail de contato. Marque que concorda com a política de dados do usuário e clique em Criar.",
        link: { rotulo: "Abrir a tela de permissão", url: "https://console.cloud.google.com/auth/overview/create" },
        midia: "/central/guias/youtube/passo-6.webp",
        legenda: "Último passo da configuração: o aceite da política e o botão Criar.",
      },
      {
        titulo: "Retenção: Adicione você como usuário de teste",
        texto: "Enquanto o app estiver em Testando, só os usuários de teste autorizam. Em Público-alvo → Usuários de teste → Add users, coloque o e-mail da conta Google do canal e salve.",
        link: { rotulo: "Abrir Público-alvo", url: "https://console.cloud.google.com/auth/audience" },
        midia: "/central/guias/youtube/passo-7.webp",
        legenda: "Adicionar usuários: o seu e-mail (aqui borrado) e Salvar.",
      },
      {
        titulo: "Retenção: crie o app OAuth",
        texto: "Clientes → Criar cliente → Aplicativo da Web. Em URIs de redirecionamento autorizados, adicione https://developers.google.com/oauthplayground e clique em Criar. Copie o Client ID e a chave secreta: a chave só aparece nessa hora.",
        link: { rotulo: "Criar o cliente OAuth", url: "https://console.cloud.google.com/auth/clients/create" },
        midia: "/central/guias/youtube/passo-8.webp",
        legenda: "Aplicativo da Web com o URI do OAuth Playground em redirecionamento.",
      },
      {
        titulo: "Retenção: gere o token de renovação no OAuth Playground",
        texto: "Na engrenagem, marque Use your own OAuth credentials e cole o Client ID e o secret. Autorize o escopo https://www.googleapis.com/auth/yt-analytics.readonly e clique em Exchange. Copie o Refresh token (começa com 1//).",
        link: { rotulo: "Abrir o OAuth Playground", url: PLAYGROUND },
        midia: "/central/guias/youtube/passo-9.webp",
        legenda: "Engrenagem aberta: Use your own OAuth credentials marcado e o escopo yt-analytics.readonly no campo.",
      },
    ],
    renovacao: "A chave de API não vence. O token de renovação (1//…) também não: a Central pede um token de acesso novo a cada uso, com o seu Client ID e secret.",
  },
  LINKEDIN: {
    nome: "LinkedIn",
    paraQue: "Perfil ou página e as publicações que a API do LinkedIn liberar para o token.",
    rotuloToken: "Token de acesso do LinkedIn",
    dicaToken: "Gerado no Token Generator do LinkedIn Developers (vale 60 dias).",
    comoPegar: "https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow",
    extras: [],
    guia: [
      {
        titulo: "Crie um app no LinkedIn Developers",
        texto: "Precisa de uma Página da empresa no LinkedIn (você como administrador). Preencha o nome do app, escolha a sua Página, o link da política de privacidade e o logo, marque os termos e clique em Create app.",
        link: { rotulo: "Criar app", url: "https://www.linkedin.com/developers/apps/new" },
        midia: "/central/guias/linkedin/passo-1.webp",
        legenda: "Create an app: nome, Página da empresa e política de privacidade (aqui borrados).",
      },
      {
        titulo: "Adicione os produtos do app",
        texto: "Na aba Products, clique em Request access em Sign In with LinkedIn using OpenID Connect (perfil), marque os termos e confirme. Para ler a página e os posts, peça também Community Management API.",
        link: { rotulo: "Abrir meus apps", url: "https://www.linkedin.com/developers/apps" },
        midia: "/central/guias/linkedin/passo-2.webp",
        legenda: "Request access do OpenID Connect: marque os termos e confirme.",
      },
      {
        titulo: "Escolha o app e os escopos no Token Generator",
        texto: "Select app → o seu app. Deixe Member authorization code (3-legged), marque openid, profile e email (e r_organization_social, se liberado), confirme a mudança no redirecionamento e clique em Request access token.",
        link: { rotulo: "Abrir o Token Generator", url: "https://www.linkedin.com/developers/tools/oauth/token-generator" },
        midia: "/central/guias/linkedin/passo-3.webp",
        legenda: "App escolhido e os escopos openid, profile e email marcados.",
      },
      {
        titulo: "Autorize e copie o token",
        texto: "Na janela do LinkedIn, clique em Allow. O token aparece na mesma tela: clique em Copy access token. Ele vale 2 meses.",
        midia: "/central/guias/linkedin/passo-4.webp",
        legenda: "Token gerado (aqui borrado), com validade de 2 meses e as permissões.",
      },
      {
        titulo: "Cole aqui e teste",
        texto: "Cole o token ao lado e clique em Testar. Funcionou? Salve.",
      },
    ],
    renovacao: "Vale 60 dias. O LinkedIn só deixa renovar sozinho para apps parceiros: quando vencer, a Central avisa aqui e você gera outro no Token Generator (2 minutos).",
  },
  X: {
    nome: "X",
    paraQue: "Perfil, posts com métricas e a busca recente do nicho (o que viralizou na semana).",
    rotuloToken: "Bearer token do X",
    dicaToken: "Do seu app no portal de desenvolvedores do X. A conta de desenvolvedor precisa ter crédito.",
    comoPegar: "https://docs.x.com/fundamentals/authentication/oauth-2-0/bearer-tokens",
    extras: [
      {
        nome: "usuario",
        rotulo: "@ do perfil",
        ajuda: "Obrigatório com bearer de app (sem login de usuário).",
        secreto: false,
        obrigatorio: false,
      },
    ],
    guia: [
      {
        titulo: "Entre no Developer Console do X",
        texto: "Entre com a conta do X e aceite os termos. O painel mostra o saldo e os seus apps.",
        link: { rotulo: "Abrir o Developer Console", url: "https://console.x.com/" },
        midia: "/central/guias/x/passo-1.webp",
        legenda: "Dashboard: o saldo (Total Balance) e os apps da conta.",
      },
      {
        titulo: "Coloque crédito na conta de desenvolvedor",
        texto: "Desde fevereiro de 2026 a API do X não tem plano grátis: cada leitura gasta crédito (cerca de US$ 0,01 por perfil e US$ 0,005 por post). Sem saldo, o teste falha. Em Billing → Credits, clique em Purchase credits: o X costuma dobrar a primeira compra até US$ 20, o que dá para meses de leitura de um perfil.",
        link: { rotulo: "Abrir o Developer Console", url: "https://console.x.com/" },
        midia: "/central/guias/x/passo-2.webp",
        legenda: "Billing → Credits: o saldo e o botão Purchase credits.",
      },
      {
        titulo: "Crie o app",
        texto: "No menu, Apps → Create App. Ele entra no projeto padrão (Pay Per Use).",
        link: { rotulo: "Abrir o Developer Console", url: "https://console.x.com/" },
        midia: "/central/guias/x/passo-3.webp",
        legenda: "Apps: o botão Create App e os apps que você já tem.",
      },
      {
        titulo: "Gere o Bearer Token",
        texto: "Abra o app, aba Keys & Tokens → Bearer Token → Generate (ou Regenerate). Copie na hora: ele só aparece uma vez.",
        midia: "/central/guias/x/passo-4.webp",
        legenda: "Bearer Token gerado (aqui borrado): copie antes de fechar a janela.",
      },
      {
        titulo: "Cole o token e o @ e teste",
        texto: "Cole o bearer e o @ do perfil ao lado e clique em Testar. Funcionou? Salve.",
      },
    ],
    renovacao: "O bearer de app não vence. Só muda se você gerar outro no portal: aí cole o novo aqui. O que acaba é o crédito: sem saldo, o X recusa a leitura e o bloco avisa.",
  },
  GOOGLE_EMPRESA: {
    nome: "Google Empresa",
    paraQue: "Perfil da empresa no Google e as avaliações dos clientes.",
    rotuloToken: "Token de renovação do Google (1//…)",
    dicaToken: "Do OAuth Playground com o escopo business.manage. Também aceita o de acesso (ya29.), que dura 1 hora.",
    comoPegar: "https://developers.google.com/my-business/content/basic-setup",
    extras: APP_GOOGLE,
    guia: [
      {
        titulo: "Peça acesso às APIs do Perfil da Empresa",
        texto: "A Google libera essas APIs por pedido. Preencha o formulário com o número do projeto do Google Cloud e espere o e-mail de aprovação.",
        link: { rotulo: "Pedir acesso", url: "https://developers.google.com/my-business/content/prereqs#request-access" },
        midia: "/central/guias/google-empresa/passo-1.webp",
        legenda: "Pré-requisitos: o formulário de contato das APIs do GBP → Pedido de acesso básico às APIs.",
      },
      {
        titulo: "Ative as duas APIs no projeto",
        texto: "My Business Account Management API e My Business Business Information API.",
        link: { rotulo: "Ativar Account Management", url: "https://console.cloud.google.com/apis/library/mybusinessaccountmanagement.googleapis.com" },
        midia: "/central/guias/google-empresa/passo-2.webp",
        legenda: "My Business Account Management API: clique em Ativar.",
      },
      {
        titulo: "Ative a de informações da empresa",
        texto: "Mesmo projeto, clique em Ativar.",
        link: { rotulo: "Ativar Business Information", url: "https://console.cloud.google.com/apis/library/mybusinessbusinessinformation.googleapis.com" },
        midia: "/central/guias/google-empresa/passo-3.webp",
        legenda: "My Business Business Information API: clique em Ativar.",
      },
      {
        titulo: "Configure a tela de permissão",
        texto: "Google Auth Platform → Começar: nome do app, e-mail de suporte, público Externo e e-mail de contato. Marque que concorda com a política de dados do usuário e clique em Criar.",
        link: { rotulo: "Abrir a tela de permissão", url: "https://console.cloud.google.com/auth/overview/create" },
        midia: "/central/guias/google-empresa/passo-4.webp",
        legenda: "Último passo da configuração: o aceite da política e o botão Criar.",
      },
      {
        titulo: "Adicione você como usuário de teste",
        texto: "Enquanto o app estiver em Testando, só os usuários de teste autorizam. Em Público-alvo → Usuários de teste → Add users, coloque o e-mail da conta Google dona da empresa e salve.",
        link: { rotulo: "Abrir Público-alvo", url: "https://console.cloud.google.com/auth/audience" },
        midia: "/central/guias/google-empresa/passo-5.webp",
        legenda: "Adicionar usuários: o seu e-mail (aqui borrado) e Salvar.",
      },
      {
        titulo: "Crie o app OAuth",
        texto: "Clientes → Criar cliente → Aplicativo da Web, com o URI de redirecionamento https://developers.google.com/oauthplayground. Copie o Client ID e a chave secreta na hora: a chave só aparece nessa janela.",
        link: { rotulo: "Criar o cliente OAuth", url: "https://console.cloud.google.com/auth/clients/create" },
        midia: "/central/guias/google-empresa/passo-6.webp",
        legenda: "Cliente OAuth criado: o ID e a chave secreta (aqui borrados).",
      },
      {
        titulo: "Gere o token de renovação no OAuth Playground",
        texto: "Na engrenagem, marque Use your own OAuth credentials e cole o Client ID e o secret. Autorize https://www.googleapis.com/auth/business.manage com a conta dona da empresa e clique em Exchange. Copie o Refresh token (1//…).",
        link: { rotulo: "Abrir o OAuth Playground", url: PLAYGROUND },
        midia: "/central/guias/google-empresa/passo-7.webp",
        legenda: "Engrenagem aberta: Use your own OAuth credentials marcado e o escopo business.manage no campo.",
      },
      {
        titulo: "Cole os três e teste",
        texto: "Token de renovação, Client ID e Client secret ao lado. Clique em Testar. Funcionou? Salve.",
      },
    ],
    renovacao: "O token de renovação não vence: a Central troca por um de acesso novo a cada uso, com o seu Client ID e secret. Só cai se você revogar o acesso na conta Google.",
  },
};
