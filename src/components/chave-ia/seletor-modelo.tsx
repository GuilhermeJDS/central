"use client";

/**
 * Seletor de modelo com busca: a lista vem ao vivo do provedor, agrupada
 * (texto, imagem, outros). Começa sempre em "Selecione o modelo". Os chefes
 * escrevem, então só modelo de texto é escolhível; os outros aparecem, mas
 * desabilitados, para o dono ver tudo o que a chave enxerga.
 *
 * Padrão combobox do WAI-ARIA: o foco fica no campo de busca e as setas
 * movem a opção ativa (aria-activedescendant).
 */
import { Check, ChevronDown, LoaderCircle, Search } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { ROTULO_TIPO, type ModeloAoVivo, type TipoModelo } from "@/lib/ia/provedores/modelos-tipos";

type Props = {
  id?: string;
  /** Vai num <input type="hidden"> para o <form>. */
  name?: string;
  modelos: ModeloAoVivo[] | null;
  carregando?: boolean;
  /** Texto quando ainda não há lista (ex.: "Cole a chave para ver os modelos"). */
  semLista?: string;
  valor: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  /** Primeira opção, fora dos grupos (ex.: voltar ao padrão). */
  opcaoPadrao?: { valor: string; rotulo: string };
  rotuloId?: string;
};

const GRUPOS: TipoModelo[] = ["texto", "imagem", "outro"];

export function SeletorModelo({
  id: idProp,
  name,
  modelos,
  carregando,
  semLista = "Cole a chave para ver os modelos",
  valor,
  onChange,
  disabled,
  opcaoPadrao,
  rotuloId,
}: Props) {
  const auto = useId();
  const id = idProp ?? auto;
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [ativo, setAtivo] = useState(0);
  const raiz = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const lista = useRef<HTMLUListElement>(null);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const base = modelos ?? [];
    return q ? base.filter((m) => m.id.toLowerCase().includes(q) || m.nome.toLowerCase().includes(q)) : base;
  }, [modelos, busca]);

  // Ordem navegável: opção padrão (se houver) + modelos de texto filtrados.
  const navegaveis = useMemo(() => {
    const ids = filtrados.filter((m) => m.tipo === "texto").map((m) => m.id);
    return opcaoPadrao && !busca.trim() ? [opcaoPadrao.valor, ...ids] : ids;
  }, [filtrados, opcaoPadrao, busca]);

  useEffect(() => {
    if (!aberto) return;
    function fora(e: PointerEvent) {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    const el = lista.current?.querySelector<HTMLElement>(`[data-i="${ativo}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [ativo, aberto]);

  const semModelos = !modelos || modelos.length === 0;
  const bloqueado = disabled || carregando || (semModelos && !opcaoPadrao);

  function abrir() {
    if (bloqueado) return;
    setBusca("");
    const i = navegaveis.indexOf(valor);
    setAtivo(i >= 0 ? i : 0);
    setAberto(true);
    requestAnimationFrame(() => campo.current?.focus());
  }

  function escolher(v: string) {
    onChange(v);
    setAberto(false);
  }

  function tecla(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAtivo((a) => Math.min(a + 1, navegaveis.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAtivo((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const v = navegaveis[ativo];
      if (v) escolher(v);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setAberto(false);
    }
  }

  const rotuloValor =
    valor && opcaoPadrao && valor === opcaoPadrao.valor
      ? opcaoPadrao.rotulo
      : valor
        ? (modelos?.find((m) => m.id === valor)?.nome ?? valor)
        : null;
  const idAtivo = navegaveis[ativo] ? `${id}-op-${navegaveis[ativo]}` : undefined;

  return (
    <div className="cx-sm" ref={raiz} data-aberto={aberto ? "" : undefined}>
      {name ? <input type="hidden" name={name} value={valor === opcaoPadrao?.valor ? "" : valor} /> : null}
      <button
        type="button"
        id={id}
        className="cx-input cx-sm-gatilho"
        aria-haspopup="listbox"
        aria-expanded={aberto}
        aria-labelledby={rotuloId ? `${rotuloId} ${id}` : undefined}
        disabled={bloqueado}
        onClick={() => (aberto ? setAberto(false) : abrir())}
      >
        {carregando ? (
          <span className="cx-sm-vazio">
            <LoaderCircle size={16} className="cx-sm-gira" aria-hidden="true" /> Buscando os modelos…
          </span>
        ) : rotuloValor ? (
          <span className="cx-sm-valor">
            {rotuloValor}
            {rotuloValor !== valor && valor !== opcaoPadrao?.valor ? <span className="cx-sm-id">{valor}</span> : null}
          </span>
        ) : (
          <span className="cx-sm-vazio">{semModelos && !opcaoPadrao ? semLista : "Selecione o modelo"}</span>
        )}
        <ChevronDown size={18} aria-hidden="true" className="cx-sm-seta" />
      </button>

      {aberto ? (
        <div className="cx-sm-pop">
          <div className="cx-sm-busca">
            <Search size={16} aria-hidden="true" />
            <input
              ref={campo}
              type="text"
              role="combobox"
              aria-expanded="true"
              aria-controls={`${id}-lista`}
              aria-activedescendant={idAtivo}
              aria-autocomplete="list"
              aria-label="Buscar modelo"
              placeholder={`Buscar entre ${modelos?.length ?? 0} modelos`}
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setAtivo(0);
              }}
              onKeyDown={tecla}
              spellCheck={false}
              autoComplete="off"
            />
          </div>
          <ul ref={lista} id={`${id}-lista`} role="listbox" className="cx-sm-lista" aria-label="Modelos">
            {opcaoPadrao && !busca.trim() ? (
              <li
                id={`${id}-op-${opcaoPadrao.valor}`}
                role="option"
                aria-selected={valor === opcaoPadrao.valor}
                data-i={0}
                data-ativo={navegaveis[ativo] === opcaoPadrao.valor ? "" : undefined}
                className="cx-sm-op"
                onPointerMove={() => setAtivo(0)}
                onClick={() => escolher(opcaoPadrao.valor)}
              >
                <span className="cx-sm-op-nome">{opcaoPadrao.rotulo}</span>
                {valor === opcaoPadrao.valor ? <Check size={16} aria-hidden="true" /> : null}
              </li>
            ) : null}
            {GRUPOS.map((g) => {
              const doGrupo = filtrados.filter((m) => m.tipo === g);
              if (!doGrupo.length) return null;
              return (
                <li key={g} role="presentation">
                  <p className="cx-sm-grupo" aria-hidden="true">
                    {ROTULO_TIPO[g]} <span>{doGrupo.length}</span>
                  </p>
                  <ul role="group" aria-label={ROTULO_TIPO[g]}>
                    {doGrupo.map((m) => {
                      const i = navegaveis.indexOf(m.id);
                      const pode = m.tipo === "texto";
                      return (
                        <li
                          key={m.id}
                          id={`${id}-op-${m.id}`}
                          role="option"
                          aria-selected={valor === m.id}
                          aria-disabled={!pode || undefined}
                          data-i={pode ? i : undefined}
                          data-ativo={pode && i === ativo ? "" : undefined}
                          className="cx-sm-op"
                          onPointerMove={() => pode && setAtivo(i)}
                          onClick={() => pode && escolher(m.id)}
                        >
                          <span className="cx-sm-op-nome">
                            {m.nome}
                            {m.nome !== m.id ? <span className="cx-sm-id">{m.id}</span> : null}
                          </span>
                          {!pode ? <span className="cx-sm-tag">não escreve</span> : null}
                          {valor === m.id ? <Check size={16} aria-hidden="true" /> : null}
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })}
            {!filtrados.length ? <li className="cx-sm-nada">Nenhum modelo com “{busca}”.</li> : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
