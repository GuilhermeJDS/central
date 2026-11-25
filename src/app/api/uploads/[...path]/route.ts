import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Serve o que está na tabela arquivos. Público: o Buffer e as redes baixam daqui. */
export async function GET(_request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path: segmentos } = await context.params;
  const caminho = segmentos.map((s) => decodeURIComponent(s)).join("/");
  if (!caminho || caminho.includes("..")) return new NextResponse("Não encontrado", { status: 404 });
  const a = await prisma.arquivo.findUnique({ where: { caminho } });
  if (!a) return new NextResponse("Não encontrado", { status: 404 });
  const imagem = a.tipo.startsWith("image/") && a.tipo !== "image/svg+xml";
  return new NextResponse(new Uint8Array(a.dados), {
    status: 200,
    headers: {
      "Content-Type": a.tipo,
      "Content-Length": String(a.tamanho),
      // O caminho tem um UUID: o conteúdo nunca muda.
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      ...(imagem ? {} : { "Content-Disposition": "attachment" }),
    },
  });
}
