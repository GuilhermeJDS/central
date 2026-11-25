/**
 * Rotina diária: renova os tokens longos do Instagram antes de vencer.
 * Mesmo padrão das outras rotas de /api/cron (CRON_SECRET por query ou Bearer).
 * Crontab do servidor, 1x por dia:
 *   15 6 * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://<dominio>/api/cron/renovar-tokens-redes
 */
import { NextResponse } from "next/server";

import { renovarTokensInstagram } from "@/lib/redes/renovar";

function autorizado(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const { searchParams } = new URL(request.url);
  if (searchParams.get("secret") === secret) return true;

  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;

  return false;
}

async function executar() {
  const inicio = Date.now();
  const instagram = await renovarTokensInstagram();
  return NextResponse.json({ instagram, timestamp: new Date().toISOString(), ms: Date.now() - inicio });
}

export async function GET(request: Request) {
  if (!autorizado(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return executar();
}

export async function POST(request: Request) {
  if (!autorizado(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return executar();
}
