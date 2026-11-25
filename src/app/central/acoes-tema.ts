"use server";

/**
 * Tema da Central (claro/escuro). Salva no mesmo campo do tema do painel
 * (User.temaPanel), então a escolha vale nos dois lugares.
 */
import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function salvarTemaCentral(tema: "claro" | "escuro"): Promise<{ ok: boolean }> {
  if (tema !== "claro" && tema !== "escuro") return { ok: false };
  const session = await auth();
  if (!session?.user?.id) return { ok: false };
  await prisma.user.update({
    where: { id: session.user.id },
    data: { temaPanel: tema, temaEscuro: tema === "escuro" },
  });
  revalidatePath("/central", "layout");
  return { ok: true };
}
