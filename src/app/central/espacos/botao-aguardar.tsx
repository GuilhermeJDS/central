"use client";
import { useFormStatus } from "react-dom";

export function BotaoAguardar({ normal, aguardando }: { normal: string; aguardando: string }) {
  const { pending } = useFormStatus();
  return <button className="cx-botao cx-botao--azul" type="submit" disabled={pending} aria-busy={pending}>{pending ? aguardando : normal}</button>;
}