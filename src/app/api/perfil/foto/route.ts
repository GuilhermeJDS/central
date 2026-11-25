import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { removeUploadedImage, saveImageBuffer } from "@/lib/uploads";
import { MAX_PROFILE_PHOTO_SIZE, PROFILE_PHOTO_MIME_HEADER, validateProfilePhotoFile } from "@/lib/user-profile-client";

export const runtime = "nodejs";

/** Foto do perfil: corpo cru da imagem (POST) ou remover (DELETE). */
export async function POST(req: Request) {
  const s = await auth();
  if (!s) return NextResponse.json({ error: "Entre de novo." }, { status: 401 });
  const bytes = Buffer.from(await req.arrayBuffer());
  const v = validateProfilePhotoFile({ type: req.headers.get(PROFILE_PHOTO_MIME_HEADER) ?? "", size: bytes.length });
  if (!v.ok) return NextResponse.json({ error: v.message }, { status: 400 });
  if (bytes.length > MAX_PROFILE_PHOTO_SIZE) return NextResponse.json({ error: "A imagem deve ter no máximo 5 MB." }, { status: 400 });
  try {
    const url = await saveImageBuffer(bytes, "perfil", "foto", { maxWidth: 512 });
    const antes = await prisma.user.findUnique({ where: { id: s.user.id }, select: { fotoPerfil: true } });
    await prisma.user.update({ where: { id: s.user.id }, data: { fotoPerfil: url } });
    await removeUploadedImage(antes?.fotoPerfil);
    return NextResponse.json({ fotoPerfil: url });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Não deu para salvar a foto." }, { status: 400 });
  }
}

export async function DELETE() {
  const s = await auth();
  if (!s) return NextResponse.json({ error: "Entre de novo." }, { status: 401 });
  const antes = await prisma.user.findUnique({ where: { id: s.user.id }, select: { fotoPerfil: true } });
  await prisma.user.update({ where: { id: s.user.id }, data: { fotoPerfil: null } });
  await removeUploadedImage(antes?.fotoPerfil);
  return NextResponse.json({ fotoPerfil: null });
}
