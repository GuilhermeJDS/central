"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { contaCentral, contaCentralLeitura, contaCentralGeracao } from "@/app/central/_lib/sessao";
import { prisma } from "@/lib/prisma";
import { buscarNegocio } from "@/lib/rastro/busca";
import { chamarModelo, extrairJson, usoDe } from "@/lib/chefes/chamar-modelo";
import { criarExecucao, marcarRodando, concluirExecucao, falharExecucao } from "@/lib/skills/execucoes";

const ESPACOS = { engenharia: "Lumina Engenharia", ofertas: "Lumina Ofertas", sites: "Sites para clínicas" } as const;
type Espaco = keyof typeof ESPACOS;
type Lead = { id: string; nome: string; endereco: string | null; site: string | null; maps: string | null; categoria: string | null; criado: string; mensagem?: string; status?: string; responsavel?: string; contato?: string; evidencia?: string; previa?: string; rascunhoSite?: { titulo: string; apresentacao: string; servicos: string[]; chamada: string } };
const validar = (v: string): v is Espaco => Object.hasOwn(ESPACOS, v);
const prefixo = (conta: string) => `espacos.${conta}.`;
const chave = (conta: string, parte: string) => prefixo(conta) + parte;

async function ler(conta: string, parte: string) {
  return (await prisma.config.findUnique({ where: { chave: chave(conta, parte) } }))?.valor ?? "";
}
async function gravar(conta: string, parte: string, valor: string) {
  const k = chave(conta, parte);
  await prisma.config.upsert({ where: { chave: k }, create: { chave: k, valor }, update: { valor } });
}
async function lerLead(conta: string, id: string): Promise<Lead> {
  if (!/^(?:[a-f0-9]{32}|[a-f0-9-]{36})$/.test(id)) throw new Error("Registro inválido.");
  const raw = await ler(conta, "lead." + id);
  if (!raw) throw new Error("Registro não encontrado.");
  const lead = JSON.parse(raw) as Lead;
  if (lead.id !== id) throw new Error("Registro inválido.");
  return lead;
}
export async function dadosEspacos() {
  const { accountId } = await contaCentralLeitura();
  const [engenharia, ofertas, sites, respostas, registros] = await Promise.all([
    ler(accountId, "engenharia"), ler(accountId, "ofertas"), ler(accountId, "sites"),
    Promise.all(["engenharia","ofertas","sites"].map(e => ler(accountId, "resposta." + e))),
    prisma.config.findMany({ where: { chave: { startsWith: chave(accountId, "lead.") } }, orderBy: { atualizadoEm: "desc" }, take: 200 }),
  ]);
  const leads = registros.flatMap(r => { try { const x = JSON.parse(r.valor) as Lead; return x.id && x.nome ? [x] : []; } catch { return []; } });
  return { engenharia, ofertas, sites, respostas, leads };
}
export async function salvarContexto(form: FormData) {
  const { accountId } = await contaCentral();
  const espaco = String(form.get("espaco") ?? "");
  const texto = String(form.get("contexto") ?? "").trim();
  if (!validar(espaco) || texto.length > 10000) throw new Error("Contexto inválido.");
  await gravar(accountId, espaco, texto);
  revalidatePath("/central/espacos");
}
export async function perguntarEspaco(form: FormData) {
  const { accountId } = await contaCentralGeracao();
  const espaco = String(form.get("espaco") ?? "");
  const pedido = String(form.get("pedido") ?? "").trim();
  if (!validar(espaco) || pedido.length < 4 || pedido.length > 4000) throw new Error("Informe um pedido válido.");
  const contexto = await ler(accountId, espaco);
  if (!contexto) throw new Error("Preencha o contexto desta área antes de pedir.");
  const ex = await criarExecucao({accountId, departamento: "DIRETORIA", chefe: "Norte", tipo: "CHEFE", entrada: {acao:"perguntaEspaco", espaco, pedido}});
  try {
    await marcarRodando(accountId, ex.id);
    const resposta = await chamarModelo(accountId,
      "Você ajuda em uma frente específica do negócio do usuário. Use somente o contexto desta frente e o pedido. Não invente dados, clientes, preços ou resultados. Se faltar algo essencial, diga o que falta. Em engenharia apresente cálculos e recomendações como apoio a ser verificado pelo responsável técnico.",
      `ÁREA: ${ESPACOS[espaco]}\nCONTEXTO:\n${contexto}\n\nPEDIDO:\n${pedido}`,
      {maxTokens: 5000, timeoutMs: 90000, chefe:"Norte"});
    await gravar(accountId, "resposta." + espaco, JSON.stringify({pedido, texto: resposta.texto}));
    await concluirExecucao(accountId, ex.id, {saida: resposta.texto, titulo: ESPACOS[espaco], ...usoDe(resposta)});
  } catch(e) {
    await falharExecucao(accountId, ex.id, e instanceof Error ? e.message : "Erro ao gerar resposta").catch(() => {});
    throw e;
  }
  revalidatePath("/central/espacos");
}
export async function pesquisarClinica(form: FormData) {
  const { accountId } = await contaCentral();
  const nome = String(form.get("nome") ?? "").trim();
  const cidade = String(form.get("cidade") ?? "").trim();
  if (nome.length < 2 || nome.length > 150 || cidade.length < 2 || cidade.length > 150) throw new Error("Informe nome e cidade.");
  const { lugar } = await buscarNegocio(nome, cidade);
  if (!lugar) throw new Error("Nenhum resultado encontrado.");
  const identidade = lugar.placeId || lugar.linkMaps || (lugar.nome + "|" + (lugar.endereco || cidade));
  const id = createHash("sha256").update(identidade.trim().toLocaleLowerCase("pt-BR")).digest("hex").slice(0, 32);
  const lead: Lead = { id, nome: lugar.nome, endereco: lugar.endereco, site: lugar.site, maps: lugar.linkMaps, categoria: lugar.categoria, criado: new Date().toISOString(), status:"pesquisado" };
  const k = chave(accountId, "lead." + id);
  try { await prisma.config.create({ data: { chave:k, valor:JSON.stringify(lead) } }); }
  catch(e) { if (!(e && typeof e === "object" && "code" in e && e.code === "P2002")) throw e; }
  revalidatePath("/central/espacos");
}
export async function atualizarLead(form: FormData) {
  const { accountId } = await contaCentral();
  const id = String(form.get("id") ?? "");
  const lead = await lerLead(accountId, id);
  const status = String(form.get("status") ?? "");
  if (!["pesquisado","qualificando","previa","pronto","contatado","negociacao","fechado","descartado"].includes(status)) throw new Error("Etapa inválida.");
  const campo = (nome: string, max: number) => String(form.get(nome) ?? "").trim().slice(0,max);
  await gravar(accountId, "lead." + id, JSON.stringify({...lead, status, responsavel: campo("responsavel",150), contato: campo("contato",300), evidencia: campo("evidencia",2000), previa: campo("previa",500)}));
  revalidatePath("/central/espacos");
}
export async function rascunharContato(form: FormData) {
  const { accountId } = await contaCentralGeracao();
  const id = String(form.get("id") ?? "");
  const lead = await lerLead(accountId, id);
  const contexto = await ler(accountId, "sites");
  const ex = await criarExecucao({accountId, departamento:"VENDAS", chefe:"Negociador Trato", tipo:"CHEFE", entrada:{acao:"rascunhoClinica", leadId:id}});
  try {
    await marcarRodando(accountId, ex.id);
    const r = await chamarModelo(accountId,
      "Escreva em português brasileiro um rascunho breve e humano de abordagem comercial com base apenas nos dados fornecidos. Não invente informações, resultados, vínculos, preço ou problemas no site. Não afirme que falta site. Nunca apresente contato genérico como contato do proprietário. O texto será revisado e não é enviado automaticamente.",
      `Contexto da frente de sites: ${contexto || "Criação de sites para clínicas e profissionais de saúde."}\nDados para conferência: ${JSON.stringify(lead)}\nNão presuma o nome do proprietário.`,
      {maxTokens: 3500, timeoutMs: 90000, chefe:"Trato"});
    const atual = await lerLead(accountId, id);
    await gravar(accountId, "lead." + id, JSON.stringify({...atual, mensagem:r.texto}));
    await concluirExecucao(accountId, ex.id, {saida:r.texto, titulo:"Rascunho de contato", ...usoDe(r)});
  } catch(e) {
    await falharExecucao(accountId, ex.id, e instanceof Error ? e.message : "Erro ao gerar rascunho").catch(() => {});
    throw e;
  }
  revalidatePath("/central/espacos");
}
const SITE_SCHEMA = z.object({
  titulo: z.string().trim().min(1).max(140),
  apresentacao: z.string().trim().min(1).max(600),
  servicos: z.array(z.string().trim().min(1).max(100)).max(6),
  chamada: z.string().trim().min(1).max(150)
});
export async function prepararPrevia(form: FormData) {
  const { accountId } = await contaCentralGeracao();
  const id = String(form.get("id") ?? "");
  const lead = await lerLead(accountId, id);
  const contexto = await ler(accountId, "sites");
  const ex = await criarExecucao({accountId, departamento:"VENDAS", chefe:"Negociador Trato", tipo:"CHEFE", entrada:{acao:"previaClinica", leadId:id}});
  try {
    await marcarRodando(accountId, ex.id);
    const r = await chamarModelo(accountId,
      'Crie um rascunho de texto para uma página de apresentação em português. Use apenas dados fornecidos; nunca invente nome de profissional, endereço, serviços, preços, depoimentos, registros, especialidades, resultados ou credenciais. A lista servicos pode ficar vazia se não houver confirmação. Não inclua números ou promessas não informados. Responda somente JSON com titulo, apresentacao, servicos (array de textos curtos) e chamada.',
      `Contexto do serviço: ${contexto || "Criação de sites para clínicas."}\nDados públicos e observações ainda sujeitos a confirmação: ${JSON.stringify({nome:lead.nome,categoria:lead.categoria,endereco:lead.endereco,evidencia:lead.evidencia})}`,
      {maxTokens: 4000, timeoutMs: 90000, chefe:"Trato"});
    const rascunhoSite = SITE_SCHEMA.parse(extrairJson(r.texto));
    const atual = await lerLead(accountId, id);
    await gravar(accountId, "lead." + id, JSON.stringify({...atual, rascunhoSite}));
    await concluirExecucao(accountId, ex.id, {saida:JSON.stringify(rascunhoSite), titulo:"Rascunho de página", ...usoDe(r)});
  } catch(e) {
    await falharExecucao(accountId, ex.id, e instanceof Error ? e.message : "Erro ao gerar prévia").catch(() => {});
    throw e;
  }
  revalidatePath("/central/espacos");
}
