"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { marcarPasso } from "@/lib/config";
import { buscarNegocio, type Lugar } from "@/lib/rastro/busca";
import { exigirUsuario } from "@/lib/sessao";

export type ResultadoBusca = { ok: true; lugar: Lugar | null } | { ok: false; mensagem: string };

/** Acha a empresa no Google Maps pelo nome e a cidade (Rastro, com a Places API de reserva). */
export async function acharNegocioAcao(nome: string, cidade: string): Promise<ResultadoBusca> {
  await exigirUsuario();
  if (nome.trim().length < 2 || cidade.trim().length < 2) return { ok: false, mensagem: "Diga o nome e a cidade." };
  try {
    const r = await buscarNegocio(nome.trim(), cidade.trim());
    return { ok: true, lugar: r.lugar };
  } catch (e) {
    return { ok: false, mensagem: e instanceof Error ? e.message : "A busca falhou." };
  }
}

/** Guarda o que veio do Maps como rascunho da ficha (o passo abre já preenchido). */
export async function usarLugarAcao(lugar: Lugar, cidade: string): Promise<void> {
  await exigirUsuario();
  const rascunho = {
    nomeNegocio: lugar.nome,
    cidade,
    site: lugar.site ?? "",
    google: lugar.linkMaps ?? "",
    oQueVende: lugar.categoria ?? "",
    nota: lugar.nota,
    avaliacoes: lugar.totalAvaliacoes,
    endereco: lugar.endereco,
    telefone: lugar.telefone,
  };
  const valor = JSON.stringify(rascunho);
  await db.config.upsert({ where: { chave: "ficha.rascunho" }, update: { valor }, create: { chave: "ficha.rascunho", valor } });
  revalidatePath("/instalar/negocio");
}

export async function rascunhoFicha(): Promise<Record<string, unknown> | null> {
  const l = await db.config.findUnique({ where: { chave: "ficha.rascunho" } });
  try {
    return l ? (JSON.parse(l.valor) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function marcarPassoAcao(passo: string) {
  await exigirUsuario();
  await marcarPasso(passo);
}
