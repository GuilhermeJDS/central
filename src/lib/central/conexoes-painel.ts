/**
 * Conexões (painel): seguidores de cada rede conectada e quando foi lida.
 * Usa a mesma leitura com cache de 6 h dos chefes (lerRede); o "em" é a hora
 * da leitura de verdade, guardada junto no cache. Rede que falha ou demora
 * aparece sem número, sem derrubar a tela.
 */
import "server-only";

import { lerRede, type ConexaoView } from "@/lib/redes/contas";
import type { RedeConectavel } from "@/lib/redes/catalogo";
import * as googleEmpresa from "@/lib/redes/google-empresa";
import * as instagram from "@/lib/redes/instagram";
import * as linkedin from "@/lib/redes/linkedin";
import type { Conexao, Perfil } from "@/lib/redes/tipos";
import * as x from "@/lib/redes/x";
import * as youtube from "@/lib/redes/youtube";

export type LeituraRede = { seguidores: number | null; em: string };

const PERFIL: Record<RedeConectavel, (con: Conexao) => Promise<Perfil>> = {
  INSTAGRAM: instagram.perfil,
  YOUTUBE: youtube.canal,
  LINKEDIN: linkedin.perfil,
  X: x.perfil,
  GOOGLE_EMPRESA: googleEmpresa.perfilEmpresa,
};

const ESPERA_MS = 6000;

export async function leiturasDasRedes(
  accountId: string,
  conexoes: ConexaoView[],
): Promise<Partial<Record<RedeConectavel, LeituraRede>>> {
  const pares = await Promise.all(
    conexoes
      .filter((c) => c.validaEm)
      .map(async (c) => {
        const leitura = lerRede(accountId, c.rede, "painel", "", async (con): Promise<LeituraRede> => {
          const p = await PERFIL[c.rede](con);
          return { seguidores: p.seguidores, em: new Date().toISOString() };
        });
        const tempo = new Promise<null>((r) => setTimeout(() => r(null), ESPERA_MS));
        const v = await Promise.race([leitura, tempo]).catch(() => null);
        return [c.rede, v] as const;
      }),
  );
  return Object.fromEntries(pares.filter(([, v]) => v)) as Partial<Record<RedeConectavel, LeituraRede>>;
}
