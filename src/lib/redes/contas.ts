/**
 * Contas das redes do cliente: conectar (só depois do teste), apagar, listar
 * e ler com cache de 6 h.
 *
 * SEGURANÇA: `accountId` sempre da sessão. O token só existe decifrado na
 * memória durante a leitura; a tela recebe rede, conta, vencimento e data do
 * teste, nunca o token. Os erros dos coletores já chegam sem o token.
 */
import "server-only";

import type { RedeSocial } from "@/generated/prisma/client";
import { cifrar, decifrar } from "@/lib/ia/cofre";
import { gravarCache, lerCache, limparCache } from "@/lib/redes/cache";
import { tokenGoogle, type AppOAuth } from "@/lib/redes/google";
import { CATALOGO_REDES, ehRedeConectavel, type RedeConectavel } from "@/lib/redes/catalogo";
import * as googleEmpresa from "@/lib/redes/google-empresa";
import { impressao } from "@/lib/redes/http";
import { renovarRede, type TokensRede } from "@/lib/redes/oauth";
import * as instagram from "@/lib/redes/instagram";
import * as linkedin from "@/lib/redes/linkedin";
import { ErroRede, tokenCaiu, type Conexao, type ResultadoTeste } from "@/lib/redes/tipos";
import * as x from "@/lib/redes/x";
import * as youtube from "@/lib/redes/youtube";
import { prisma } from "@/lib/prisma";

export type ConexaoView = {
  rede: RedeConectavel;
  nome: string;
  contaExternaId: string;
  /** ISO; null = a rede não informa ou não vence. */
  expiraEm: string | null;
  /** ISO do último teste que passou; null = falhou (token caiu). */
  validaEm: string | null;
  /** YouTube: tem o token OAuth (retenção). */
  temOauth: boolean;
  /** Guardou as credenciais do app: o token renova sozinho na hora de usar. */
  renovaSozinho: boolean;
};

export type ResultadoConexao = { ok: boolean; mensagem: string };

export type CamposConexao = {
  token: unknown;
  oauth?: unknown;
  canal?: unknown;
  usuario?: unknown;
  /** Google: app OAuth do cliente (para o token de renovação 1//…). */
  clientId?: unknown;
  clientSecret?: unknown;
  /** Meta: app do cliente (para trocar o EAA por um token de 60 dias). */
  appId?: unknown;
  appSecret?: unknown;
};

export type ResultadoTesteConexao = ResultadoConexao & { conta?: string; expiraEm?: string | null };

function appDe(rede: RedeConectavel, c: CamposConexao): AppOAuth | null {
  const [id, segredo] =
    rede === "INSTAGRAM" ? [str(c.appId, 200), str(c.appSecret, 200)] : rede === "YOUTUBE" || rede === "GOOGLE_EMPRESA" ? [str(c.clientId, 300), str(c.clientSecret, 300)] : ["", ""];
  return id && segredo ? { id, segredo } : null;
}

function lerApp(cifrado: string | null): AppOAuth | null {
  if (!cifrado) return null;
  try {
    const j = JSON.parse(decifrar(cifrado)) as Partial<AppOAuth>;
    return j.id && j.segredo ? { id: j.id, segredo: j.segredo } : null;
  } catch {
    return null;
  }
}

/** Google: token de renovação (1//…) vira token de acesso (1 h) na hora, com o app do cliente. */
async function acessoGoogle(rede: RedeConectavel, token: string, app: AppOAuth | null): Promise<string> {
  if (!token.startsWith("1//")) return token;
  return (await tokenGoogle(rede, token, app)).acesso;
}

function str(v: unknown, max = 4000): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export async function listarConexoes(accountId: string): Promise<ConexaoView[]> {
  const linhas = await prisma.contaConectada.findMany({
    where: { accountId },
    select: {
      rede: true,
      nomeExibicao: true,
      contaExternaId: true,
      expiraEm: true,
      validaEm: true,
      refreshCifrado: true,
      appCifrado: true,
    },
  });
  return linhas.map((l) => ({
    rede: l.rede,
    nome: l.nomeExibicao,
    contaExternaId: l.contaExternaId,
    expiraEm: l.expiraEm?.toISOString() ?? null,
    validaEm: l.validaEm?.toISOString() ?? null,
    temOauth: !!l.refreshCifrado,
    renovaSozinho: !!l.appCifrado,
  }));
}

/** Redes com conexão válida (para o motor montar o cardápio). */
export async function redesConectadas(accountId: string): Promise<Set<RedeConectavel>> {
  const linhas = await prisma.contaConectada.findMany({
    where: { accountId, validaEm: { not: null } },
    select: { rede: true },
  });
  return new Set(linhas.map((l) => l.rede));
}

async function testarRede(rede: RedeConectavel, tokenBruto: string, c: CamposConexao): Promise<ResultadoTeste> {
  const app = appDe(rede, c);
  let token = tokenBruto;
  let oauth = str(c.oauth).replace(/^Bearer\s+/i, "");
  try {
    if (rede === "GOOGLE_EMPRESA") token = await acessoGoogle(rede, token, app);
    if (rede === "YOUTUBE" && oauth) oauth = await acessoGoogle(rede, oauth, app);
  } catch (e) {
    return { ok: false, conta: null, motivo: e instanceof Error ? e.message : "não deu para trocar o token de renovação." };
  }
  switch (rede) {
    case "INSTAGRAM":
      return instagram.testar(token);
    case "YOUTUBE":
      return youtube.testar(token, { canal: str(c.canal, 300) || null, oauth: oauth || null });
    case "LINKEDIN":
      return linkedin.testar(token);
    case "X":
      return x.testar(token, { usuario: str(c.usuario, 100) || null });
    case "GOOGLE_EMPRESA":
      return googleEmpresa.testar(token);
  }
}

/** Só testa (o botão "Testar" do guia): nada é gravado. */
export async function testarConexao(redeBruta: unknown, campos: CamposConexao): Promise<ResultadoTesteConexao> {
  if (!ehRedeConectavel(redeBruta)) return { ok: false, mensagem: "Escolha a rede." };
  const token = str(campos.token).replace(/^Bearer\s+/i, "");
  if (token.length < 20 || /\s/.test(token))
    return { ok: false, mensagem: `${CATALOGO_REDES[redeBruta].nome}: cole o token inteiro, sem espaços.` };
  const r = await testarRede(redeBruta, token, campos);
  if (!r.ok) return { ok: false, mensagem: r.motivo };
  return { ok: true, mensagem: `Funcionou: ${r.conta.nome}.`, conta: r.conta.nome, expiraEm: r.conta.expiraEm?.toISOString() ?? null };
}

/** Testa na hora e, se passou, grava cifrado (substitui a conexão anterior da rede). */
export async function conectarRede(
  accountId: string,
  redeBruta: unknown,
  campos: CamposConexao,
): Promise<ResultadoConexao> {
  if (!ehRedeConectavel(redeBruta)) return { ok: false, mensagem: "Escolha a rede." };
  const rede = redeBruta;
  const token = str(campos.token).replace(/^Bearer\s+/i, "");
  if (token.length < 20 || /\s/.test(token))
    return { ok: false, mensagem: `${CATALOGO_REDES[rede].nome}: cole o token inteiro, sem espaços.` };

  const r = await testarRede(rede, token, campos);
  if (!r.ok) return { ok: false, mensagem: r.motivo };

  const oauth = rede === "YOUTUBE" ? str(campos.oauth).replace(/^Bearer\s+/i, "") : "";
  const app = appDe(rede, campos);
  // Com token de renovação do Google, o que vale é ele (não vence); o de acesso do teste dura 1 h.
  const renovaGoogle = (rede === "GOOGLE_EMPRESA" && token.startsWith("1//")) || (rede === "YOUTUBE" && oauth.startsWith("1//"));
  const dados = {
    appCifrado: app ? cifrar(JSON.stringify(app)) : null,
    tokenCifrado: cifrar(token),
    refreshCifrado: oauth ? cifrar(oauth) : null,
    contaExternaId: r.conta.id,
    nomeExibicao: r.conta.nome.slice(0, 200),
    expiraEm: renovaGoogle ? null : r.conta.expiraEm,
    validaEm: new Date(),
  };
  await prisma.contaConectada.upsert({
    where: { accountId_rede: { accountId, rede } },
    create: { accountId, rede, ...dados },
    update: dados,
  });
  limparCache(`${accountId}:${rede}:`);
  return {
    ok: true,
    mensagem: `Funcionou. ${CATALOGO_REDES[rede].nome} conectado: ${r.conta.nome}.${app || renovaGoogle ? " O token renova sozinho na hora de usar." : ""}`,
  };
}

/**
 * "Conectar com…": os tokens vieram da própria plataforma (OAuth). Testa a
 * conta de verdade e grava cifrado, como no colar token.
 */
export async function conectarRedeOAuth(accountId: string, rede: RedeConectavel, t: TokensRede): Promise<ResultadoConexao> {
  let r: ResultadoTeste;
  switch (rede) {
    case "INSTAGRAM":
      r = await instagram.testar(t.token);
      break;
    case "YOUTUBE":
      r = await youtube.testarOAuth(t.token);
      break;
    case "LINKEDIN":
      r = await linkedin.testar(t.token);
      break;
    case "X":
      r = await x.testar(t.token);
      break;
    case "GOOGLE_EMPRESA":
      r = await googleEmpresa.testar(t.token);
      break;
  }
  if (!r.ok) return { ok: false, mensagem: r.motivo };
  const dados = {
    appCifrado: null,
    tokenCifrado: cifrar(t.token),
    refreshCifrado: t.refresh ? cifrar(t.refresh) : null,
    contaExternaId: r.conta.id,
    nomeExibicao: r.conta.nome.slice(0, 200),
    expiraEm: t.expiraEm,
    validaEm: new Date(),
  };
  await prisma.contaConectada.upsert({
    where: { accountId_rede: { accountId, rede } },
    create: { accountId, rede, ...dados },
    update: dados,
  });
  limparCache(`${accountId}:${rede}:`);
  return { ok: true, mensagem: `${CATALOGO_REDES[rede].nome} conectado: ${r.conta.nome}.` };
}

export async function apagarConexao(accountId: string, redeBruta: unknown): Promise<ResultadoConexao> {
  if (!ehRedeConectavel(redeBruta)) return { ok: false, mensagem: "Rede desconhecida." };
  await prisma.contaConectada.deleteMany({ where: { accountId, rede: redeBruta } });
  limparCache(`${accountId}:${redeBruta}:`);
  return { ok: true, mensagem: `${CATALOGO_REDES[redeBruta].nome} desconectado.` };
}

// ---------------------------------------------------------------------------
// Leitura com cache
// ---------------------------------------------------------------------------

const RENOVAR_ANTES_MS = 7 * 86_400_000;

/**
 * Abre a conexão para ler, renovando o token na hora de usar quando dá:
 * - Instagram: faltando 7 dias ou menos, troca por um novo de 60 dias (IG… pela
 *   Meta; EAA… com o app do cliente ou o da Korely) e grava.
 * - Google (YouTube OAuth e Google Empresa): token de renovação 1//… vira um
 *   de acesso novo a cada hora, com o app do cliente.
 * - Venceu e não tem como renovar: marca como caído (a tela pede um novo).
 */
async function abrir(accountId: string, rede: RedeSocial): Promise<{ id: string; con: Conexao }> {
  const l = await prisma.contaConectada.findUnique({
    where: { accountId_rede: { accountId, rede } },
    select: { id: true, tokenCifrado: true, refreshCifrado: true, appCifrado: true, contaExternaId: true, validaEm: true, expiraEm: true },
  });
  if (!l) throw new ErroRede(rede, "entrada", "não está conectado. Conecte em Conexões.");
  if (!l.validaEm) throw new ErroRede(rede, "token_vencido", "o token parou de funcionar. Renove em Conexões → Como pegar o token.");
  let token = decifrar(l.tokenCifrado);
  let refresh = l.refreshCifrado ? decifrar(l.refreshCifrado) : null;
  const app = lerApp(l.appCifrado);
  const agora = Date.now();

  if (rede === "INSTAGRAM" && l.expiraEm && l.expiraEm.getTime() - agora < RENOVAR_ANTES_MS) {
    const venceu = l.expiraEm.getTime() <= agora;
    const novo = venceu ? null : await instagram.renovar(token, app).catch(() => null);
    if (novo) {
      token = novo.token;
      await prisma.contaConectada.update({ where: { id: l.id }, data: { tokenCifrado: cifrar(novo.token), expiraEm: novo.expiraEm, validaEm: new Date() } });
      limparCache(`${accountId}:${rede}:`);
    } else if (venceu) {
      await prisma.contaConectada.update({ where: { id: l.id }, data: { validaEm: null } });
      throw new ErroRede(rede, "token_vencido", "o token venceu. Renove em Conexões → Como pegar o token.");
    }
  } else if ((rede === "X" || rede === "LINKEDIN") && refresh && l.expiraEm && l.expiraEm.getTime() - agora < 5 * 60_000) {
    // Conectado pelo "Conectar com…": renova com o refresh na hora de usar.
    const novo = await renovarRede(rede, refresh);
    if (!novo) {
      if (l.expiraEm.getTime() <= agora) {
        await prisma.contaConectada.update({ where: { id: l.id }, data: { validaEm: null } });
        throw new ErroRede(rede, "token_vencido", "a autorização venceu. Conecte de novo em Conexões.");
      }
    } else {
      token = novo.token;
      refresh = novo.refresh;
      await prisma.contaConectada.update({
        where: { id: l.id },
        data: { tokenCifrado: cifrar(novo.token), refreshCifrado: novo.refresh ? cifrar(novo.refresh) : null, expiraEm: novo.expiraEm, validaEm: new Date() },
      });
    }
  } else if (rede !== "INSTAGRAM" && l.expiraEm && l.expiraEm.getTime() <= agora) {
    await prisma.contaConectada.update({ where: { id: l.id }, data: { validaEm: null } });
    throw new ErroRede(rede, "token_vencido", "o token venceu. Renove em Conexões → Como pegar o token.");
  }

  if (rede === "GOOGLE_EMPRESA") token = await acessoGoogle(rede, token, app);
  if (rede === "YOUTUBE" && refresh) refresh = await acessoGoogle(rede, refresh, app);
  return { id: l.id, con: { token, refresh, contaExternaId: l.contaExternaId } };
}

/**
 * Lê da rede com cache de 6 h. Se o token caiu (inválido/vencido), marca a
 * conexão como inválida para a tela pedir a troca.
 */
export async function lerRede<T>(
  accountId: string,
  rede: RedeConectavel,
  leitura: string,
  param: string,
  fn: (con: Conexao) => Promise<T>,
): Promise<T> {
  const chave = `${accountId}:${rede}:${leitura}:${impressao(param.toLowerCase())}`;
  const emCache = lerCache<T>(chave);
  if (emCache !== undefined) return emCache;
  let aberto: { id: string; con: Conexao };
  try {
    aberto = await abrir(accountId, rede);
  } catch (e) {
    // Renovação recusada (token de renovação revogado): pede um novo.
    if (tokenCaiu(e)) await prisma.contaConectada.updateMany({ where: { accountId, rede }, data: { validaEm: null } });
    throw e;
  }
  const { id, con } = aberto;
  try {
    const valor = await fn(con);
    gravarCache(chave, valor);
    return valor;
  } catch (e) {
    if (tokenCaiu(e)) await prisma.contaConectada.update({ where: { id }, data: { validaEm: null } });
    throw e;
  }
}
