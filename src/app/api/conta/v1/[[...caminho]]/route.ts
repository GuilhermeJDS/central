import { NextResponse } from "next/server";

import { acaoPorRota, ErroConta } from "@/lib/api-conta/acoes";
import { autenticarConta, executarAcaoConta } from "@/lib/api-conta/executar";

/**
 * API da conta (o cliente com a própria chave cen_…). Cada ação de
 * lib/api-conta/acoes responde num método + caminho; o MCP em /api/conta/mcp
 * expõe as mesmas ações como ferramentas.
 */
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ caminho?: string[] }> };

async function responder(req: Request, { params }: Ctx, metodo: "GET" | "POST") {
  try {
    const { caminho = [] } = await params;
    const rota = acaoPorRota(metodo, caminho);
    if (!rota) throw new ErroConta(404, "rota_inexistente", "Rota não existe. GET /api/conta/v1 lista as ações.");
    const ctx = await autenticarConta(req);
    let entrada: Record<string, unknown> = { ...Object.fromEntries(new URL(req.url).searchParams) };
    if (metodo === "POST") {
      const corpo = await req.json().catch(() => undefined);
      if (corpo === undefined || typeof corpo !== "object" || Array.isArray(corpo))
        throw new ErroConta(400, "json_invalido", "Mande um corpo JSON (objeto).");
      entrada = { ...entrada, ...(corpo as Record<string, unknown>) };
    }
    const dados = await executarAcaoConta(ctx, rota.acao, { ...entrada, ...rota.params });
    return NextResponse.json(dados);
  } catch (e) {
    if (e instanceof ErroConta)
      return NextResponse.json({ erro: { codigo: e.codigo, mensagem: e.message } }, { status: e.status });
    console.error("[api-conta]", e);
    return NextResponse.json({ erro: { codigo: "interno", mensagem: "Falhou do nosso lado. Tente de novo." } }, { status: 500 });
  }
}

export function GET(req: Request, ctx: Ctx) {
  return responder(req, ctx, "GET");
}

export function POST(req: Request, ctx: Ctx) {
  return responder(req, ctx, "POST");
}
