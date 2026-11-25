"use client";

import { Check, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";

export type ItemPedagio = { id: string; titulo: string; texto: string; acao: string; link: string };

const CHAVE = "central:pedagio";

/** Os itens do pedágio, com "pago" guardado neste navegador. */
export function ListaPedagio({ itens }: { itens: ItemPedagio[] }) {
  const [pagos, setPagos] = useState<string[]>([]);
  useEffect(() => {
    try {
      setPagos(JSON.parse(localStorage.getItem(CHAVE) ?? "[]"));
    } catch {
      /* sem armazenamento */
    }
  }, []);
  const marcar = (id: string, sim = true) =>
    setPagos((atual) => {
      const novo = sim ? [...new Set([...atual, id])] : atual.filter((x) => x !== id);
      try {
        localStorage.setItem(CHAVE, JSON.stringify(novo));
      } catch {
        /* sem armazenamento */
      }
      return novo;
    });
  const total = itens.filter((i) => pagos.includes(i.id)).length;
  return (
    <div className="cx-pedagio-lista">
      <p className="cx-pedagio-placar">
        {total === itens.length ? "Pedágio pago. Boa sorte com a empresa!" : `${total} de ${itens.length} pagos`}
      </p>
      <ul>
        {itens.map((i) => {
          const pago = pagos.includes(i.id);
          return (
            <li key={i.id} data-pago={pago ? "true" : undefined}>
              <div>
                <strong>{i.titulo}</strong>
                <span className="cx-dica">{i.texto}</span>
              </div>
              {pago ? (
                <button type="button" className="cx-pedagio-ok" onClick={() => marcar(i.id, false)} aria-label={`Desmarcar: ${i.titulo}`}>
                  <Check size={18} strokeWidth={3} aria-hidden="true" />
                </button>
              ) : (
                <a href={i.link} target="_blank" rel="noreferrer" onClick={() => marcar(i.id)} className="cx-botao cx-botao--azul">
                  {i.acao} <ExternalLink size={15} aria-hidden="true" />
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
