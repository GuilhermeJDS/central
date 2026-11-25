"use server";

/**
 * Ações do estúdio de Redes. accountId SEMPRE de contaCentral(); ids vindos
 * da tela só acham registros DENTRO da conta.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";

import { contaCentral, contaCentralLeitura, sessaoCentral } from "@/app/central/_lib/sessao";
import { mensagemParaDono } from "@/lib/chefes/chamar-modelo";
import { IDS_FONTE, type IdFonte } from "@/lib/central/carrossel";
import { salvarNovaVersao, tornarPrincipal, vinculoDe } from "@/lib/central/estudio/pecas";
import { gerarImagem, listarImagens, NOME_PROVEDOR_IMAGEM, type ImagemView } from "@/lib/central/estudio/imagens";
import { numerosDoPost, postsDaConta, type NumerosPost, type PostConta } from "@/lib/central/estudio/posts";
import { ETAPAS, type VinculoPost } from "@/lib/central/estudio/tipos";
import { prisma } from "@/lib/prisma";
import { saveUploadedImage } from "@/lib/uploads";

type Resultado<T = object> = ({ erro: null } & T) | { erro: string };

async function conta(): Promise<{ accountId: string } | { erro: string }> {
  try {
    return await contaCentral();
  } catch (e) {
    return { erro: mensagemParaDono(e, "Sem acesso agora.") };
  }
}

/** Só leitura: conta sem plano também vê. */
async function contaLeitura(): Promise<{ accountId: string } | { erro: string }> {
  try {
    return await contaCentralLeitura();
  } catch (e) {
    return { erro: mensagemParaDono(e, "Sem acesso agora.") };
  }
}

const id = z.string().min(1).max(64);
const COR = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const URL_IMAGEM = z
  .string()
  .max(300)
  .regex(/^\/(api\/)?uploads\/(carrossel|marca)\/[\w.-]+$/);
const COR_MARCA = z.enum(["fundo", "texto", "destaque", "branco", "preto"]);
const num = z.number().finite().min(-2000).max(4000);

const elementoSchema = z.object({
  id: z.string().min(1).max(60),
  tipo: z.enum(["titulo", "texto", "balao", "selo", "imagem"]),
  x: num,
  y: num,
  w: z.number().finite().min(20).max(4000),
  h: z.number().finite().min(20).max(4000).optional(),
  texto: z.string().max(1200).optional(),
  tamanho: z.number().int().min(16).max(200).optional(),
  cor: COR_MARCA.optional(),
  fundo: COR_MARCA.optional(),
  url: URL_IMAGEM.optional(),
  escurecer: z.boolean().optional(),
});

const carrosselSchema = z.object({
  slides: z
    .array(
      z.object({
        id: z.string().min(1).max(40),
        titulo: z.string().max(300),
        texto: z.string().max(1200),
        imagem: URL_IMAGEM.nullable(),
        imagemDica: z.string().max(300).default(""),
        layout: z.enum(["fundo", "metade", "texto"]).optional(),
        elementos: z.array(elementoSchema).max(24).optional(),
      }),
    )
    .min(1)
    .max(15),
  marca: z.object({
    fundo: COR,
    texto: COR,
    destaque: COR,
    fonte: z.enum(IDS_FONTE as [IdFonte, ...IdFonte[]]),
    formato: z.enum(["4x5", "1x1"]),
  }),
});

function revalidar() {
  revalidatePath("/central/redes", "layout");
}

// ---------------------------------------------------------------------------
// Versões
// ---------------------------------------------------------------------------

export async function salvarVersaoAcao(
  entregaId: string,
  dados: { descricao: unknown; conteudo?: unknown; texto?: unknown },
): Promise<Resultado<{ versaoId: string; numero: number }>> {
  const c = await conta();
  if ("erro" in c) return c;
  const descricao = z.string().trim().min(1).max(160).safeParse(dados.descricao);
  if (!descricao.success) return { erro: "Escreva em poucas palavras o que mudou." };
  let conteudo: Prisma.InputJsonValue | undefined;
  if (dados.conteudo !== undefined) {
    const r = carrosselSchema.safeParse(dados.conteudo);
    if (!r.success) return { erro: "Algo nos slides não está certo. Recarregue a página." };
    conteudo = r.data as unknown as Prisma.InputJsonValue;
  }
  const texto = dados.texto === undefined ? undefined : z.string().max(8000).nullable().catch(null).parse(dados.texto);
  // Carrossel: a legenda continua a da peça.
  const atual = await prisma.entregaChefe.findFirst({
    where: { id: id.parse(String(entregaId).slice(0, 64)), accountId: c.accountId },
    select: { id: true, texto: true, tipo: true },
  });
  if (!atual) return { erro: "Peça não encontrada." };
  const v = await salvarNovaVersao(c.accountId, atual.id, {
    descricao: descricao.data,
    conteudo,
    texto: texto === undefined ? atual.texto : texto,
  });
  if (!v) return { erro: "Não deu para salvar a versão. Tente de novo." };
  revalidar();
  return { erro: null, versaoId: v.id, numero: v.numero };
}

export async function tornarPrincipalAcao(entregaId: string, versaoId: string): Promise<Resultado> {
  const c = await conta();
  if ("erro" in c) return c;
  const ok = await tornarPrincipal(c.accountId, String(entregaId).slice(0, 64), String(versaoId).slice(0, 64));
  if (!ok) return { erro: "Versão não encontrada." };
  revalidar();
  return { erro: null };
}

// ---------------------------------------------------------------------------
// Comentários (alfinetes)
// ---------------------------------------------------------------------------

export type ComentarioView = {
  id: string;
  versaoId: string;
  slide: number;
  x: number;
  y: number;
  texto: string;
  autor: string;
  resolvido: boolean;
  em: string;
};

export async function comentarAcao(dados: {
  versaoId: unknown;
  slide: unknown;
  x: unknown;
  y: unknown;
  texto: unknown;
}): Promise<Resultado<{ comentario: ComentarioView }>> {
  const c = await conta();
  if ("erro" in c) return c;
  const r = z
    .object({
      versaoId: id,
      slide: z.number().int().min(0).max(30),
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
      texto: z.string().trim().min(1).max(1000),
    })
    .safeParse(dados);
  if (!r.success) return { erro: "Escreva o comentário." };
  const versao = await prisma.versaoEntrega.findFirst({
    where: { id: r.data.versaoId, accountId: c.accountId },
    select: { id: true },
  });
  if (!versao) return { erro: "Versão não encontrada." };
  const s = await sessaoCentral();
  const autor = (s.estado === "ok" && s.primeiroNome) || "Você";
  const novo = await prisma.comentarioVersao.create({
    data: { accountId: c.accountId, ...r.data, autor: autor.slice(0, 80) },
  });
  return {
    erro: null,
    comentario: {
      id: novo.id,
      versaoId: novo.versaoId,
      slide: novo.slide,
      x: novo.x,
      y: novo.y,
      texto: novo.texto,
      autor: novo.autor,
      resolvido: novo.resolvido,
      em: novo.criadoEm.toISOString(),
    },
  };
}

export async function resolverComentarioAcao(comentarioId: string, resolvido: boolean): Promise<Resultado> {
  const c = await conta();
  if ("erro" in c) return c;
  const { count } = await prisma.comentarioVersao.updateMany({
    where: { id: String(comentarioId).slice(0, 64), accountId: c.accountId },
    data: { resolvido: !!resolvido },
  });
  return count ? { erro: null } : { erro: "Comentário não encontrado." };
}

export async function apagarComentarioAcao(comentarioId: string): Promise<Resultado> {
  const c = await conta();
  if ("erro" in c) return c;
  const { count } = await prisma.comentarioVersao.deleteMany({
    where: { id: String(comentarioId).slice(0, 64), accountId: c.accountId },
  });
  return count ? { erro: null } : { erro: "Comentário não encontrado." };
}

// ---------------------------------------------------------------------------
// Peça: etapa, detalhes, data
// ---------------------------------------------------------------------------

export async function mudarEtapaAcao(entregaId: string, etapa: string): Promise<Resultado> {
  const c = await conta();
  if ("erro" in c) return c;
  if (!(ETAPAS as readonly string[]).includes(etapa)) return { erro: "Etapa desconhecida." };
  const { count } = await prisma.entregaChefe.updateMany({
    where: { id: String(entregaId).slice(0, 64), accountId: c.accountId },
    data: { etapa, ...(etapa === "PUBLICADO" ? { publicadaEm: new Date() } : {}) },
  });
  if (!count) return { erro: "Peça não encontrada." };
  revalidar();
  return { erro: null };
}

export async function salvarDetalhesAcao(
  entregaId: string,
  dados: { titulo?: unknown; descricao?: unknown; legenda?: unknown },
): Promise<Resultado> {
  const c = await conta();
  if ("erro" in c) return c;
  const r = z
    .object({
      titulo: z.string().trim().min(1).max(160).optional(),
      descricao: z.string().trim().max(400).optional(),
      legenda: z.string().max(4000).optional(),
    })
    .safeParse(dados);
  if (!r.success) return { erro: "O título não pode ficar vazio." };
  const e = await prisma.entregaChefe.findFirst({
    where: { id: String(entregaId).slice(0, 64), accountId: c.accountId },
    select: { id: true, tipo: true, versaoPrincipalId: true },
  });
  if (!e) return { erro: "Peça não encontrada." };
  await prisma.entregaChefe.update({
    where: { id: e.id, accountId: c.accountId },
    data: {
      ...(r.data.titulo !== undefined ? { titulo: r.data.titulo } : {}),
      ...(r.data.descricao !== undefined ? { descricao: r.data.descricao || null } : {}),
      ...(r.data.legenda !== undefined && e.tipo === "CARROSSEL" ? { texto: r.data.legenda } : {}),
    },
  });
  // A legenda acompanha a versão principal.
  if (r.data.legenda !== undefined && e.tipo === "CARROSSEL" && e.versaoPrincipalId)
    await prisma.versaoEntrega.updateMany({
      where: { id: e.versaoPrincipalId, accountId: c.accountId },
      data: { texto: r.data.legenda },
    });
  revalidar();
  return { erro: null };
}

export async function programarAcao(entregaId: string, dia: string | null): Promise<Resultado> {
  const c = await conta();
  if ("erro" in c) return c;
  let data: Date | null = null;
  if (dia) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return { erro: "Data inválida." };
    // Meio-dia em Brasília: o dia não muda com o fuso.
    data = new Date(`${dia}T15:00:00.000Z`);
    if (Number.isNaN(data.getTime())) return { erro: "Data inválida." };
  }
  const e = await prisma.entregaChefe.findFirst({
    where: { id: String(entregaId).slice(0, 64), accountId: c.accountId },
    select: { id: true, etapa: true },
  });
  if (!e) return { erro: "Peça não encontrada." };
  await prisma.entregaChefe.update({
    where: { id: e.id, accountId: c.accountId },
    data: {
      ...(e.etapa === "PUBLICADO" ? { publicadaEm: data } : { programadaPara: data }),
      // Aprovado com data vira Programado; Programado sem data volta a Aprovado.
      ...(e.etapa === "APROVADO" && data ? { etapa: "PROGRAMADO" } : {}),
      ...(e.etapa === "PROGRAMADO" && !data ? { etapa: "APROVADO" } : {}),
    },
  });
  revalidar();
  return { erro: null };
}

// ---------------------------------------------------------------------------
// Vínculo com o post real
// ---------------------------------------------------------------------------

const HOSTS_CAPA = /(^|\.)(cdninstagram\.com|fbcdn\.net|youtube\.com|ytimg\.com|twimg\.com|licdn\.com)$/i;

/** Copia a miniatura do post para o nosso servidor (a CSP não deixa a tela ler o CDN da rede). */
async function guardarCapa(url: string | null): Promise<string | null> {
  if (!url) return null;
  if (/^\/uploads\/[\w/.-]+$/.test(url)) return url;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" || !HOSTS_CAPA.test(u.hostname)) return null;
    const r = await fetch(u, { signal: AbortSignal.timeout(8000), redirect: "follow" });
    const tipo = r.headers.get("content-type") ?? "";
    if (!r.ok || !tipo.startsWith("image/")) return null;
    const blob = await r.blob();
    if (blob.size > 5 * 1024 * 1024) return null;
    return await saveUploadedImage(new File([blob], "post", { type: tipo }), "marca", "post", { maxWidth: 900 });
  } catch {
    return null;
  }
}

async function pecaDaConta(accountId: string, entregaId: string) {
  return prisma.entregaChefe.findFirst({
    where: { id: String(entregaId).slice(0, 64), accountId },
    select: { id: true, rede: true, vinculo: true, etapa: true },
  });
}

export async function listarPostsAcao(entregaId: string): Promise<Resultado<{ posts: PostConta[] }>> {
  const c = await contaLeitura();
  if ("erro" in c) return c;
  const e = await pecaDaConta(c.accountId, entregaId);
  if (!e) return { erro: "Peça não encontrada." };
  const r = await postsDaConta(c.accountId, e.rede);
  return r.ok ? { erro: null, posts: r.posts } : { erro: r.mensagem };
}

export async function vincularPostAcao(entregaId: string, postId: string): Promise<Resultado> {
  const c = await conta();
  if ("erro" in c) return c;
  const e = await pecaDaConta(c.accountId, entregaId);
  if (!e || !e.rede) return { erro: "Peça não encontrada." };
  const r = await postsDaConta(c.accountId, e.rede);
  if (!r.ok) return { erro: r.mensagem };
  const post = r.posts.find((p) => p.id === String(postId).slice(0, 120));
  if (!post) return { erro: "Esse post não está entre os últimos da conta." };
  const capa = await guardarCapa(post.imagem);
  const vinculo: VinculoPost = {
    rede: e.rede,
    id: post.id,
    link: post.link,
    data: post.data,
    texto: post.texto.slice(0, 300),
    capa,
  };
  await prisma.entregaChefe.update({
    where: { id: e.id, accountId: c.accountId },
    data: {
      vinculo: vinculo as unknown as Prisma.InputJsonValue,
      etapa: "PUBLICADO",
      publicadaEm: post.data ? new Date(post.data) : new Date(),
    },
  });
  revalidar();
  return { erro: null };
}

export async function desvincularPostAcao(entregaId: string): Promise<Resultado> {
  const c = await conta();
  if ("erro" in c) return c;
  const e = await pecaDaConta(c.accountId, entregaId);
  if (!e) return { erro: "Peça não encontrada." };
  await prisma.entregaChefe.update({ where: { id: e.id, accountId: c.accountId }, data: { vinculo: Prisma.DbNull } });
  revalidar();
  return { erro: null };
}

export async function numerosPostAcao(entregaId: string): Promise<Resultado<{ numeros: NumerosPost }>> {
  const c = await contaLeitura();
  if ("erro" in c) return c;
  const e = await pecaDaConta(c.accountId, entregaId);
  const v = vinculoDe(e?.vinculo);
  if (!e || !v) return { erro: "Esta peça não tem post vinculado." };
  const r = await numerosDoPost(c.accountId, v.rede, v.id);
  return r.ok ? { erro: null, numeros: r.numeros } : { erro: r.mensagem };
}

// ---------------------------------------------------------------------------
// Imagens e identidade da marca
// ---------------------------------------------------------------------------

export async function gerarImagemAcao(dados: {
  cena: unknown;
  entregaId?: unknown;
  referenciaUrl?: unknown;
}): Promise<Resultado<{ url: string; provedor: string }>> {
  const c = await conta();
  if ("erro" in c) return c;
  const r = z
    .object({
      cena: z.string().trim().min(3).max(600),
      entregaId: z.string().max(64).nullish(),
      referenciaUrl: URL_IMAGEM.nullish(),
    })
    .safeParse(dados);
  if (!r.success) return { erro: "Descreva a cena da imagem." };
  if (r.data.entregaId) {
    const e = await pecaDaConta(c.accountId, r.data.entregaId);
    if (!e) return { erro: "Peça não encontrada." };
  }
  const ficha = await prisma.fichaNegocio.findUnique({ where: { accountId: c.accountId }, select: { oQueVende: true } });
  try {
    const g = await gerarImagem(c.accountId, {
      cena: r.data.cena,
      entregaId: r.data.entregaId ?? null,
      referenciaUrl: r.data.referenciaUrl ?? null,
      nicho: ficha?.oQueVende.slice(0, 160) || "um pequeno negócio local",
    });
    revalidatePath("/central/redes/marca/imagens");
    return { erro: null, url: g.url, provedor: NOME_PROVEDOR_IMAGEM[g.provedor] };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Não deu para gerar a imagem agora." };
  }
}

export async function enviarImagemMarcaAcao(form: FormData): Promise<Resultado<{ url: string }>> {
  const c = await conta();
  if ("erro" in c) return c;
  const arquivo = form.get("imagem");
  if (!(arquivo instanceof File) || !arquivo.size) return { erro: "Escolha uma imagem." };
  try {
    const url = await saveUploadedImage(arquivo, "carrossel", "enviada", { maxWidth: 1600 });
    await prisma.imagemMarca.create({ data: { accountId: c.accountId, url, origem: "ENVIADA" } });
    revalidatePath("/central/redes/marca/imagens");
    return { erro: null, url };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Não deu para enviar a imagem." };
  }
}

export async function listarImagensAcao(): Promise<Resultado<{ imagens: ImagemView[] }>> {
  const c = await contaLeitura();
  if ("erro" in c) return c;
  return { erro: null, imagens: await listarImagens(c.accountId) };
}

export async function apagarImagemAcao(imagemId: string): Promise<Resultado> {
  const c = await conta();
  if ("erro" in c) return c;
  // Só sai da biblioteca: slides que já usam a imagem continuam com ela.
  const { count } = await prisma.imagemMarca.deleteMany({ where: { id: String(imagemId).slice(0, 64), accountId: c.accountId } });
  revalidatePath("/central/redes/marca/imagens");
  return count ? { erro: null } : { erro: "Imagem não encontrada." };
}

export async function salvarIdentidadeAcao(dados: unknown): Promise<Resultado> {
  const c = await conta();
  if ("erro" in c) return c;
  const COR_OU_VAZIO = z.union([COR, z.literal("")]).optional();
  const r = z
    .object({
      estilo: z.string().max(1500),
      personagem: z.string().max(1500),
      provedorImagem: z.enum(["OPENAI", "GOOGLE"]).nullable(),
      referenciaUrl: URL_IMAGEM.nullable(),
      corFundo: COR_OU_VAZIO,
      corTexto: COR_OU_VAZIO,
      corDestaque: COR_OU_VAZIO,
      fonte: z.enum(IDS_FONTE as [IdFonte, ...IdFonte[]]).nullable(),
    })
    .safeParse(dados);
  if (!r.success) return { erro: "Algo na identidade não está certo." };
  const d = {
    ...r.data,
    corFundo: r.data.corFundo || null,
    corTexto: r.data.corTexto || null,
    corDestaque: r.data.corDestaque || null,
  };
  await prisma.identidadeMarca.upsert({ where: { accountId: c.accountId }, create: { accountId: c.accountId, ...d }, update: d });
  revalidar();
  return { erro: null };
}

// ---------------------------------------------------------------------------
// Referências
// ---------------------------------------------------------------------------

export async function salvarReferenciaAcao(form: FormData): Promise<Resultado> {
  const c = await conta();
  if ("erro" in c) return c;
  const r = z
    .object({
      nota: z.string().trim().min(3).max(1000),
      link: z.union([z.string().trim().url().max(500).refine((u) => /^https:\/\//.test(u)), z.literal("")]),
      rede: z.enum(["INSTAGRAM", "YOUTUBE", "X", "LINKEDIN", "TIKTOK", ""]),
    })
    .safeParse({ nota: form.get("nota") ?? "", link: form.get("link") ?? "", rede: form.get("rede") ?? "" });
  if (!r.success) return { erro: "Escreva o que chamou atenção (e um link https, se tiver)." };
  let imagem: string | null = null;
  const arquivo = form.get("imagem");
  if (arquivo instanceof File && arquivo.size) {
    try {
      imagem = await saveUploadedImage(arquivo, "marca", "referencia", { maxWidth: 1200 });
    } catch (e) {
      return { erro: e instanceof Error ? e.message : "Não deu para enviar o print." };
    }
  }
  await prisma.referenciaRede.create({
    data: { accountId: c.accountId, nota: r.data.nota, link: r.data.link || null, rede: r.data.rede || null, imagem },
  });
  revalidatePath("/central/redes/referencias");
  return { erro: null };
}

export async function apagarReferenciaAcao(id: string): Promise<Resultado> {
  const c = await conta();
  if ("erro" in c) return c;
  await prisma.referenciaRede.deleteMany({ where: { id: String(id).slice(0, 64), accountId: c.accountId } });
  revalidatePath("/central/redes/referencias");
  return { erro: null };
}
