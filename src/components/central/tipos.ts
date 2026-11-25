/**
 * Formatos que os componentes da Central recebem. Cada bloco vem do banco
 * (dado real) OU de exemplo.ts — o componente não sabe a diferença, só
 * recebe `exemplo` para não chamar o servidor à toa.
 * Datas vão como texto ISO (passam do servidor para o cliente sem perda).
 */
import type { SlugDepartamento } from "@/lib/central/departamentos";

export type Fonte<T> = { dado: T; exemplo: boolean };

export type Periodo = 7 | 14 | 30;

export type AcaoNorteView = {
  /** null = exemplo (não existe no banco). */
  execucaoId: string | null;
  chefe: string;
  departamentoNome: string;
  slug: SlugDepartamento | null;
  titulo: string;
  porQue: string;
  decisao: "PENDENTE" | "APROVADA" | "PASSADA" | "AJUSTAR" | null;
  equipeFaz: boolean;
  /** Quem o Norte juntou nesta ação (departamentos conectados). */
  fontes?: Array<{ chefe: string; titulo: string }>;
};

export type VizinhosView = {
  voce: { nota: number | null; avaliacoes: number | null };
  vizinhos: Array<{ nome: string; nota: number | null; avaliacoes: number | null }>;
};

export type SerieView = {
  /** Um ponto por dia, do mais antigo ao mais novo. */
  dias: Array<{ data: string; total: number }>;
  total: number;
  /** Mesmo número de dias, logo antes. null = sem base para comparar. */
  anterior: number | null;
};

export type EstadoDecisao = "pendente" | "aprovada" | "passada" | "ajuste";

export type DecisaoView = {
  id: string;
  chefe: string;
  departamento: string;
  slug: SlugDepartamento | null;
  titulo: string;
  porQue: string;
  conteudo: string;
  estado: EstadoDecisao;
  em: string;
  /** Departamentos conectados: quem forneceu o insumo ("veio do Rastro"). */
  fontes?: Array<{ chefe: string; titulo: string }>;
  /** Corrente de trabalho: de onde veio ("Conselho · Oferta → Whale · Página"). */
  cadeia?: Array<{ chefe: string; rotulo: string; quem: string }>;
  /** O passo seguinte do cardápio, se houver. */
  proxima?: { chefe: string; rotulo: string } | null;
};

export type PulsoView = Array<{
  slug: SlugDepartamento;
  nome: string;
  chefe: string;
  estado: "ativo" | "parado";
  ultima: string | null;
  /** Trabalhos entregues no período. */
  entregas: number;
  /** Decisões dele esperando o dono. */
  pendentes: number;
  /** Trabalhos por dia nos últimos 7 dias (do mais antigo a hoje). */
  semana: number[];
}>;

export type EventoView = {
  id: string;
  em: string;
  chefe: string;
  linha: string;
  /** resultado = entrega de um chefe; decisao = o que você decidiu; marco = post, venda, contrato. */
  tipo: "resultado" | "decisao" | "marco";
  slug: SlugDepartamento | null;
  decisao?: "APROVADA" | "PASSADA" | "AJUSTAR";
  marco?: "publicado" | "venda" | "contrato";
  /** Link para a peça; sem ele, o departamento. */
  href?: string | null;
};

export type AnaliseView = {
  periodo: string;
  frase: string;
  paragrafo: string;
  funcionando: string[];
  fazer: string[];
  proximos: string[];
  /** Resultado completo (markdown) quando existe. */
  textoCompleto?: string;
};

export type NumeroView = {
  rotulo: string;
  valor: string;
  /** Variação em % contra o período anterior; null = sem base. */
  variacao: number | null;
  /** Para números em que subir é ruim (faltas, cancelamentos). */
  menosEMelhor?: boolean;
  base: string;
};

export type EntregaView = {
  id: string;
  titulo: string;
  tipo: string;
  em: string;
  estado: EstadoDecisao | "pronto";
};

export type FichaView = {
  nomeNegocio: string;
  cidade: string;
  oQueVende: string;
  paraQuem: string;
  objetivo: string;
  objetivoOutro: string;
  instagram: string;
  site: string;
  google: string;
  youtube: string;
  linkedin: string;
  x: string;
  comoFala: string;
  naoQuer: string;
};
