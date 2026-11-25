"use client";

/**
 * Navegação do estúdio de Redes, colada na base do cabeçalho da página
 * (DESIGN.md 6.1): as seções em abas sublinhadas na cor da Pauta e, à
 * direita, o filtro de rede no mesmo seletor segmentado do período.
 * O filtro mora na URL (?rede=) e acompanha todos os links.
 */
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  comRede,
  GRUPOS_ESTUDIO,
  REDES_FILTRO,
  rotuloSecao,
  secaoAtiva,
  secaoServeRede,
} from "@/lib/central/estudio/secoes";

/** Marca as bordas que ainda escondem item (o CSS põe o degradê) e traz o ativo para a vista. */
function useTrilho(chave: string) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const t = ref.current;
    if (!t) return;
    const medir = () => {
      const fim = t.scrollWidth - t.clientWidth;
      t.toggleAttribute("data-esq", t.scrollLeft > 2);
      t.toggleAttribute("data-dir", fim - t.scrollLeft > 2);
    };
    // Só na horizontal: scrollIntoView também rolaria a página.
    const ativo = t.querySelector<HTMLElement>(
      '[aria-current="page"], [aria-current="true"]',
    );
    if (ativo) {
      const a = ativo.getBoundingClientRect();
      const r = t.getBoundingClientRect();
      if (a.left < r.left + 32) t.scrollLeft -= r.left + 32 - a.left;
      else if (a.right > r.right - 32) t.scrollLeft += a.right - (r.right - 32);
    }
    medir();
    t.addEventListener("scroll", medir, { passive: true });
    const ro = new ResizeObserver(medir);
    ro.observe(t);
    return () => {
      t.removeEventListener("scroll", medir);
      ro.disconnect();
    };
  }, [chave]);
  return ref;
}

export function EstudioNav() {
  const caminho = usePathname();
  const busca = useSearchParams();
  const rede =
    REDES_FILTRO.find((r) => r.slug === busca.get("rede"))?.slug ?? null;
  const ativa = secaoAtiva(caminho);
  // Dentro de uma peça o filtro não serve para nada: só as abas.
  const naPeca =
    !!ativa &&
    caminho !== ativa &&
    /\/(carrosseis|videos|pautas|publicados)\//.test(caminho);
  const abas = useTrilho(`${ativa}-${rede}`);

  const grupos = GRUPOS_ESTUDIO.map((g) => ({
    ...g,
    secoes: g.secoes.filter((s) => secaoServeRede(s.href, rede)),
  }));
  const redesDaPagina = REDES_FILTRO.filter(
    (r) => !ativa || secaoServeRede(ativa, r.slug),
  );

  return (
    <div className="cx-estudio-barra">
      <nav className="cx-estudio-nav" aria-label="Estúdio de Redes">
        <div className="cx-estudio-trilho" ref={abas}>
          {grupos.map((g, i) => (
            <ul
              key={i}
              className="cx-estudio-grupo"
              aria-label={g.rotulo ?? "Cronograma"}
            >
              {g.secoes.map((s) => (
                <li key={s.href}>
                  <Link
                    href={comRede(s.href, rede)}
                    className="cx-estudio-aba"
                    aria-current={s.href === ativa ? "page" : undefined}
                    aria-label={s.nome}
                    title={
                      g.rotulo
                        ? `${g.rotulo} · ${s.nome ?? s.rotulo}`
                        : undefined
                    }
                  >
                    {rotuloSecao(s, rede)}
                  </Link>
                </li>
              ))}
            </ul>
          ))}
        </div>
      </nav>
      {naPeca ? null : (
        <MenuRede caminho={caminho} rede={rede} redes={redesDaPagina} />
      )}
    </div>
  );
}

/** Filtro de rede: um botão compacto que abre a lista (cabe na linha das abas). */
function MenuRede({
  caminho,
  rede,
  redes,
}: {
  caminho: string;
  rede: string | null;
  redes: { slug: string; nome: string }[];
}) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const atual = redes.find((r) => r.slug === rede) ?? null;

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => {
      if (!caixa.current?.contains(e.target as Node)) setAberto(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAberto(false);
        caixa.current?.querySelector<HTMLButtonElement>("button")?.focus();
      }
    };
    document.addEventListener("pointerdown", fora);
    document.addEventListener("keydown", tecla);
    caixa.current?.querySelector<HTMLElement>('[aria-current="true"]')?.focus();
    return () => {
      document.removeEventListener("pointerdown", fora);
      document.removeEventListener("keydown", tecla);
    };
  }, [aberto]);

  const opcoes = [
    { slug: null as string | null, nome: "Todas as redes" },
    ...redes,
  ];
  return (
    <div className="cx-estudio-redes" ref={caixa} data-rede={atual?.slug}>
      <button
        type="button"
        className="cx-estudio-rede-botao"
        aria-haspopup="true"
        aria-expanded={aberto}
        onClick={() => setAberto((a) => !a)}
      >
        <span
          className="cx-rede-ponto"
          data-todas={atual ? undefined : ""}
          aria-hidden="true"
        />
        <span className="cx-so-leitor">Rede: </span>
        {atual ? atual.nome : "Todas as redes"}
        <ChevronDown
          size={16}
          strokeWidth={2}
          aria-hidden="true"
          className="cx-estudio-rede-seta"
        />
      </button>
      {aberto ? (
        <nav className="cx-estudio-rede-menu" aria-label="Filtrar por rede">
          {opcoes.map((r) => (
            <Link
              key={r.slug ?? "todas"}
              href={r.slug ? comRede(caminho, r.slug) : caminho}
              className="cx-estudio-rede"
              data-rede={r.slug ?? undefined}
              aria-current={(r.slug ?? null) === rede ? "true" : undefined}
              scroll={false}
              onClick={() => setAberto(false)}
            >
              <span
                className="cx-rede-ponto"
                data-todas={r.slug ? undefined : ""}
                aria-hidden="true"
              />
              {r.nome}
              {(r.slug ?? null) === rede ? (
                <Check
                  size={16}
                  strokeWidth={2}
                  aria-hidden="true"
                  className="cx-estudio-rede-check"
                />
              ) : null}
            </Link>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
