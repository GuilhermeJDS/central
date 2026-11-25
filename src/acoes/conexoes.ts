"use server";

import { revalidatePath } from "next/cache";

import { canaisBuffer } from "@/lib/buffer";
import { provedor, type GrupoId } from "@/lib/catalogo-integracoes";
import { apagarIntegracao, integracao, salvarIntegracao, type Valores } from "@/lib/config";
import { exigirUsuario } from "@/lib/sessao";

export type ResultadoIntegracao = { ok: boolean; mensagem: string } | null;

/** Testa o que dá para testar sem gastar nada. */
async function testar(g: GrupoId, v: Valores): Promise<string> {
  if (g === "buffer") {
    const canais = await canaisBuffer(String(v.apiKey));
    if (!canais.length) return "Chave aceita, mas o Buffer não tem nenhuma rede conectada. Conecte as redes no Buffer.";
    return `Chave aceita. Redes no Buffer: ${canais.map((c) => `${c.nome} (${c.servico})`).join(", ")}.`;
  }
  if (g === "rastro") {
    const base = String(v.url).replace(/\/+$/, "");
    const saude = await fetch(`${base}/saude`, { signal: AbortSignal.timeout(5000) }).catch(() => null);
    if (!saude?.ok) return "Salvo, mas o Rastro não respondeu nesse endereço. Ele está rodando? (npm run tudo)";
    const teste = await fetch(`${base}/nada`, { method: "POST", headers: { "x-rastro-token": String(v.token) }, signal: AbortSignal.timeout(5000) }).catch(() => null);
    return teste?.status === 401 ? "O Rastro está no ar, mas o token não confere." : "Rastro no ar e token certo.";
  }
  return "Salvo.";
}

export async function salvarIntegracaoAcao(g: GrupoId, p: string, _: ResultadoIntegracao, f: FormData): Promise<ResultadoIntegracao> {
  await exigirUsuario();
  const def = provedor(g, p);
  if (!def) return { ok: false, mensagem: "Conexão desconhecida." };
  const entrada: Valores = {};
  for (const c of def.campos) entrada[c.id] = c.tipo === "booleano" ? f.get(c.id) === "on" : String(f.get(c.id) ?? "");
  const falta = def.campos.find((c) => !c.opcional && !c.secreto && !String(entrada[c.id] ?? "").trim());
  if (falta) return { ok: false, mensagem: `Preencha: ${falta.rotulo}.` };
  await salvarIntegracao(g, p, entrada);
  const salvo = await integracao(g, p);
  const faltaSecreto = def.campos.find((c) => !c.opcional && c.secreto && !salvo?.[c.id]);
  if (faltaSecreto) return { ok: false, mensagem: `Preencha: ${faltaSecreto.rotulo}.` };
  revalidatePath("/", "layout");
  try {
    return { ok: true, mensagem: await testar(g, salvo!) };
  } catch (e) {
    return { ok: false, mensagem: e instanceof Error ? e.message : "Não deu para testar." };
  }
}

export async function apagarIntegracaoAcao(g: GrupoId, p: string) {
  await exigirUsuario();
  await apagarIntegracao(g, p);
  revalidatePath("/", "layout");
}
