/**
 * Catálogo de integrações: cada provedor, os campos que ele pede e onde achar
 * cada chave. As telas de instalação e de Conexões (parte do sistema) são montadas daqui; para
 * ligar um provedor novo, basta descrevê-lo aqui e escrever o cliente dele.
 */

export type Campo = {
  id: string;
  rotulo: string;
  /** Guardado cifrado; a tela só mostra os 4 últimos caracteres. */
  secreto?: boolean;
  tipo?: "texto" | "url" | "email" | "booleano" | "lista";
  dica?: string;
  exemplo?: string;
  opcional?: boolean;
};

export type Provedor = {
  id: string;
  nome: string;
  resumo: string;
  /** Onde pegar as chaves. */
  ondePegar?: { texto: string; link: string };
  campos: Campo[];
  /** Precisa rodar um serviço junto (pasta servicos/). */
  servico?: string;
};

export type Grupo = {
  id: GrupoId;
  nome: string;
  pergunta: string;
  /** Um provedor ativo por vez (checkout, WhatsApp) ou um bloco só. */
  multiplo: boolean;
  provedores: Provedor[];
};

export type GrupoId = "rastro" | "buffer" | "email";

export const GRUPOS: Grupo[] = [
  {
    id: "rastro",
    nome: "Rastro",
    pergunta: "Onde roda o Rastro, que acha o seu negócio no Google Maps?",
    multiplo: false,
    provedores: [
      {
        id: "rastro",
        nome: "Rastro",
        resumo: "Acha o seu negócio e os concorrentes no Google Maps com um Chromium de verdade. Roda no seu computador ou na VPS (servicos/rastro).",
        servico: "servicos/rastro",
        campos: [
          { id: "url", rotulo: "Endereço do Rastro", tipo: "url", exemplo: "http://127.0.0.1:4310" },
          { id: "token", rotulo: "Token do Rastro", secreto: true, dica: "O mesmo RASTRO_TOKEN do servicos/rastro/.env." },
          { id: "googlePlaces", rotulo: "Chave da Google Places API (reserva)", secreto: true, opcional: true, dica: "Se o Rastro estiver fora do ar, a busca usa a API oficial do Google. Tem cota grátis por mês." },
        ],
      },
    ],
  },
  {
    id: "buffer",
    nome: "Buffer",
    pergunta: "Quer que as peças aprovadas saiam sozinhas pelo Buffer?",
    multiplo: false,
    provedores: [
      {
        id: "buffer",
        nome: "Buffer",
        resumo: "Peça aprovada e com data no Cronograma vai para a fila do Buffer e sai no horário, no Instagram, TikTok, YouTube, LinkedIn, X e Perfil da Empresa no Google.",
        ondePegar: { texto: "Buffer → Settings → API", link: "https://publish.buffer.com/settings/api" },
        campos: [
          { id: "apiKey", rotulo: "Chave da API do Buffer", secreto: true, dica: "O plano grátis do Buffer já dá uma chave." },
          { id: "lembrete", rotulo: "Mandar como lembrete no celular (não publica sozinho)", tipo: "booleano", opcional: true, dica: "Para perfil pessoal do Instagram, que o Buffer não publica direto." },
        ],
      },
    ],
  },
  {
    id: "email",
    nome: "E-mail",
    pergunta: "Por onde sai o e-mail de recuperar senha?",
    multiplo: false,
    provedores: [
      {
        id: "resend",
        nome: "Resend",
        resumo: "Envia o link de \"esqueci a senha\" e o aviso de peça publicada.",
        ondePegar: { texto: "Resend → API Keys", link: "https://resend.com/api-keys" },
        campos: [
          { id: "apiKey", rotulo: "API key", secreto: true, exemplo: "re_…" },
          { id: "remetente", rotulo: "Remetente", tipo: "email", exemplo: "Central <avisos@seudominio.com>", dica: "Domínio verificado no Resend. Para testar: onboarding@resend.dev" },
        ],
      },
    ],
  },
];

export const grupo = (id: GrupoId) => GRUPOS.find((g) => g.id === id)!;
export const provedor = (g: GrupoId, id: string) => grupo(g).provedores.find((p) => p.id === id) ?? null;
