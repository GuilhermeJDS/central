import ReactMarkdown from "react-markdown";

/**
 * Resultado de um chefe formatado (títulos, listas, ênfase), nunca texto
 * cru e nunca HTML do modelo. `compacto` = dentro de uma carta.
 */
export function Resultado({ texto, compacto = false }: { texto: string; compacto?: boolean }) {
  return (
    <div className={compacto ? "cx-resultado cx-resultado--compacto" : "cx-resultado"}>
      <ReactMarkdown skipHtml>{texto}</ReactMarkdown>
    </div>
  );
}
