"use client";

/**
 * Mascotes da Central: a marca e os 7 chefes, feitos com o Open Bot Avatar
 * (github.com/DominikScholz/open-bot-avatar, MIT). Cada um é a silhueta do
 * símbolo do chefe com olhos: pino (Rastro), balão (Pauta), etiqueta (Trato),
 * coruja (Conselho), calendário (Rotina), bússola (Norte), lupa (Revisor).
 * As definições ficam em marca/mascotes/definicoes.json.
 *
 * O servidor desenha o SVG parado (sem piscar a tela). No navegador, os
 * grandes ganham vida: piscam, olham para o cursor e mostram o estado do
 * trabalho (pensando, trabalhando, pronto…). Os pequenos ficam parados.
 */
import { renderAvatarSvg, validateAvatar, type AvatarDefinition } from "open-bot-avatar";
import { useEffect, useMemo, useRef, useState } from "react";

import definicoes from "../../../marca/mascotes/definicoes.json";

export type IdMascote = "central" | "rastro" | "pauta" | "trato" | "conselho" | "rotina" | "norte" | "revisor";
export type EstadoMascote = "idle" | "thinking" | "working" | "waiting" | "blocked" | "done";

/** Tons do meio: funcionam no claro e no escuro. */
export const COR_MASCOTE: Record<IdMascote, string> = {
  central: "#2f6af7",
  rastro: "#0b8a7f",
  pauta: "#c23c86",
  trato: "#c96a12",
  conselho: "#4b50c4",
  rotina: "#24894a",
  norte: "#26262b",
  revisor: "#b23a48",
};
const OLHO: Partial<Record<IdMascote, string>> = { norte: "#f4f4f5" };

const DEFS = Object.fromEntries(
  Object.entries(definicoes).map(([id, d]) => {
    const v = validateAvatar(d);
    return [id, (v.ok ? v.value : d) as AvatarDefinition];
  }),
) as Record<IdMascote, AvatarDefinition>;

/** Abaixo disto o mascote fica parado (lista com dezenas deles não pesa). */
const VIVO_A_PARTIR = 48;

export function Mascote({
  id,
  tamanho = 48,
  estado = "idle",
  humor = "neutral",
  seguir = true,
  parado,
  rotulo,
  className,
}: {
  id: IdMascote;
  tamanho?: number;
  estado?: EstadoMascote;
  humor?: "neutral" | "happy";
  seguir?: boolean;
  /** Força parado (true) ou vivo (false). Padrão: vivo a partir de 48px. */
  parado?: boolean;
  /** Nome acessível; sem ele, decorativo. */
  rotulo?: string;
  className?: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [vivo, setVivo] = useState(false);
  const def = DEFS[id] ?? DEFS.central;
  const cor = COR_MASCOTE[id] ?? COR_MASCOTE.central;
  const olho = OLHO[id] ?? "#151515";
  const estatico = useMemo(() => renderAvatarSvg(def, { color: cor, eyeColor: olho, depth: 7, state: estado === "done" ? "idle" : estado, mood: humor }), [def, cor, olho, estado, humor]);
  const animar = parado === undefined ? tamanho >= VIVO_A_PARTIR : !parado;

  useEffect(() => {
    if (!animar || !host.current) return;
    let fim = false;
    let destruir: (() => void) | null = null;
    // O renderizador vivo só carrega quando precisa.
    void import("open-bot-avatar/dom").then(({ mountAvatar }) => {
      if (fim || !host.current) return;
      const a = mountAvatar(host.current, { definition: def, color: cor, eyeColor: olho, followPointer: seguir, state: estado, mood: humor, depth: 7, label: "" });
      destruir = () => a.destroy();
      setVivo(true);
      (host.current as HTMLDivElement & { __avatar?: typeof a }).__avatar = a;
    });
    return () => {
      fim = true;
      destruir?.();
      setVivo(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animar, id]);

  useEffect(() => {
    const a = (host.current as (HTMLDivElement & { __avatar?: { update: (o: object) => void } }) | null)?.__avatar;
    a?.update({ state: estado, mood: humor, followPointer: seguir });
  }, [estado, humor, seguir, vivo]);

  return (
    <span
      className={className ? `cx-mascote ${className}` : "cx-mascote"}
      style={{ width: tamanho, height: tamanho }}
      role={rotulo ? "img" : undefined}
      aria-label={rotulo}
      aria-hidden={rotulo ? undefined : true}
      data-mascote={id}
    >
      {!vivo ? <span dangerouslySetInnerHTML={{ __html: estatico }} /> : null}
      {animar ? <div ref={host} /> : null}
    </span>
  );
}
