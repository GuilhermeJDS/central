"use client";

/**
 * Estúdio › Referências. Estrutura dominante: o mural de prints com a nota do
 * que copiar (gancho, formato, capa). Guardar com link, print e rede.
 */
import { ExternalLink, ImagePlus, LoaderCircle, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { apagarReferenciaAcao, salvarReferenciaAcao } from "@/app/central/acoes-estudio";
import { ROTULO_REDE } from "@/lib/central/entregas-tipos";
import { slugDaRede } from "@/lib/central/estudio/secoes";

export type ReferenciaView = { id: string; rede: string | null; link: string | null; imagem: string | null; nota: string; em: string };

export function Referencias({ referencias, redePadrao }: { referencias: ReferenciaView[]; redePadrao: string | null }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(!referencias.length);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [arquivo, setArquivo] = useState<string | null>(null);
  const form = useRef<HTMLFormElement>(null);

  return (
    <div className="cx-imagens">
      {aberto ? (
        <form
          ref={form}
          className="cx-ref-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setErro(null);
            setEnviando(true);
            const r = await salvarReferenciaAcao(new FormData(e.currentTarget));
            setEnviando(false);
            if (r.erro !== null) setErro(r.erro);
            else {
              form.current?.reset();
              setArquivo(null);
              router.refresh();
            }
          }}
        >
          <label className="cx-campo cx-ref-nota">
            <span className="cx-campo-rotulo">O que chamou atenção</span>
            <textarea name="nota" className="cx-input" rows={2} maxLength={1000} required placeholder="Ex.: gancho em pergunta e capa só com o rosto da cliente" />
          </label>
          <label className="cx-campo">
            <span className="cx-campo-rotulo">Link do post</span>
            <input name="link" type="url" className="cx-input" placeholder="https://" />
          </label>
          <label className="cx-campo">
            <span className="cx-campo-rotulo">Rede</span>
            <select name="rede" className="cx-input cx-select" defaultValue={redePadrao ?? ""}>
              <option value="">Qualquer</option>
              {Object.entries(ROTULO_REDE).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="cx-ref-print">
            <input
              name="imagem"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="cx-so-leitor"
              onChange={(e) => setArquivo(e.target.files?.[0]?.name ?? null)}
            />
            <ImagePlus size={18} strokeWidth={1.8} aria-hidden="true" />
            {arquivo ?? "Print (opcional)"}
          </label>
          <button type="submit" className="cx-botao cx-botao--azul" disabled={enviando}>
            {enviando ? <LoaderCircle size={16} className="cx-girando" aria-hidden="true" /> : <Plus size={16} strokeWidth={2} aria-hidden="true" />}
            Guardar
          </button>
          {erro ? (
            <p role="alert" className="cx-aviso cx-aviso--erro cx-ref-erro">
              {erro}
            </p>
          ) : null}
        </form>
      ) : (
        <button type="button" className="cx-botao cx-botao--azul cx-ref-nova" onClick={() => setAberto(true)}>
          <Plus size={16} strokeWidth={2} aria-hidden="true" /> Nova referência
        </button>
      )}

      {referencias.length ? (
        <ul className="cx-mural">
          {referencias.map((r) => (
            <li key={r.id} className="cx-mural-item" data-rede={slugDaRede(r.rede) ?? undefined}>
              {r.imagem ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.imagem} alt="" loading="lazy" />
              ) : (
                <div className="cx-ref-sem-print">
                  <span className="cx-capa-texto-tipo">{r.rede ? ROTULO_REDE[r.rede] : "Referência"}</span>
                </div>
              )}
              <div className="cx-mural-info">
                <span className="cx-ref-texto">{r.nota}</span>
                <span className="cx-peca-meta">
                  {r.rede ? (
                    <>
                      <span className="cx-rede-ponto" aria-hidden="true" /> {ROTULO_REDE[r.rede]}
                    </>
                  ) : null}
                  {r.link ? (
                    <a href={r.link} target="_blank" rel="noopener noreferrer" className="cx-ref-link">
                      Ver post <ExternalLink size={13} strokeWidth={1.8} aria-hidden="true" />
                    </a>
                  ) : null}
                </span>
              </div>
              <button
                type="button"
                className="cx-mural-apagar"
                aria-label="Apagar referência"
                onClick={async () => {
                  await apagarReferenciaAcao(r.id);
                  router.refresh();
                }}
              >
                <Trash2 size={15} strokeWidth={1.8} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
