"use client";

/**
 * Tela "Chave de IA": escolher provedor, colar a chave, escolher o modelo.
 * Ao salvar, o servidor testa na hora e diz se funcionou (ou o motivo).
 * A chave nunca volta para cá: só provedor, últimos 4, modelo e data do teste.
 *
 * Usada no painel da unidade (Configurações) e na Central (Conexões); muda
 * só o visual (`variante`) e as ações recebidas.
 */
import { useEffect, useId, useRef, useState, useTransition } from "react";

import { SeletorModelo } from "@/components/chave-ia/seletor-modelo";
import type { ChaveIaView, ResultadoChave, ResultadoModelos } from "@/lib/ia/chaves-conta";
import type { ModeloAoVivo } from "@/lib/ia/provedores/modelos-tipos";
import {
  CATALOGO_IA,
  PROVEDORES_IA,
  PROVEDORES_TESTADOS,
  type ProvedorIA,
} from "@/lib/ia/provedores/catalogo";

type Classes = {
  card: string;
  titulo: string;
  sub: string;
  rotulo: string;
  input: string;
  botao: string;
  botaoSuave: string;
  botaoFantasma: string;
  ok: string;
  erro: string;
  linha: string;
  chip: string;
};

const CLASSES: Record<"painel" | "central", Classes> = {
  painel: {
    card: "rounded-xl border border-border bg-surface p-4 sm:p-5 scroll-mt-24",
    titulo: "text-base font-bold text-foreground",
    sub: "mt-0.5 text-[15px] leading-snug text-muted",
    rotulo: "text-[15px] font-semibold text-foreground",
    input:
      "min-h-11 w-full rounded-lg border border-border bg-surface px-3 text-[15px] text-foreground outline-none focus:border-foreground/40",
    botao:
      "inline-flex min-h-11 items-center justify-center rounded-lg bg-foreground px-4 text-[15px] font-semibold text-surface disabled:opacity-55",
    botaoSuave:
      "inline-flex min-h-11 items-center justify-center rounded-lg border border-border px-4 text-[15px] font-semibold text-foreground disabled:opacity-55",
    botaoFantasma:
      "inline-flex min-h-11 items-center justify-center rounded-lg px-3 text-[15px] font-semibold text-muted hover:text-foreground disabled:opacity-55",
    ok: "text-[15px] font-semibold text-emerald-700 dark:text-emerald-400",
    erro: "text-[15px] font-semibold text-red-700 dark:text-red-400",
    linha: "flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3",
    chip: "rounded-full border border-border px-2 py-0.5 text-[13px] font-semibold text-muted",
  },
  central: {
    card: "cx-card cx-conexao cx-chave-ia",
    titulo: "cx-card-titulo",
    sub: "cx-card-sub",
    rotulo: "cx-campo-rotulo",
    input: "cx-input",
    botao: "cx-botao cx-botao--azul",
    botaoSuave: "cx-botao cx-botao--suave",
    botaoFantasma: "cx-botao cx-botao--fantasma-escuro",
    ok: "cx-aviso cx-aviso--ok",
    erro: "cx-aviso cx-aviso--erro",
    linha: "cx-chave-linha",
    chip: "cx-chip",
  },
};

const fmtData = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "numeric", month: "short" });

export function CardChaveIA({
  variante,
  chaves,
  podeEditar,
  salvar,
  usar,
  apagar,
  listarModelos,
}: {
  variante: "painel" | "central";
  chaves: ChaveIaView[];
  /** Só o dono (ou SUPER_ADMIN) mexe; os outros só veem. */
  podeEditar: boolean;
  salvar: (form: FormData) => Promise<ResultadoChave>;
  usar: (provedor: ProvedorIA) => Promise<ResultadoChave>;
  apagar: (provedor: ProvedorIA) => Promise<ResultadoChave>;
  /** Lista real de modelos do provedor para a chave colada. */
  listarModelos: (provedor: ProvedorIA, chave: string) => Promise<ResultadoModelos>;
}) {
  const c = CLASSES[variante];
  const id = useId();
  const ativa = chaves.find((k) => k.ativa) ?? null;
  const [formAberto, setFormAberto] = useState(!ativa);
  const [provedor, setProvedor] = useState<ProvedorIA>(ativa?.provedor ?? "ANTHROPIC");
  const [chave, setChave] = useState("");
  const [modelo, setModelo] = useState("");
  const [modelos, setModelos] = useState<ModeloAoVivo[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const pedido = useRef(0);
  const [resultado, setResultado] = useState<ResultadoChave | null>(null);
  const [apagando, setApagando] = useState<ProvedorIA | null>(null);
  const [pendente, iniciar] = useTransition();
  const info = CATALOGO_IA[provedor];

  function escolherProvedor(p: ProvedorIA) {
    setProvedor(p);
    setModelo("");
    buscarModelos(p, chave);
  }

  // Colou a chave (ou trocou o provedor): busca a lista real de modelos.
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);
  function buscarModelos(p: ProvedorIA, bruta: string) {
    const k = bruta.trim();
    const n = ++pedido.current;
    if (espera.current) clearTimeout(espera.current);
    setModelos(null);
    setErroLista(null);
    if (k.length < 10 || /\s/.test(k)) {
      setBuscando(false);
      return;
    }
    setBuscando(true);
    espera.current = setTimeout(async () => {
      const r = await listarModelos(p, k).catch(() => ({
        ok: false as const,
        mensagem: "Não deu para buscar os modelos agora.",
      }));
      if (n !== pedido.current) return;
      setBuscando(false);
      if (r.ok) {
        setModelos(r.modelos);
        setModelo((m) => (r.modelos.some((x) => x.id === m && x.tipo === "texto") ? m : ""));
      } else setErroLista(r.mensagem);
    }, 350);
  }
  useEffect(() => () => {
    if (espera.current) clearTimeout(espera.current);
  }, []);

  function trocar(p: ProvedorIA) {
    escolherProvedor(p);
    setResultado(null);
    setFormAberto(true);
  }

  function enviar(form: FormData) {
    if (!modelo) {
      setResultado({ ok: false, mensagem: "Selecione o modelo." });
      return;
    }
    setResultado(null);
    iniciar(async () => {
      const r = await salvar(form);
      setResultado(r);
      if (r.ok) {
        setFormAberto(false);
        setChave("");
        setModelo("");
        setModelos(null);
      }
    });
  }

  function acao(fn: () => Promise<ResultadoChave>) {
    setResultado(null);
    iniciar(async () => {
      const r = await fn();
      setResultado(r);
      setApagando(null);
    });
  }

  return (
    <section id="chave-ia" className={c.card} aria-labelledby={`${id}-t`}>
      <div>
        <h2 id={`${id}-t`} className={c.titulo}>
          Chave de IA
        </h2>
        <p className={c.sub}>
          Os chefes trabalham com a sua chave. O uso é cobrado direto pelo provedor, na sua conta; a Central não cobra
          nada a mais por isso.
        </p>
      </div>

      {chaves.length ? (
        <ul className="mt-4 flex flex-col gap-2">
          {chaves.map((k) => (
            <li key={k.provedor} className={c.linha}>
              <div className="min-w-0">
                <p className={c.rotulo}>
                  {CATALOGO_IA[k.provedor].nome}{" "}
                  {k.ativa ? <span className={c.chip}>em uso</span> : null}
                </p>
                <p className={c.sub}>
                  Termina em {k.ultimos4} · {k.modelo}
                  {k.validaEm ? ` · testada em ${fmtData.format(new Date(k.validaEm))}` : " · falhou no último teste"}
                </p>
              </div>
              {podeEditar ? (
                <div className="flex flex-wrap items-center gap-2">
                  {!k.ativa ? (
                    <button
                      type="button"
                      className={c.botaoSuave}
                      disabled={pendente}
                      onClick={() => acao(() => usar(k.provedor))}
                    >
                      Usar esta
                    </button>
                  ) : null}
                  <button type="button" className={c.botaoSuave} disabled={pendente} onClick={() => trocar(k.provedor)}>
                    Trocar
                  </button>
                  {apagando === k.provedor ? (
                    <button
                      type="button"
                      className={c.botao}
                      disabled={pendente}
                      onClick={() => acao(() => apagar(k.provedor))}
                    >
                      Confirmar apagar
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={c.botaoFantasma}
                      disabled={pendente}
                      onClick={() => setApagando(k.provedor)}
                    >
                      Apagar
                    </button>
                  )}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {podeEditar && formAberto ? (
        <form action={enviar} className="mt-4 flex flex-col gap-4">
          <fieldset className="flex flex-col gap-2">
            <legend className={c.rotulo}>Provedor</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {PROVEDORES_IA.map((p) => (
                <label
                  key={p}
                  className={`${p === provedor ? c.botao : c.botaoSuave} cursor-pointer has-[:focus-visible]:ring-2`}
                >
                  <input
                    type="radio"
                    name="provedor"
                    value={p}
                    checked={p === provedor}
                    onChange={() => escolherProvedor(p)}
                    className="sr-only"
                  />
                  {CATALOGO_IA[p].nome}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-col gap-1.5">
            <label className={c.rotulo} htmlFor={`${id}-chave`}>
              Chave da API
            </label>
            <input
              id={`${id}-chave`}
              name="chave"
              type="password"
              autoComplete="off"
              spellCheck={false}
              required
              minLength={10}
              maxLength={500}
              className={c.input}
              placeholder="Cole aqui a chave"
              value={chave}
              onChange={(e) => {
                setChave(e.target.value);
                buscarModelos(provedor, e.target.value);
              }}
              aria-invalid={erroLista ? true : undefined}
              aria-describedby={erroLista ? `${id}-erro-lista` : undefined}
            />
            <p className={c.sub}>
              Crie a chave em{" "}
              <a href={info.ondePegar} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
                {new URL(info.ondePegar).host}
              </a>
              . Fica guardada cifrada; aqui aparecem só os 4 últimos caracteres.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className={c.rotulo} id={`${id}-modelo-rotulo`}>
              Modelo
            </span>
            <SeletorModelo
              id={`${id}-modelo`}
              rotuloId={`${id}-modelo-rotulo`}
              name="modelo"
              modelos={modelos}
              carregando={buscando}
              valor={modelo}
              onChange={setModelo}
              disabled={pendente}
            />
            {erroLista ? (
              <p id={`${id}-erro-lista`} className={c.erro}>
                {erroLista}
              </p>
            ) : modelos ? (
              <p className={c.sub}>
                {modelos.filter((m) => m.tipo === "texto").length} modelos de texto nesta chave. O teste roda com o que
                você escolher.
              </p>
            ) : null}
            {!info.leImagem ? (
              <p className={c.sub}>Este provedor não lê fotos: a legenda de fotos do portfólio não funciona com ele.</p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className={c.botao} disabled={pendente || !modelo}>
              {pendente ? "Testando…" : "Salvar e testar"}
            </button>
            {ativa ? (
              <button type="button" className={c.botaoFantasma} disabled={pendente} onClick={() => setFormAberto(false)}>
                Cancelar
              </button>
            ) : null}
          </div>
        </form>
      ) : null}

      {podeEditar && !formAberto ? (
        <div className="mt-4">
          <button type="button" className={c.botaoSuave} onClick={() => trocar("ANTHROPIC")} disabled={pendente}>
            Conectar outro provedor
          </button>
        </div>
      ) : null}

      {!podeEditar ? <p className={`${c.sub} mt-4`}>Só o dono da conta conecta ou troca a chave.</p> : null}

      <p role="status" aria-live="polite" className={`mt-3 ${resultado ? (resultado.ok ? c.ok : c.erro) : ""}`}>
        {resultado?.mensagem ?? ""}
      </p>

      <p className={`${c.sub} mt-2`}>
        Chefes já testados de ponta a ponta com:{" "}
        {PROVEDORES_TESTADOS.map((p) => CATALOGO_IA[p].nome).join(", ")}. Os outros provedores usam o mesmo caminho e
        passam pelo teste da chave, mas ainda não pelo teste completo dos chefes.
      </p>
    </section>
  );
}
