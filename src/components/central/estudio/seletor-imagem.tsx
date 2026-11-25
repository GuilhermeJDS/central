"use client";

/**
 * Imagem do slide: gerar com o modelo de imagem do cliente (mesmo estilo e
 * personagem da Identidade em toda a peça), escolher da Biblioteca ou enviar.
 */
import { ImagePlus, Images, LoaderCircle, Sparkles, Upload, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { enviarImagemMarcaAcao, gerarImagemAcao, listarImagensAcao } from "@/app/central/acoes-estudio";
import { useTrava } from "@/components/central/trava";
import type { ApiVisualizador } from "@/components/central/estudio/visualizador";
import { tamanho } from "@/lib/central/carrossel";
import type { ImagemView } from "@/lib/central/estudio/imagens";
import { novoIdElemento, type SlideEstudio } from "@/lib/central/estudio/slide";

type Aba = "gerar" | "biblioteca" | "enviar";

/** Põe a imagem no slide: troca a imagem que já existe ou vira fundo (texto em branco). */
export function comImagem(s: SlideEstudio, url: string, W: number, H: number, selecionadoId?: string | null): SlideEstudio {
  const els = s.elementos ?? [];
  const alvo = els.find((e) => e.tipo === "imagem" && e.id === selecionadoId) ?? els.find((e) => e.tipo === "imagem");
  if (alvo) return { ...s, imagem: url, elementos: els.map((e) => (e.id === alvo.id ? { ...e, url } : e)) };
  return {
    ...s,
    imagem: url,
    elementos: [
      { id: novoIdElemento(), tipo: "imagem", x: 0, y: 0, w: W, h: H, url, escurecer: true },
      ...els.map((e) => (e.tipo === "titulo" || e.tipo === "texto" ? { ...e, cor: "branco" as const } : e)),
    ],
  };
}

export function SeletorImagem({ api, provedores }: { api: ApiVisualizador; provedores: string[] }) {
  const [aberto, setAberto] = useState(false);
  const { bloquear } = useTrava();
  const [aba, setAba] = useState<Aba>("gerar");
  const slide = api.estado.slides[api.indice];
  const [cena, setCena] = useState("");
  const [gerando, setGerando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [imagens, setImagens] = useState<ImagemView[] | null>(null);
  const arquivo = useRef<HTMLInputElement>(null);
  const { w: W, h: H } = tamanho(api.estado.marca.formato);
  const temProvedor = provedores.length > 0;

  useEffect(() => {
    if (!aberto || aba !== "biblioteca" || imagens) return;
    let vivo = true;
    listarImagensAcao().then((r) => {
      if (!vivo) return;
      if (r.erro !== null) setErro(r.erro);
      else setImagens(r.imagens);
    });
    return () => {
      vivo = false;
    };
  }, [aberto, aba, imagens]);

  function abrir() {
    if (!aberto && bloquear()) return;
    setAberto((a) => !a);
    setErro(null);
    setCena(slide?.imagemDica || slide?.titulo || "");
  }

  function aplicar(indice: number, url: string) {
    api.mudarSlides((lista) => lista.map((s, i) => (i === indice ? comImagem(s, url, W, H, api.selecionado?.id) : s)));
  }

  async function gerarUm(indice: number, texto: string): Promise<boolean> {
    const r = await gerarImagemAcao({ cena: texto, entregaId: api.peca.id });
    if (r.erro !== null) {
      setErro(r.erro);
      return false;
    }
    aplicar(indice, r.url);
    setImagens(null);
    return true;
  }

  async function gerarEste() {
    setErro(null);
    setGerando("este");
    await gerarUm(api.indice, cena.trim() || slide.titulo);
    setGerando(null);
  }

  async function gerarTodos() {
    setErro(null);
    for (const [i, s] of api.estado.slides.entries()) {
      setGerando(`${i + 1}/${api.estado.slides.length}`);
      api.irPara(i);
      const ok = await gerarUm(i, s.imagemDica || s.titulo);
      if (!ok) break;
    }
    setGerando(null);
  }

  return (
    <div className="cx-img">
      <button type="button" className="cx-ed-botao" onClick={abrir} aria-expanded={aberto}>
        <ImagePlus size={17} strokeWidth={1.8} aria-hidden="true" /> Imagem
      </button>
      {aberto ? (
        <div className="cx-img-caixa" role="dialog" aria-label="Imagem do slide">
          <div className="cx-img-topo">
            <div className="cx-img-abas" role="tablist" aria-label="De onde vem a imagem">
              {(
                [
                  ["gerar", "Gerar", Sparkles],
                  ["biblioteca", "Biblioteca", Images],
                  ["enviar", "Enviar", Upload],
                ] as const
              ).map(([a, rotulo, Icone]) => (
                <button key={a} type="button" role="tab" aria-selected={aba === a} onClick={() => setAba(a)}>
                  <Icone size={15} strokeWidth={1.8} aria-hidden="true" /> {rotulo}
                </button>
              ))}
            </div>
            <button type="button" className="cx-ed-icone" onClick={() => setAberto(false)} aria-label="Fechar">
              <X size={17} strokeWidth={1.8} aria-hidden="true" />
            </button>
          </div>

          {aba === "gerar" ? (
            temProvedor ? (
              <div className="cx-img-corpo">
                <label className="cx-campo">
                  <span className="cx-campo-rotulo">O que a imagem do slide {api.indice + 1} mostra</span>
                  <textarea className="cx-input" rows={3} maxLength={600} value={cena} onChange={(e) => setCena(e.target.value)} />
                </label>
                <p className="cx-pp-meta">
                  Estilo e personagem da <Link href="/central/redes/marca">Identidade</Link>, iguais em toda a peça.
                </p>
                <div className="cx-img-acoes">
                  <button type="button" className="cx-botao cx-botao--azul" onClick={gerarEste} disabled={!!gerando || cena.trim().length < 3}>
                    {gerando === "este" ? <LoaderCircle size={16} className="cx-girando" aria-hidden="true" /> : <Sparkles size={16} strokeWidth={1.8} aria-hidden="true" />}
                    {gerando === "este" ? "Gerando…" : "Gerar para este slide"}
                  </button>
                  <button type="button" className="cx-botao cx-botao--suave" onClick={gerarTodos} disabled={!!gerando}>
                    {gerando && gerando !== "este" ? (
                      <>
                        <LoaderCircle size={16} className="cx-girando" aria-hidden="true" /> Slide {gerando}
                      </>
                    ) : (
                      `Todos os ${api.estado.slides.length} slides`
                    )}
                  </button>
                </div>
                <p className="cx-pp-meta">Usa a sua chave de {provedores.join(" / ")} em Conexões. Cada imagem leva até 1 minuto.</p>
              </div>
            ) : (
              <div className="cx-img-corpo">
                <p className="cx-img-sem">Para gerar imagens, conecte uma chave da OpenAI ou do Gemini.</p>
                <Link href="/central/conexoes" className="cx-botao cx-botao--suave">
                  Abrir Conexões
                </Link>
              </div>
            )
          ) : null}

          {aba === "biblioteca" ? (
            <div className="cx-img-corpo">
              {!imagens ? (
                <p className="cx-pp-meta cx-post-carregando">
                  <LoaderCircle size={16} className="cx-girando" aria-hidden="true" /> Abrindo a biblioteca…
                </p>
              ) : imagens.length ? (
                <ul className="cx-img-grade">
                  {imagens.map((im) => (
                    <li key={im.id}>
                      <button type="button" onClick={() => aplicar(api.indice, im.url)} aria-label={`Usar ${im.prompt ?? "imagem enviada"}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={im.url} alt="" loading="lazy" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="cx-pp-meta">A biblioteca está vazia. Gere ou envie a primeira imagem.</p>
              )}
            </div>
          ) : null}

          {aba === "enviar" ? (
            <div className="cx-img-corpo">
              <button type="button" className="cx-img-soltar" onClick={() => arquivo.current?.click()} disabled={!!gerando}>
                {gerando === "enviar" ? <LoaderCircle size={22} className="cx-girando" aria-hidden="true" /> : <Upload size={22} strokeWidth={1.6} aria-hidden="true" />}
                <span>{gerando === "enviar" ? "Enviando…" : "Escolher foto (JPG, PNG ou WebP, até 5 MB)"}</span>
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
                  setGerando("enviar");
                  const form = new FormData();
                  form.set("imagem", f);
                  const r = await enviarImagemMarcaAcao(form);
                  setGerando(null);
                  if (r.erro !== null) setErro(r.erro);
                  else {
                    aplicar(api.indice, r.url);
                    setImagens(null);
                  }
                }}
              />
              <p className="cx-pp-meta">A foto também fica na Biblioteca de imagens.</p>
            </div>
          ) : null}

          {erro ? (
            <p role="alert" className="cx-aviso cx-aviso--erro">
              {erro}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
