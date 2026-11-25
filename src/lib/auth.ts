import "server-only";

import { usuarioAtual } from "@/lib/sessao";

/**
 * O formato de sessão que o código da Central espera (era o NextAuth do
 * sistema de origem). Aqui é o cookie assinado de lib/sessao: um usuário, uma empresa.
 */
export type Sessao = {
  user: { id: string; accountId: string; name: string; email: string; role: Papel };
};

/**
 * Papel que o código herdado do sistema de origem confere. Aqui quem entra é sempre o
 * dono da empresa (CLIENT_ADMIN); SUPER_ADMIN não existe na versão aberta.
 */
export type Papel = "CLIENT_ADMIN" | "SUPER_ADMIN";

export async function auth(): Promise<Sessao | null> {
  const u = await usuarioAtual();
  if (!u) return null;
  return { user: { id: u.id, accountId: u.accountId, name: u.nome, email: u.email, role: "CLIENT_ADMIN" as Papel } };
}
