"use client";

/**
 * Marca › Identidade. Estrutura dominante: a prancha com três slides de
 * amostra que mudam ao vivo com as cores, a fonte e a foto de referência.
 * Ao lado, o estilo e o personagem que o modelo de imagem segue.
 */
import { Check, LoaderCircle, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import { salvarIdentidadeAcao } from "@/app/central/acoes-estudio";
import { SlideVista, useFonteMarca } from "@/components/central/estudio/slide-vista";
import { FONTES, IDS_FONTE, type IdFonte, type MarcaCarrossel } from "@/lib/central/carrossel";
import type { IdentidadeView, ImagemView, ProvedorImagem } from "@/lib/central/estudio/imagens";
import type { SlideEstudio } from "@/lib/central/estudio/slide";

const NOME: Record<ProvedorImagem, string> = { OPENAI: "OpenAI", GOOGLE: "Gemini" };

function amostras(nome: string, foto: string | null): SlideEstudio[] {
  return [
    {
      id: "a1",
      titulo: "Como a sua marca aparece",
      texto: "",
      imagem: foto,
      imagemDica: "",
      ...(foto ? {} : { layout: "texto" as const }),
    },
    { id: "a2", titulo: "Um slide de dica", texto: `Texto de apoio com a fonte e as cores de ${nome}.`, imagem: null, imagemDica: "" },
    {
      id: "a3",
      titulo: "Fecho com chamada",
      texto: "Agende pelo link da bio.",
      imagem: null,
      imagemDica: "",
      elementos: [
        { id: "t", tipo: "titulo", x: 96, y: 420, w: 888, texto: "Fecho com chamada", tamanho: 84, cor: "texto" },
        { id: "b", tipo: "balao", x: 96, y: 700, w: 640, texto: "“Tem horário sábado?”", tamanho: 40, cor: "branco", fundo: "destaque" },
        { id: "s", tipo: "selo", x: 96, y: 150, w: 400, texto: "Agenda aberta", tamanho: 30, cor: "branco", fundo: "destaque" },
      ],
    },
  ];
}

export function IdentidadeForm({
  inicial,
  marcaSite,
  provedores,
  imagens,
  nomeNegocio,
}: {
  inicial: IdentidadeView;
  marcaSite: MarcaCarrossel;
  provedores: ProvedorImagem[];
  imagens: ImagemView[];
  nomeNegocio: string;
}) {
  const [f, setF] = useState(inicial);
  const [salvo, setSalvo] = useState<"ok" | "mudou" | "erro">("ok");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, iniciar] = useTransition();
  const mudar = (p: Partial<IdentidadeView>) => {
    setF((a) => ({ ...a, ...p }));
    setSalvo("mudou");
  };

  const marca: MarcaCarrossel = {
    fundo: f.corFundo || marcaSite.fundo,
    texto: f.corTexto || marcaSite.texto,
    destaque: f.corDestaque || marcaSite.destaque,
    fonte: (f.fonte as IdFonte) || marcaSite.fonte,
    formato: "4x5",
  };
  useFonteMarca(marca.fonte);
  const slides = amostras(nomeNegocio, f.referenciaUrl);

  function salvar() {
    iniciar(async () => {
      const r = await salvarIdentidadeAcao({ ...f, corFundo: f.corFundo ?? "", corTexto: f.corTexto ?? "", corDestaque: f.corDestaque ?? "" });
      setErro(r.erro);
      setSalvo(r.erro ? "erro" : "ok");
    });
  }

  return (
    <div className="cx-identidade">
      <section className="cx-prancha" aria-label="Prévia da marca">
        <ol className="cx-prancha-slides">
          {slides.map((s, i) => (
            <li key={s.id}>
              <SlideVista slide={s} indice={i} total={3} marca={marca} nomeNegocio={nomeNegocio} rotulo={`Amostra ${i + 1}`} />
            </li>
          ))}
        </ol>
        <div className="cx-prancha-cores">
          {(
            [
              ["corFundo", "Fundo", marcaSite.fundo],
              ["corTexto", "Texto", marcaSite.texto],
              ["corDestaque", "Destaque", marcaSite.destaque],
            ] as const
          ).map(([k, rotulo, padrao]) => (
            <label key={k} className="cx-cor-marca">
              <input type="color" value={(f[k] || padrao).toLowerCase()} onChange={(e) => mudar({ [k]: e.target.value.toUpperCase() })} />
              <span>
                <strong>{rotulo}</strong>
                <span className="cx-pp-meta">{(f[k] || padrao).toUpperCase()}</span>
              </span>
            </label>
          ))}
          <label className="cx-campo cx-identidade-fonte">
            <span className="cx-campo-rotulo">Fonte</span>
            <select className="cx-input cx-select" value={marca.fonte} onChange={(e) => mudar({ fonte: e.target.value })}>
              {IDS_FONTE.map((id) => (
                <option key={id} value={id}>
                  {FONTES[id].nome}
                </option>
              ))}
            </select>
          </label>
          {f.corFundo || f.corTexto || f.corDestaque || f.fonte ? (
            <button
              type="button"
              className="cx-pp-link"
              onClick={() => mudar({ corFundo: null, corTexto: null, corDestaque: null, fonte: null })}
            >
              <RotateCcw size={15} strokeWidth={1.8} aria-hidden="true" /> Cores do site
            </button>
          ) : null}
        </div>
      </section>

      <section className="cx-identidade-imagens" aria-labelledby="cx-id-img">
        <h2 id="cx-id-img" className="cx-identidade-titulo">
          Imagens dos slides
        </h2>
        <p className="cx-pp-meta">O modelo segue isto em todas as imagens de uma peça, com o mesmo personagem do primeiro ao último slide.</p>
        <label className="cx-campo">
          <span className="cx-campo-rotulo">Estilo</span>
          <textarea
            className="cx-input"
            rows={3}
            maxLength={1500}
            value={f.estilo}
            placeholder="Ex.: foto realista, luz natural de janela, tons rosados e bege, fundo de cabine clara, sem filtros"
            onChange={(e) => mudar({ estilo: e.target.value })}
          />
        </label>
        <label className="cx-campo">
          <span className="cx-campo-rotulo">Personagem</span>
          <textarea
            className="cx-input"
            rows={3}
            maxLength={1500}
            value={f.personagem}
            placeholder="Ex.: esteticista de 35 anos, cabelo castanho preso, jaleco branco, sorriso calmo"
            onChange={(e) => mudar({ personagem: e.target.value })}
          />
        </label>

        <div className="cx-campo">
          <span className="cx-campo-rotulo" id="cx-id-ref">
            Foto de referência do personagem
          </span>
          {imagens.length ? (
            <ul className="cx-img-grade cx-identidade-refs" role="radiogroup" aria-labelledby="cx-id-ref">
              {imagens.slice(0, 12).map((im) => (
                <li key={im.id}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={f.referenciaUrl === im.url}
                    onClick={() => mudar({ referenciaUrl: f.referenciaUrl === im.url ? null : im.url })}
                    aria-label={im.prompt ?? "Imagem enviada"}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={im.url} alt="" loading="lazy" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="cx-pp-meta">
              Envie uma foto em <Link href="/central/redes/marca/imagens">Biblioteca de imagens</Link> para usar como referência.
            </p>
          )}
        </div>

        <div className="cx-campo">
          <span className="cx-campo-rotulo" id="cx-id-modelo">
            Modelo de imagem
          </span>
          {provedores.length ? (
            <div className="cx-segmentos" role="radiogroup" aria-labelledby="cx-id-modelo">
              {provedores.map((p) => (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  className="cx-segmento"
                  aria-checked={(f.provedorImagem ?? provedores[0]) === p}
                  aria-current={(f.provedorImagem ?? provedores[0]) === p ? "true" : undefined}
                  onClick={() => mudar({ provedorImagem: p })}
                >
                  {NOME[p]}
                </button>
              ))}
            </div>
          ) : (
            <p className="cx-pp-meta">
              Nenhuma chave de imagem ainda. Conecte a da OpenAI ou do Gemini em <Link href="/central/conexoes">Conexões</Link>.
            </p>
          )}
        </div>

        <div className="cx-identidade-salvar">
          <button type="button" className="cx-botao cx-botao--azul" onClick={salvar} disabled={salvando || salvo === "ok"}>
            {salvando ? <LoaderCircle size={16} className="cx-girando" aria-hidden="true" /> : <Check size={16} strokeWidth={2} aria-hidden="true" />}
            {salvo === "ok" && !salvando ? "Salvo" : "Salvar identidade"}
          </button>
          {erro ? (
            <p role="alert" className="cx-aviso cx-aviso--erro">
              {erro}
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
