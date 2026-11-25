import "server-only";

import { ativo, configGeral } from "@/lib/config";
import { db } from "@/lib/db";

export class EmailIndisponivel extends Error {}

export async function enviarEmail(para: string, assunto: string, html: string) {
  const r = await ativo("email");
  if (!r?.valores.apiKey) throw new EmailIndisponivel("E-mail não configurado (Conexões → E-mail).");
  const { nomeSistema } = await configGeral();
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${r.valores.apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: String(r.valores.remetente || `${nomeSistema} <onboarding@resend.dev>`),
      to: [para],
      subject: assunto,
      html: `<div style="font:15px/1.6 -apple-system,Segoe UI,sans-serif;color:#151515;max-width:520px">${html}<p style="color:#777;font-size:13px;margin-top:32px">${nomeSistema}</p></div>`,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!resp.ok) throw new Error(`Resend respondeu ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
}

/** Aviso para todos os usuários da Central. */
export async function enviarEmailAdmin(assunto: string, html: string) {
  const usuarios = await db.user.findMany({ select: { email: true } });
  for (const u of usuarios) await enviarEmail(u.email, assunto, html);
}
