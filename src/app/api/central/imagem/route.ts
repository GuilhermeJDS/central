import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { saveImageBuffer } from "@/lib/uploads";

export const runtime = "nodejs";

/** Recebe um slide desenhado no navegador (PNG cru) e devolve a URL pública. */
export async function POST(req: Request) {
  if (!(await auth())) return NextResponse.json({ erro: "Entre de novo." }, { status: 401 });
  const bytes = Buffer.from(await req.arrayBuffer());
  if (!bytes.length || bytes.length > 8 * 1024 * 1024) return NextResponse.json({ erro: "Imagem vazia ou grande demais." }, { status: 400 });
  try {
    const url = await saveImageBuffer(bytes, "buffer", "slide", { maxWidth: 1080 });
    return NextResponse.json({ url });
  } catch (e) {
    return NextResponse.json({ erro: e instanceof Error ? e.message : "Não salvou." }, { status: 400 });
  }
}
