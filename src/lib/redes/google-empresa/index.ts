/**
 * Coletor do Google Empresa (Perfil da Empresa no Google). Só servidor.
 *
 * Token OAuth do cliente com o escopo business.manage. APIs usadas:
 * Account Management (contas), Business Information (perfil) e a v4 do
 * My Business (avaliações). A Google libera cota dessas APIs só depois de
 * aprovar o pedido de acesso do projeto: sem isso, o erro diz exatamente isso.
 */
import "server-only";

import { erroGoogle, temEscopo, tokenGoogle } from "@/lib/redes/google";
import { campo, impressao, lista, pedir, texto } from "@/lib/redes/http";
import { reservar } from "@/lib/redes/limites";
import { ErroRede, numero, type Conexao, type Perfil, type ResultadoTeste } from "@/lib/redes/tipos";

const REDE = "GOOGLE_EMPRESA" as const;
const CONTAS = "https://mybusinessaccountmanagement.googleapis.com/v1";
const INFO = "https://mybusinessbusinessinformation.googleapis.com/v1";
const V4 = "https://mybusiness.googleapis.com/v4";
const MINUTO = 60_000;

async function get(tokenColado: string, url: string, api: string): Promise<unknown> {
  const chave = impressao(tokenColado);
  // A Google aceita ~300 req/min por projeto; aqui 30/min por conta.
  reservar(REDE, chave, 30, MINUTO);
  const t = await tokenGoogle(REDE, tokenColado);
  const r = await pedir(REDE, url, { headers: { Authorization: `Bearer ${t.acesso}` } });
  if (r.status === 429)
    throw new ErroRede(
      REDE,
      "limite",
      "a Google ainda não liberou cota da API do Perfil da Empresa para esse projeto (ou ela acabou por agora). Peça o acesso no formulário da Google e tente de novo.",
    );
  if (r.status >= 400) throw erroGoogle(REDE, r, [tokenColado, t.acesso], { oauth: true, api, chave });
  return r.corpo;
}

export async function testar(tokenBruto: string): Promise<ResultadoTeste> {
  const token = tokenBruto.trim().replace(/^Bearer\s+/i, "");
  try {
    const t = await tokenGoogle(REDE, token);
    if (!temEscopo(t, "business.manage", "plus.business.manage"))
      throw new ErroRede(REDE, "sem_permissao", "o token não tem o escopo business.manage. Gere de novo marcando essa permissão.");
    const contas = await get(token, `${CONTAS}/accounts`, "My Business Account Management API");
    const conta = texto(campo(lista(campo(contas, "accounts"))[0], "name"));
    if (!conta) throw new ErroRede(REDE, "nao_encontrado", "nenhuma conta do Perfil da Empresa nesse login do Google.");
    const locais = await get(
      token,
      `${INFO}/${conta}/locations?readMask=name,title&pageSize=10`,
      "My Business Business Information API",
    );
    const local = lista(campo(locais, "locations"))[0];
    const nomeLocal = texto(campo(local, "name"));
    if (!nomeLocal) throw new ErroRede(REDE, "nao_encontrado", "a conta não tem nenhuma empresa cadastrada no Google.");
    return {
      ok: true,
      // "accounts/1/locations/2": a v4 (avaliações) precisa das duas partes.
      conta: { id: `${conta}/${nomeLocal}`, nome: texto(campo(local, "title")) ?? nomeLocal, expiraEm: t.expiraEm },
      motivo: null,
    };
  } catch (e) {
    if (e instanceof ErroRede) return { ok: false, conta: null, motivo: e.message };
    return { ok: false, conta: null, motivo: "Google Empresa: não deu para testar agora. Tente de novo." };
  }
}

function local(con: Conexao): string {
  const m = con.contaExternaId.match(/(locations\/[\w-]+)$/);
  if (!m) throw new ErroRede(REDE, "entrada", "conexão antiga sem a empresa. Conecte de novo.");
  return m[1];
}

export type PerfilEmpresa = Perfil & {
  endereco: string | null;
  telefone: string | null;
  categoria: string | null;
};

export async function perfilEmpresa(con: Conexao): Promise<PerfilEmpresa> {
  const l = await get(
    con.token,
    `${INFO}/${local(con)}?readMask=title,storefrontAddress,websiteUri,phoneNumbers,categories,profile,metadata`,
    "My Business Business Information API",
  );
  const end = campo(l, "storefrontAddress");
  const endereco = [
    ...lista(campo(end, "addressLines")).filter((x): x is string => typeof x === "string"),
    texto(campo(end, "sublocality")),
    texto(campo(end, "locality")),
    texto(campo(end, "administrativeArea")),
  ]
    .filter(Boolean)
    .join(", ");
  return {
    id: con.contaExternaId,
    nome: texto(campo(l, "title")) ?? "Empresa no Google",
    usuario: null,
    seguidores: null,
    publicacoes: null,
    link: texto(campo(l, "metadata", "mapsUri")) ?? texto(campo(l, "websiteUri")),
    descricao: (texto(campo(l, "profile", "description")) ?? "").slice(0, 500) || null,
    endereco: endereco || null,
    telefone: texto(campo(l, "phoneNumbers", "primaryPhone")),
    categoria: texto(campo(l, "categories", "primaryCategory", "displayName")),
  };
}

export type Avaliacao = { autor: string; nota: number | null; texto: string; data: string | null; respondida: boolean };

export type Avaliacoes = { media: number | null; total: number | null; avaliacoes: Avaliacao[] };

const ESTRELAS: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };

/** Nota média, total e as 50 avaliações mais recentes. */
export async function avaliacoes(con: Conexao): Promise<Avaliacoes> {
  const d = await get(
    con.token,
    `${V4}/${con.contaExternaId}/reviews?pageSize=50&orderBy=${encodeURIComponent("updateTime desc")}`,
    "Google My Business API",
  );
  return {
    media: numero(campo(d, "averageRating")),
    total: numero(campo(d, "totalReviewCount")),
    avaliacoes: lista(campo(d, "reviews")).map((r) => ({
      autor: texto(campo(r, "reviewer", "displayName")) ?? "Cliente",
      nota: ESTRELAS[String(campo(r, "starRating"))] ?? null,
      texto: (texto(campo(r, "comment")) ?? "").slice(0, 600),
      data: texto(campo(r, "createTime")),
      respondida: !!campo(r, "reviewReply"),
    })),
  };
}
