"use server";

import { revalidatePath } from "next/cache";
import { contaCentral, contaCentralLeitura } from "@/app/central/_lib/sessao";
import { prisma } from "@/lib/prisma";
import { buscarNegocio } from "@/lib/rastro/busca";
import { chamarModelo } from "@/lib/chefes/chamar-modelo";

export const ESPACOS = {
  engenharia: "Lumina Engenharia",
  ofertas: "Lumina Ofertas",
  sites: "Sites para clínicas",
} as const;
type Espaco = keyof typeof ESPACOS;
type Lead = { nome: string; endereco: string | null; site: string | null; telefone: string | null; maps: string | null; categoria: string | null; criado: string; mensagem?: string };
const validar = (v: string): v is Espaco => Object.hasOwn(ESPACOS, v);
const chave = (conta: string, parte: string) => `espacos.${conta}.${parte}`;

async function ler(conta: string, parte: string) {
  return (await prisma.config.findUnique({ where: { chave: chave(conta, parte) } }))?.valor ?? "";
}
async function gravar(conta: string, parte: string, valor: string) {
  const k = chave(conta, parte);
  await prisma.config.upsert({ where: { chave: k }, create: { chave: k, valor }, update: { valor } });
}
export async function dadosEspacos() {
  const { accountId } = await contaCentralLeitura();
  const [engenharia, ofertas, sites, bruto] = await Promise.all([
    ler(accountId, "engenharia"), ler(accountId, "ofertas"), ler(accountId, "sites"), ler(accountId, "leads")
  ]);
  let leads: Lead[] = [];
  try { const parsed = JSON.parse(bruto || "[]"); if (Array.isArray(parsed)) leads = parsed; } catch { /* vazio */ }
  return { engenharia, ofertas, sites, leads };
}
export async function salvarContexto(form: FormData) {
  const { accountId } = await contaCentral();
  const espaco = String(form.get("espaco") ?? "");
  const texto = String(form.get("contexto") ?? "").trim();
  if (!validar(espaco) || texto.length > 10000) throw new Error("Contexto inválido.");
  await gravar(accountId, espaco, texto);
  revalidatePath("/central/espacos");
}
export async function pesquisarClinica(form: FormData) {
  const { accountId } = await contaCentral();
  const nome = String(form.get("nome") ?? "").trim();
  const cidade = String(form.get("cidade") ?? "").trim();
  if (nome.length < 2 || nome.length > 150 || cidade.length < 2 || cidade.length > 150) throw new Error("Informe nome e cidade.");
  const { lugar } = await buscarNegocio(nome, cidade);
  if (!lugar) return;
  const atual = await dadosEspacos();
  if (atual.leads.some(l => l.maps && l.maps === lugar.linkMaps)) return;
  const lead: Lead = { nome: lugar.nome, endereco: lugar.endereco, site: lugar.site, telefone: lugar.telefone, maps: lugar.linkMaps, categoria: lugar.categoria, criado: new Date().toISOString() };
  await gravar(accountId, "leads", JSON.stringify([lead, ...atual.leads].slice(0, 200)));
  revalidatePath("/central/espacos");
}
export async function rascunharContato(form: FormData) {
  const { accountId } = await contaCentral();
  const index = Number(form.get("indice"));
  const dados = await dadosEspacos();
  if (!Number.isInteger(index) || index < 0 || index >= dados.leads.length) throw new Error("Registro não encontrado.");
  const lead = dados.leads[index];
  const resposta = await chamarModelo(accountId,
    "Escreva em português brasileiro um rascunho breve e humano de abordagem comercial. Não invente informações, resultados, vínculos, preço ou problemas no site. Não afirme que falta site; apenas proponha conversa. O contato é um rascunho, nunca enviado automaticamente.",
    `Contexto da frente de sites: ${dados.sites || "Criação de sites para clínicas e profissionais de saúde."}\nDados públicos do estabelecimento: ${JSON.stringify(lead)}\nNão presuma o nome do proprietário. Se não houver responsável identificado, deixe isso explícito.`,
    { maxTokens: 2500, timeoutMs: 90000, chefe: "Trato" });
  dados.leads[index] = { ...lead, mensagem: resposta.texto };
  await gravar(accountId, "leads", JSON.stringify(dados.leads));
  revalidatePath("/central/espacos");
}