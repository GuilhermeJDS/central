"use client";

/**
 * Marca › Biblioteca de imagens. Estrutura dominante: o mural de fotos.
 * Gerar (modelo do cliente), enviar e apagar da biblioteca.
 */
import { LoaderCircle, Sparkles, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { apagarImagemAcao, enviarImagemMarcaAcao, gerarImagemAcao } from "@/app/central/acoes-estudio";
import type { ImagemView } from "@/lib/central/estudio/imagens";

type Filtro = "todas" | "GERADA" | "ENVIADA";
const fmtDia = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "numeric", month: "short" });

export function BibliotecaImagens({ imagens, provedores }: { imagens: ImagemView[]; provedores: string[] }) {
  const router = useRouter();
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [cena, setCena] = useState("");
  const [ocupado, setOcupado] = useState<"gerar" | "enviar" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState<string | null>(null);
  const [, iniciar] = useTransition();
  const arquivo = useRef<HTMLInputElement>(null);
  const conta = { todas: imagens.length, GERADA: imagens.filter((i) => i.origem === "GERADA").length, ENVIADA: imagens.filter((i) => i.origem === "ENVIADA").length };
  const visiveis = imagens.filter((i) => filtro === "todas" || i.origem === filtro);

  return (
    <div className="cx-imagens">
      <div className="cx-imagens-criar">
        <form
          className="cx-imagens-gerar"
          onSubmit={async (e) => {
            e.preventDefault();
            setErro(null);
            setOcupado("gerar");
            const r = await gerarImagemAcao({ cena });
            setOcupado(null);
            if (r.erro !== null) setErro(r.erro);
            else {
              setCena("");
              router.refresh();
            }
          }}
        >
          <label className="cx-campo">
            <span className="cx-campo-rotulo">Gerar uma imagem</span>
            <input
              className="cx-input"
              value={cena}
              maxLength={600}
              onChange={(e) => setCena(e.target.value)}
              placeholder="Ex.: esteticista aplicando máscara de argila numa cliente deitada"
              disabled={!provedores.length}
            />
          </label>
          <button type="submit" className="cx-botao cx-botao--azul" disabled={!provedores.length || cena.trim().length < 3 || !!ocupado}>
            {ocupado === "gerar" ? <LoaderCircle size={16} className="cx-girando" aria-hidden="true" /> : <Sparkles size={16} strokeWidth={1.8} aria-hidden="true" />}
            {ocupado === "gerar" ? "Gerando…" : "Gerar"}
          </button>
        </form>
        <button type="button" className="cx-botao cx-botao--branco" onClick={() => arquivo.current?.click()} disabled={!!ocupado}>
          {ocupado === "enviar" ? <LoaderCircle size={16} className="cx-girando" aria-hidden="true" /> : <Upload size={16} strokeWidth={1.8} aria-hidden="true" />}
          Enviar foto
        </button>
        <input
          ref={arquivo}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="cx-so-leitor"
          tabIndex={-1}
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            setErro(null);
            setOcupado("enviar");
            const form = new FormData();
            form.set("imagem", f);
            const r = await enviarImagemMarcaAcao(form);
            setOcupado(null);
            if (r.erro !== null) setErro(r.erro);
            else router.refresh();
          }}
        />
      </div>
      {!provedores.length ? (
        <p className="cx-pp-meta">
          Para gerar, conecte uma chave da OpenAI ou do Gemini em <Link href="/central/conexoes">Conexões</Link>. O estilo vem da{" "}
          <Link href="/central/redes/marca">Identidade</Link>.
        </p>
      ) : (
        <p className="cx-pp-meta">
          Gera com {provedores.join(" / ")} no estilo da <Link href="/central/redes/marca">Identidade</Link>.
        </p>
      )}
      {erro ? (
        <p role="alert" className="cx-aviso cx-aviso--erro">
          {erro}
        </p>
      ) : null}

      <div className="cx-filtros" role="group" aria-label="Filtrar imagens">
        {(
          [
            ["todas", "Todas"],
            ["GERADA", "Geradas"],
            ["ENVIADA", "Enviadas"],
          ] as const
        ).map(([k, r]) => (
          <button key={k} type="button" className="cx-filtro" aria-pressed={filtro === k} onClick={() => setFiltro(k)}>
            {r} <span className="cx-filtro-conta">{conta[k]}</span>
          </button>
        ))}
      </div>

      {visiveis.length ? (
        <ul className="cx-mural">
          {visiveis.map((im) => (
            <li key={im.id} className="cx-mural-item">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={im.url} alt={im.prompt ?? "Imagem enviada"} loading="lazy" />
              <div className="cx-mural-info">
                <span className="cx-mural-origem">
                  {im.origem === "GERADA" ? <Sparkles size={13} strokeWidth={1.8} aria-hidden="true" /> : <Upload size={13} strokeWidth={1.8} aria-hidden="true" />}
                  {im.origem === "GERADA" ? `Gerada${im.provedor ? ` · ${im.provedor === "OPENAI" ? "OpenAI" : "Gemini"}` : ""}` : "Enviada"} · {fmtDia.format(new Date(im.em)).replace(".", "")}
                </span>
                {im.prompt ? <span className="cx-mural-prompt">{im.prompt}</span> : null}
              </div>
              <button
                type="button"
                className="cx-mural-apagar"
                data-confirmar={confirmar === im.id ? "" : undefined}
                aria-label={confirmar === im.id ? "Confirmar: tirar da biblioteca" : "Tirar da biblioteca"}
                onClick={() => {
                  if (confirmar !== im.id) {
                    setConfirmar(im.id);
                    return;
                  }
                  iniciar(async () => {
                    await apagarImagemAcao(im.id);
                    setConfirmar(null);
                    router.refresh();
                  });
                }}
                onBlur={() => setConfirmar((c) => (c === im.id ? null : c))}
              >
                <Trash2 size={15} strokeWidth={1.8} aria-hidden="true" />
                {confirmar === im.id ? <span>Tirar?</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="cx-biblioteca-nada">
          <p>{imagens.length ? "Nada neste filtro." : "Nenhuma imagem ainda. Gere a primeira ou envie uma foto do studio."}</p>
        </div>
      )}
    </div>
  );
}
