/**
 * Renovação automática dos tokens longos do Instagram, antes de vencer.
 * Roda uma vez por dia pela rota /api/cron/renovar-tokens-redes.
 *
 * - Vence em até 10 dias → renova e grava o novo token (cifrado) e a data.
 * - Já venceu → marca como inválido (a tela pede para trocar).
 * - Token que a Meta não deixa renovar daqui (EAA… sem app) → fica como está.
 *
 * A Meta só renova token com mais de 24 h; com a janela de 10 dias isso nunca
 * é problema. Nada de token em log: só id da conexão e o motivo.
 */
import "server-only";

import { cifrar, decifrar } from "@/lib/ia/cofre";
import { limparCache } from "@/lib/redes/cache";
import * as instagram from "@/lib/redes/instagram";
import { tokenCaiu } from "@/lib/redes/tipos";
import { prisma } from "@/lib/prisma";

const JANELA_MS = 10 * 86_400_000;

export type ResumoRenovacao = { verificadas: number; renovadas: number; vencidas: number; falhas: number; semRenovacao: number };

export async function renovarTokensInstagram(): Promise<ResumoRenovacao> {
  const agora = new Date();
  const linhas = await prisma.contaConectada.findMany({
    where: { rede: "INSTAGRAM", validaEm: { not: null }, expiraEm: { not: null, lte: new Date(agora.getTime() + JANELA_MS) } },
    select: { id: true, accountId: true, tokenCifrado: true, appCifrado: true, expiraEm: true },
    take: 500,
  });
  const resumo: ResumoRenovacao = { verificadas: linhas.length, renovadas: 0, vencidas: 0, falhas: 0, semRenovacao: 0 };

  for (const l of linhas) {
    if (l.expiraEm && l.expiraEm <= agora) {
      await prisma.contaConectada.update({ where: { id: l.id }, data: { validaEm: null } });
      resumo.vencidas++;
      continue;
    }
    try {
      let app: { id: string; segredo: string } | null = null;
      try {
        app = l.appCifrado ? (JSON.parse(decifrar(l.appCifrado)) as { id: string; segredo: string }) : null;
      } catch {
        app = null;
      }
      const novo = await instagram.renovar(decifrar(l.tokenCifrado), app);
      if (!novo) {
        resumo.semRenovacao++;
        continue;
      }
      await prisma.contaConectada.update({
        where: { id: l.id },
        data: { tokenCifrado: cifrar(novo.token), expiraEm: novo.expiraEm, validaEm: new Date() },
      });
      limparCache(`${l.accountId}:INSTAGRAM:`);
      resumo.renovadas++;
    } catch (e) {
      resumo.falhas++;
      if (tokenCaiu(e)) await prisma.contaConectada.update({ where: { id: l.id }, data: { validaEm: null } });
      console.error(`[redes/renovar] conexão ${l.id}: ${e instanceof Error ? e.message : "erro"}`);
    }
  }
  return resumo;
}
