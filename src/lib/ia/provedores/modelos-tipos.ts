/** Tipos da lista de modelos ao vivo (módulo puro: vai para a tela também). */
export type TipoModelo = "texto" | "imagem" | "outro";

export type ModeloAoVivo = { id: string; nome: string; tipo: TipoModelo };

export const ROTULO_TIPO: Record<TipoModelo, string> = {
  texto: "Texto",
  imagem: "Imagem",
  outro: "Áudio, embeddings e outros",
};
