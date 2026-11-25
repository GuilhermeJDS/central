"use server";

/**
 * "Novo carrossel / roteiro / pauta": cria a peça direto em "Em revisão",
 * sem passar pelas Decisões. accountId SEMPRE da sessão; a pauta de base só
 * é lida dentro da conta.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { contaCentralGeracao } from "@/app/central/_lib/sessao";
import { mensagemParaDono } from "@/lib/chefes/chamar-modelo";
import { CONFIG_NOVA, SLIDES_MAX, SLIDES_MIN } from "@/lib/central/estudio/nova-peca";
import { criarPecaNova } from "@/lib/central/producao";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  secao: z.enum(["carrosseis", "videos", "pautas"]),
  formato: z.string().max(20),
  rede: z.string().max(20),
  tema: z.string().max(600).default(""),
  pautaId: z.string().max(64).nullable().default(null),
  slides: z.number().int().min(SLIDES_MIN).max(SLIDES_MAX).nullable().default(null),
});

export async function novaPecaAcao(dados: unknown): Promise<{ id: string | null; erro: string | null }> {
  let accountId: string;
  try {
    ({ accountId } = await contaCentralGeracao());
  } catch (e) {
    return { id: null, erro: mensagemParaDono(e, "Sem acesso agora.") };
  }
  const r = schema.safeParse(dados);
  if (!r.success) return { id: null, erro: "Confira os campos e tente de novo." };
  const d = r.data;
  const cfg = CONFIG_NOVA[d.secao];
  const formato = cfg.formatos.find((f) => f.tipo === d.formato);
  if (!formato) return { id: null, erro: "Escolha o formato." };
  if (!cfg.redes.includes(d.rede)) return { id: null, erro: "Escolha a rede." };
  if (formato.tipo === "THREAD" && d.rede !== "X" && d.rede !== "LINKEDIN")
    return { id: null, erro: "Thread é para o X ou o LinkedIn." };

  let base: { titulo: string; texto: string } | null = null;
  if (d.pautaId) {
    const p = await prisma.entregaChefe.findFirst({
      where: { id: d.pautaId, accountId, departamento: "REDES", status: "PRONTA" },
      select: { titulo: true, texto: true },
    });
    if (!p) return { id: null, erro: "Essa pauta não está mais disponível." };
    base = { titulo: p.titulo, texto: p.texto ?? "" };
  }
  if (!base && d.tema.trim().length < 4) return { id: null, erro: "Escreva o tema (ou escolha uma pauta)." };

  const { id } = await criarPecaNova(accountId, {
    tipo: formato.tipo,
    rede: d.rede,
    tema: d.tema,
    slides: cfg.slides ? (d.slides ?? 7) : null,
    base: base?.texto ?? null,
    baseTitulo: base?.titulo ?? null,
  });
  revalidatePath("/central", "layout");
  return { id, erro: null };
}
