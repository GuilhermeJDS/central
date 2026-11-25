/**
 * Qual chave de IA roda os chefes desta conta na Central.
 *
 * SÓ a chave do próprio cliente (modelo do chefe → chave validada mais
 * recente). A Central nunca usa a chave do ambiente (.env), em nenhum caso (nem
 * SUPER_ADMIN, nem dev local): sem chave conectada → SemChaveIA, e a tela
 * abre "Conecte a sua chave de IA". O painel da unidade é separado: passa
 * sempre credencialAmbientePainel explicitamente.
 *
 * A chave decifrada fica só na memória do servidor durante a chamada.
 */
import "server-only";

import { decifrar } from "@/lib/ia/cofre";
import { SemChaveIA, type Credencial } from "@/lib/ia/credencial-base";
import { prisma } from "@/lib/prisma";

export {
  credencialAmbiente,
  credencialAmbientePainel,
  MENSAGEM_SEM_CHAVE,
  modeloDe,
  SemChaveIA,
  type Credencial,
  type OrigemChave,
} from "@/lib/ia/credencial-base";

/** A chave ativa da conta (a validada mais recente), ainda cifrada. */
async function chaveAtiva(accountId: string) {
  return prisma.chaveIa.findFirst({
    where: { accountId, validaEm: { not: null } },
    orderBy: { validaEm: "desc" },
    select: { provedor: true, chaveCifrada: true, modelo: true },
  });
}

export async function temChaveConectada(accountId: string): Promise<boolean> {
  return (await prisma.chaveIa.count({ where: { accountId, validaEm: { not: null } } })) > 0;
}

export async function chaveDoCliente(accountId: string): Promise<Credencial | null> {
  const c = await chaveAtiva(accountId);
  if (!c) return null;
  return { provedor: c.provedor, chave: decifrar(c.chaveCifrada), modelo: c.modelo, origem: "cliente" };
}

/**
 * O modelo escolhido para um chefe (Conexões → Modelo de cada chefe), se a
 * chave daquele provedor estiver validada. null = usa o padrão da conta.
 */
async function chaveDoChefe(accountId: string, chefe: string): Promise<Credencial | null> {
  const escolha = await prisma.modeloChefe.findUnique({
    where: { accountId_chefe: { accountId, chefe } },
    select: { provedor: true, modelo: true },
  });
  if (!escolha) return null;
  const chave = await prisma.chaveIa.findFirst({
    where: { accountId, provedor: escolha.provedor, validaEm: { not: null } },
    select: { chaveCifrada: true },
  });
  if (!chave) return null;
  return { provedor: escolha.provedor, chave: decifrar(chave.chaveCifrada), modelo: escolha.modelo, origem: "cliente" };
}

/**
 * Modelo do chefe (se escolhido) → chave do cliente → SemChaveIA.
 * Sem `chefe` (ou sem escolha), todos usam o mesmo: a chave ativa.
 * Nunca cai na chave do ambiente (.env).
 */
export async function credencialDaConta(accountId: string, chefe?: string): Promise<Credencial> {
  const doChefe = chefe ? await chaveDoChefe(accountId, chefe) : null;
  const c = doChefe ?? (await chaveDoCliente(accountId));
  if (!c) throw new SemChaveIA();
  return c;
}
