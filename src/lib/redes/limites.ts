/**
 * Limites das APIs, na memória do servidor: janela de chamadas por token,
 * cota diária (YouTube, em unidades) e bloqueio até o reset depois de um 429.
 * É uma proteção para não estourar a cota do cliente; a rede continua sendo
 * a fonte da verdade (o 429 dela também vira ErroRede "limite").
 */
import "server-only";

import type { RedeConectavel } from "@/lib/redes/catalogo";
import { ErroRede } from "@/lib/redes/tipos";

const janelas = new Map<string, number[]>();
const bloqueios = new Map<string, number>();
const cotas = new Map<string, { dia: string; usado: number }>();

function minutos(ms: number): string {
  const m = Math.max(1, Math.ceil(ms / 60_000));
  return m >= 60 ? `${Math.ceil(m / 60)} h` : `${m} min`;
}

function conferirBloqueio(rede: RedeConectavel, chave: string): void {
  const ate = bloqueios.get(chave);
  if (ate && ate > Date.now()) {
    throw new ErroRede(rede, "limite", `limite da API atingido. Tente de novo em ${minutos(ate - Date.now())}.`);
  }
  if (ate) bloqueios.delete(chave);
}

/** Reserva uma chamada na janela (ex.: 180 por hora por token). */
export function reservar(rede: RedeConectavel, chave: string, max: number, janelaMs: number): void {
  const k = `${rede}:${chave}`;
  conferirBloqueio(rede, k);
  const agora = Date.now();
  const recentes = (janelas.get(k) ?? []).filter((t) => agora - t < janelaMs);
  if (recentes.length >= max) {
    throw new ErroRede(rede, "limite", `muitas leituras seguidas. Tente de novo em ${minutos(janelaMs - (agora - recentes[0]))}.`);
  }
  recentes.push(agora);
  janelas.set(k, recentes);
}

/** A rede mandou parar (429): ninguém chama de novo até `ateMs`. */
export function bloquearAte(rede: RedeConectavel, chave: string, ateMs: number): void {
  bloqueios.set(`${rede}:${chave}`, ateMs);
}

/** Cota diária em unidades (dia no horário do Pacífico, como a do Google). */
export function gastarCota(rede: RedeConectavel, chave: string, unidades: number, maxDia: number): void {
  const k = `${rede}:${chave}`;
  conferirBloqueio(rede, k);
  const dia = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
  const atual = cotas.get(k);
  const usado = atual && atual.dia === dia ? atual.usado : 0;
  if (usado + unidades > maxDia) {
    throw new ErroRede(rede, "limite", "a cota diária da API acabou. Volta amanhã (zera às 4h ou 5h de Brasília).");
  }
  cotas.set(k, { dia, usado: usado + unidades });
}
