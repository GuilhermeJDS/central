"use client";

import { LoaderCircle, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { mandarProBufferAcao } from "@/app/central/acoes-estudio";
import type { MarcaCarrossel } from "@/lib/central/carrossel";
import { desenharSlideEstudio } from "@/lib/central/estudio/desenho";
import type { SlideEstudio } from "@/lib/central/estudio/slide";

const fmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

/** Publicação: desenha os slides, sobe as imagens e manda o post para a fila do Buffer. */
export function MandarBuffer({
  entregaId,
  slides,
  marca,
  nomeNegocio,
  aprovada,
  buffer,
}: {
  entregaId: string;
  slides: SlideEstudio[];
  marca: MarcaCarrossel;
  nomeNegocio: string;
  aprovada: boolean;
  buffer: { enviadaEm: string | null; erro: string | null };
}) {
  const router = useRouter();
  const [fazendo, setFazendo] = useState<string | null>(null);
  const [r, setR] = useState<{ ok: boolean; mensagem: string } | null>(null);

  async function mandar() {
    setR(null);
    try {
      const urls: string[] = [];
      for (let i = 0; i < slides.length; i++) {
        setFazendo(`Desenhando o slide ${i + 1} de ${slides.length}…`);
        const c = document.createElement("canvas");
        await desenharSlideEstudio(c, slides[i], i, slides.length, marca, nomeNegocio);
        const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, "image/png"));
        if (!blob) throw new Error("Não deu para desenhar o slide.");
        const resp = await fetch("/api/central/imagem", { method: "POST", body: blob, headers: { "content-type": "image/png" } });
        const d = (await resp.json()) as { url?: string; erro?: string };
        if (!d.url) throw new Error(d.erro ?? "Não subiu a imagem.");
        urls.push(d.url);
      }
      setFazendo("Mandando para o Buffer…");
      setR(await mandarProBufferAcao(entregaId, urls));
      router.refresh();
    } catch (e) {
      setR({ ok: false, mensagem: e instanceof Error ? e.message : "Não foi." });
    } finally {
      setFazendo(null);
    }
  }

  return (
    <section className="cx-pp-secao" aria-labelledby="cx-pp-buffer">
      <h2 id="cx-pp-buffer" className="cx-pp-titulo">
        Publicar
      </h2>
      {buffer.enviadaEm ? <p className="cx-pp-meta">Na fila do Buffer desde {fmt.format(new Date(buffer.enviadaEm))}. Mudou a data depois? Ajuste no Buffer.</p> : null}
      {buffer.erro && !buffer.enviadaEm ? <p className="cx-aviso cx-aviso--erro">{buffer.erro}</p> : null}
      <button type="button" className="cx-botao cx-botao--azul cx-pp-largo" disabled={!!fazendo || !aprovada} onClick={mandar}>
        {fazendo ? <LoaderCircle size={16} className="cx-girando" aria-hidden="true" /> : <Send size={16} strokeWidth={1.8} aria-hidden="true" />}
        {fazendo ?? (buffer.enviadaEm ? "Mandar de novo" : "Mandar pro Buffer")}
      </button>
      {!aprovada ? <p className="cx-pp-meta">Aprove a peça para mandar.</p> : null}
      {r ? <p role={r.ok ? "status" : "alert"} className={`cx-aviso ${r.ok ? "cx-aviso--ok" : "cx-aviso--erro"}`}>{r.mensagem}</p> : null}
    </section>
  );
}
