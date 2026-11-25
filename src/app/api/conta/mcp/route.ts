import { NextResponse } from "next/server";

import { ACOES_CONTA, acaoPorNome, ErroConta, esquemaJson, podeUsar } from "@/lib/api-conta/acoes";
import { autenticarConta, executarAcaoConta } from "@/lib/api-conta/executar";

/**
 * Servidor MCP da conta (transporte HTTP, sem sessão): JSON-RPC 2.0 no POST.
 * As ferramentas são as ações da API da conta que a chave alcança.
 * Autenticação: Authorization: Bearer kor_ct_… (Central › Conexões › API e MCP).
 */
export const dynamic = "force-dynamic";

const VERSOES = ["2025-06-18", "2025-03-26", "2024-11-05"];

type Pedido = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> };

const resposta = (id: Pedido["id"], result: unknown) => ({ jsonrpc: "2.0", id: id ?? null, result });
const falha = (id: Pedido["id"], code: number, message: string) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

export async function POST(req: Request) {
  let ctx;
  try {
    ctx = await autenticarConta(req);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Chave inválida.";
    return NextResponse.json(falha(null, -32001, msg), {
      status: 401,
      headers: { "WWW-Authenticate": 'Bearer realm="korely-conta"' },
    });
  }

  const bruto = await req.json().catch(() => undefined);
  if (bruto === undefined) return NextResponse.json(falha(null, -32700, "JSON inválido."), { status: 400 });
  const lote = Array.isArray(bruto) ? (bruto as Pedido[]) : [bruto as Pedido];

  const saidas: unknown[] = [];
  for (const p of lote) {
    const r = await tratar(ctx, p);
    if (r) saidas.push(r);
  }
  // Só notificações: 202 sem corpo.
  if (saidas.length === 0) return new Response(null, { status: 202 });
  return NextResponse.json(Array.isArray(bruto) ? saidas : saidas[0]);
}

async function tratar(ctx: Awaited<ReturnType<typeof autenticarConta>>, p: Pedido): Promise<unknown | null> {
  const notificacao = p.id === undefined;
  switch (p.method) {
    case "initialize": {
      const pedida = String(p.params?.protocolVersion ?? "");
      return resposta(p.id, {
        protocolVersion: VERSOES.includes(pedida) ? pedida : VERSOES[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "korely-conta", title: "Korely", version: "1.0.0" },
        instructions:
          "Ferramentas da conta Korely do cliente: ler decisões e entregas dos chefes, decidir, pedir trabalho e ver execuções. Comece por ler_conta.",
      });
    }
    case "ping":
      return notificacao ? null : resposta(p.id, {});
    case "tools/list":
      return resposta(p.id, {
        tools: ACOES_CONTA.filter((a) => podeUsar(ctx.chave, a)).map((a) => ({
          name: a.nome,
          description: a.descricao,
          inputSchema: esquemaJson(a),
          annotations: { readOnlyHint: a.metodo === "GET" },
        })),
      });
    case "tools/call": {
      const nome = String(p.params?.name ?? "");
      const acao = acaoPorNome(nome);
      if (!acao) return falha(p.id, -32602, `Ferramenta desconhecida: ${nome}`);
      try {
        const dados = await executarAcaoConta(ctx, acao, p.params?.arguments ?? {});
        return resposta(p.id, {
          content: [{ type: "text", text: JSON.stringify(dados, null, 2) }],
          structuredContent: dados && typeof dados === "object" && !Array.isArray(dados) ? dados : { resultado: dados },
          isError: false,
        });
      } catch (e) {
        const msg = e instanceof ErroConta ? e.message : "Falhou do nosso lado. Tente de novo.";
        if (!(e instanceof ErroConta)) console.error("[mcp-conta]", e);
        return resposta(p.id, { content: [{ type: "text", text: msg }], isError: true });
      }
    }
    default:
      if (notificacao) return null;
      return falha(p.id, -32601, `Método não suportado: ${p.method ?? "(vazio)"}`);
  }
}

export function GET() {
  return NextResponse.json(falha(null, -32000, "Use POST (MCP por HTTP, sem fluxo SSE)."), {
    status: 405,
    headers: { Allow: "POST" },
  });
}
