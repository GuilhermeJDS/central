/**
 * Trabalho depois da resposta: `after()` do Next dentro de uma requisição;
 * fora dela (scripts, testes de carga) roda solto na hora.
 */
import { after } from "next/server";

export function emSegundoPlano(trabalho: () => Promise<void>): void {
  try {
    after(trabalho);
  } catch {
    void trabalho().catch((e) => console.error("[central] trabalho em segundo plano falhou", e));
  }
}
