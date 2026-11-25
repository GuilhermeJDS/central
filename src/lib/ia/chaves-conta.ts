/**
 * Chaves de IA da conta: salvar (só depois do teste), usar, apagar e listar.
 *
 * SEGURANÇA: `accountId` sempre da sessão. A chave aberta nunca sai daqui:
 * a tela recebe só provedor, últimos 4, modelo e data do teste. Nada de log
 * com a chave; os erros do provedor já chegam mascarados.
 */
import "server-only";

import { cifrar, decifrar, ultimos4 } from "@/lib/ia/cofre";
import { ErroProvedor, testarChave } from "@/lib/ia/provedores";
import { CATALOGO_IA, ehProvedorIA, type ProvedorIA } from "@/lib/ia/provedores/catalogo";
import { listarModelosAoVivo, type ModeloAoVivo } from "@/lib/ia/provedores/modelos-ao-vivo";
import { prisma } from "@/lib/prisma";

export type ChaveIaView = {
  provedor: ProvedorIA;
  ultimos4: string;
  modelo: string;
  /** ISO da última vez que o teste passou. */
  validaEm: string | null;
  /** A que os chefes usam agora (a testada mais recente). */
  ativa: boolean;
};

export type ResultadoChave = { ok: boolean; mensagem: string };

export type ResultadoModelos = { ok: true; modelos: ModeloAoVivo[] } | { ok: false; mensagem: string };

const MODELO_VALIDO = /^[\w.\-:/@]{2,100}$/;

export async function listarChaves(accountId: string): Promise<ChaveIaView[]> {
  const linhas = await prisma.chaveIa.findMany({
    where: { accountId },
    orderBy: [{ validaEm: { sort: "desc", nulls: "last" } }, { criadoEm: "desc" }],
    select: { provedor: true, ultimos4: true, modelo: true, validaEm: true },
  });
  const ativa = linhas.find((l) => l.validaEm)?.provedor ?? null;
  return linhas.map((l) => ({
    provedor: l.provedor,
    ultimos4: l.ultimos4,
    modelo: l.modelo,
    validaEm: l.validaEm?.toISOString() ?? null,
    ativa: l.provedor === ativa,
  }));
}

function motivo(e: unknown): string {
  if (e instanceof ErroProvedor) return e.message;
  return "Não deu para testar agora. Tente de novo em instantes.";
}

/** Testa e, se passou, grava cifrada como a chave ativa da conta. */
export async function salvarChave(
  accountId: string,
  provedorBruto: unknown,
  chaveBruta: unknown,
  modeloBruto: unknown,
): Promise<ResultadoChave> {
  if (!ehProvedorIA(provedorBruto)) return { ok: false, mensagem: "Escolha o provedor." };
  const provedor = provedorBruto;
  const chave = typeof chaveBruta === "string" ? chaveBruta.trim() : "";
  const modelo = typeof modeloBruto === "string" ? modeloBruto.trim() : "";
  if (chave.length < 10 || chave.length > 500 || /\s/.test(chave))
    return { ok: false, mensagem: "Cole a chave inteira, sem espaços." };
  if (!modelo) return { ok: false, mensagem: "Selecione o modelo." };
  if (!MODELO_VALIDO.test(modelo)) return { ok: false, mensagem: "Nome de modelo inválido." };

  try {
    await testarChave(provedor, chave, modelo);
  } catch (e) {
    return { ok: false, mensagem: motivo(e) };
  }

  const dados = { chaveCifrada: cifrar(chave), ultimos4: ultimos4(chave), modelo, validaEm: new Date() };
  await prisma.chaveIa.upsert({
    where: { accountId_provedor: { accountId, provedor } },
    create: { accountId, provedor, ...dados },
    update: dados,
  });
  return { ok: true, mensagem: `Funcionou. Os chefes já usam ${CATALOGO_IA[provedor].nome} com ${modelo}.` };
}

/** Modelo inicial do OpenRouter: o primeiro sugerido que existe na lista real. */
async function padraoOpenRouter(chave: string): Promise<string> {
  const texto = (await listarModelosAoVivo("OPENROUTER", chave).catch(() => [])).filter((m) => m.tipo === "texto").map((m) => m.id);
  const sugerido = CATALOGO_IA.OPENROUTER.modelos.find((m) => texto.includes(m));
  if (sugerido) return sugerido;
  // Família Sonnet mais nova que existir (a lista vem com os mais novos primeiro).
  return texto.find((m) => m.startsWith("anthropic/claude-sonnet")) ?? texto[0] ?? CATALOGO_IA.OPENROUTER.modeloPadrao;
}

/**
 * "Conectar com o OpenRouter": a chave veio da própria plataforma. Escolhe o
 * modelo sozinho e testa. Sem crédito na conta, guarda mesmo assim (fica
 * "Falhou no teste"): a pessoa põe crédito e clica em Testar.
 */
export async function conectarOpenRouter(accountId: string, chave: string): Promise<ResultadoChave> {
  const modelo = await padraoOpenRouter(chave);
  const r = await salvarChave(accountId, "OPENROUTER", chave, modelo);
  if (r.ok) return r;
  const dados = { chaveCifrada: cifrar(chave), ultimos4: ultimos4(chave), modelo, validaEm: null };
  await prisma.chaveIa.upsert({
    where: { accountId_provedor: { accountId, provedor: "OPENROUTER" } },
    create: { accountId, provedor: "OPENROUTER", ...dados },
    update: dados,
  });
  return {
    ok: false,
    mensagem: `OpenRouter conectado, mas o teste não passou: ${r.mensagem} Se for crédito, adicione em openrouter.ai/settings/credits e clique em Testar.`,
  };
}

/** Volta a usar uma chave já guardada: testa de novo e a marca como ativa. */
export async function usarChave(accountId: string, provedorBruto: unknown): Promise<ResultadoChave> {
  if (!ehProvedorIA(provedorBruto)) return { ok: false, mensagem: "Provedor desconhecido." };
  const linha = await prisma.chaveIa.findUnique({
    where: { accountId_provedor: { accountId, provedor: provedorBruto } },
    select: { id: true, chaveCifrada: true, modelo: true },
  });
  if (!linha) return { ok: false, mensagem: "Chave não encontrada." };
  try {
    await testarChave(provedorBruto, decifrar(linha.chaveCifrada), linha.modelo);
  } catch (e) {
    await prisma.chaveIa.update({ where: { id: linha.id }, data: { validaEm: null } });
    return { ok: false, mensagem: motivo(e) };
  }
  await prisma.chaveIa.update({ where: { id: linha.id }, data: { validaEm: new Date() } });
  return { ok: true, mensagem: `Funcionou. Os chefes voltaram a usar ${CATALOGO_IA[provedorBruto].nome}.` };
}

/**
 * "Testar" no painel: confere a chave guardada sem trocar qual está em uso.
 * Passou: só volta a valer se tinha falhado. Falhou: marca como inválida.
 */
export async function testarChaveGuardada(accountId: string, provedorBruto: unknown): Promise<ResultadoChave> {
  if (!ehProvedorIA(provedorBruto)) return { ok: false, mensagem: "Provedor desconhecido." };
  const linha = await prisma.chaveIa.findUnique({
    where: { accountId_provedor: { accountId, provedor: provedorBruto } },
    select: { id: true, chaveCifrada: true, modelo: true, validaEm: true },
  });
  if (!linha) return { ok: false, mensagem: "Chave não encontrada." };
  try {
    await testarChave(provedorBruto, decifrar(linha.chaveCifrada), linha.modelo);
  } catch (e) {
    await prisma.chaveIa.update({ where: { id: linha.id }, data: { validaEm: null } });
    return { ok: false, mensagem: motivo(e) };
  }
  if (!linha.validaEm) await prisma.chaveIa.update({ where: { id: linha.id }, data: { validaEm: new Date() } });
  return { ok: true, mensagem: `${CATALOGO_IA[provedorBruto].nome} respondeu com ${linha.modelo}.` };
}

export async function apagarChave(accountId: string, provedorBruto: unknown): Promise<ResultadoChave> {
  if (!ehProvedorIA(provedorBruto)) return { ok: false, mensagem: "Provedor desconhecido." };
  await prisma.chaveIa.deleteMany({ where: { accountId, provedor: provedorBruto } });
  return { ok: true, mensagem: "Chave apagada." };
}

// ---------------------------------------------------------------------------
// Lista de modelos ao vivo
// ---------------------------------------------------------------------------

/** Modelos que a chave recém-colada enxerga (antes de salvar). */
export async function modelosDaChaveNova(provedorBruto: unknown, chaveBruta: unknown): Promise<ResultadoModelos> {
  if (!ehProvedorIA(provedorBruto)) return { ok: false, mensagem: "Escolha o provedor." };
  const chave = typeof chaveBruta === "string" ? chaveBruta.trim() : "";
  if (chave.length < 10 || chave.length > 500 || /\s/.test(chave))
    return { ok: false, mensagem: "Cole a chave inteira, sem espaços." };
  try {
    return { ok: true, modelos: await listarModelosAoVivo(provedorBruto, chave, ultimos4(chave)) };
  } catch (e) {
    return { ok: false, mensagem: motivo(e) };
  }
}

/** Modelos da chave já guardada da conta (para o modelo de cada chefe). */
export async function modelosDaChaveSalva(accountId: string, provedorBruto: unknown): Promise<ResultadoModelos> {
  if (!ehProvedorIA(provedorBruto)) return { ok: false, mensagem: "Provedor desconhecido." };
  const linha = await prisma.chaveIa.findUnique({
    where: { accountId_provedor: { accountId, provedor: provedorBruto } },
    select: { chaveCifrada: true, ultimos4: true },
  });
  if (!linha) return { ok: false, mensagem: `Conecte a chave da ${CATALOGO_IA[provedorBruto].nome} antes.` };
  try {
    return {
      ok: true,
      modelos: await listarModelosAoVivo(provedorBruto, decifrar(linha.chaveCifrada), `${accountId}:${linha.ultimos4}`),
    };
  } catch (e) {
    return { ok: false, mensagem: motivo(e) };
  }
}

// ---------------------------------------------------------------------------
// Modelo de cada chefe
// ---------------------------------------------------------------------------

/** Chefes que chamam o modelo na Central (mesma ordem da barra lateral). */
export const CHEFES_COM_MODELO = [
  "Norte",
  "Inspetor Rastro",
  "Editora Pauta",
  "Negociador Trato",
  "Conselho",
  "Gerente Rotina",
] as const;

export type ModeloChefeView = { chefe: string; provedor: ProvedorIA; modelo: string };

export async function listarModelosChefe(accountId: string): Promise<ModeloChefeView[]> {
  const linhas = await prisma.modeloChefe.findMany({
    where: { accountId },
    select: { chefe: true, provedor: true, modelo: true },
  });
  return linhas.filter((l) => (CHEFES_COM_MODELO as readonly string[]).includes(l.chefe));
}

/**
 * `escolha` = "padrao" (volta ao modelo da chave ativa) ou "PROVEDOR|modelo".
 * Só aceita provedor com chave validada e modelo de texto que a chave enxerga
 * na lista ao vivo do provedor.
 */
export async function salvarModeloChefe(
  accountId: string,
  chefeBruto: unknown,
  escolhaBruta: unknown,
): Promise<ResultadoChave> {
  const chefe = typeof chefeBruto === "string" ? chefeBruto : "";
  if (!(CHEFES_COM_MODELO as readonly string[]).includes(chefe)) return { ok: false, mensagem: "Chefe desconhecido." };
  const escolha = typeof escolhaBruta === "string" ? escolhaBruta : "";
  if (escolha === "padrao") {
    await prisma.modeloChefe.deleteMany({ where: { accountId, chefe } });
    return { ok: true, mensagem: `${chefe} volta a usar o modelo padrão.` };
  }
  const [provedor, modelo] = escolha.split("|");
  if (!ehProvedorIA(provedor) || !modelo) return { ok: false, mensagem: "Escolha um modelo da lista." };
  const chave = await prisma.chaveIa.findFirst({
    where: { accountId, provedor, validaEm: { not: null } },
    select: { modelo: true },
  });
  if (!chave) return { ok: false, mensagem: `Conecte a chave da ${CATALOGO_IA[provedor].nome} antes.` };
  if (modelo !== chave.modelo) {
    const lista = await modelosDaChaveSalva(accountId, provedor);
    if (!lista.ok) return lista;
    const achado = lista.modelos.find((m) => m.id === modelo);
    if (!achado) return { ok: false, mensagem: "Esse modelo não aparece na lista do provedor." };
    if (achado.tipo !== "texto") return { ok: false, mensagem: "Os chefes escrevem: escolha um modelo de texto." };
  }
  await prisma.modeloChefe.upsert({
    where: { accountId_chefe: { accountId, chefe } },
    create: { accountId, chefe, provedor, modelo },
    update: { provedor, modelo },
  });
  return { ok: true, mensagem: `${chefe} agora usa ${modelo}.` };
}
