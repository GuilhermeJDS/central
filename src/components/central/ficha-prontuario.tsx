"use client";

import { ArrowRight, Check, ClipboardPaste, Plus, X } from "lucide-react";
import Image from "next/image";
import { useLayoutEffect, useRef, useState, useTransition, type KeyboardEvent } from "react";

import {
  distribuirContextoFichaAcao,
  salvarFichaDadosAcao,
  type CampoProposta,
} from "@/app/central/acoes-ficha";
import { CopiarTexto } from "@/components/central/copiar";
import type { FichaView } from "@/components/central/tipos";
import { useTrava } from "@/components/central/trava";
import { deEtiquetas, paraEtiquetas } from "@/lib/negocio/ficha-etiquetas";

/**
 * Ficha como prontuário do negócio (DESIGN.md 6.11): à esquerda o cartão de
 * identidade fixo (logo, nome, cidade, quanto da ficha está pronta e o que
 * falta); à direita os capítulos, editados no próprio texto, e o "Colar
 * contexto", em que a IA distribui um texto livre nos capítulos e mostra o
 * que mudaria antes de aplicar. Cada campo salva ao sair dele.
 */

const OBJETIVOS = [
  { valor: "MAIS_CLIENTES", rotulo: "Mais clientes" },
  { valor: "MAIS_VENDAS", rotulo: "Vender mais" },
  { valor: "ORGANIZAR", rotulo: "Organizar o negócio" },
  { valor: "OUTRO", rotulo: "Outro" },
] as const;

type Campo = keyof FichaView;

/** O que conta para "Ficha X% completa", na ordem em que aparece. */
const COMPLETUDE: { campo: Campo; rotulo: string }[] = [
  { campo: "nomeNegocio", rotulo: "Nome" },
  { campo: "cidade", rotulo: "Cidade" },
  { campo: "site", rotulo: "Site" },
  { campo: "objetivo", rotulo: "O que mais quer agora" },
  { campo: "oQueVende", rotulo: "O que vende" },
  { campo: "paraQuem", rotulo: "Para quem" },
  { campo: "comoFala", rotulo: "Como fala" },
  { campo: "naoQuer", rotulo: "O que não quer" },
];

const CAPITULO_DO_CAMPO: Record<CampoProposta, string> = {
  nomeNegocio: "O negócio · nome",
  cidade: "O negócio · cidade",
  site: "O negócio · site",
  objetivo: "O negócio · o que mais quer agora",
  objetivoOutro: "O negócio · objetivo",
  oQueVende: "O que vende",
  paraQuem: "Para quem",
  comoFala: "Do seu jeito",
  naoQuer: "O que não quer",
};

const PEDIDO_IA =
  "Descreva a minha empresa para uma ficha de marketing: nome, cidade, site, a lista de serviços ou produtos, para quem vendemos (públicos), como falamos com os clientes e o que não queremos de jeito nenhum (palavras, temas, promessas). Use tópicos curtos.";

type Status = { tipo: "ocioso" | "salvando" | "salvo" | "rascunho" | "erro" | "exemplo"; texto?: string };

const rotuloObjetivo = (v: string) => OBJETIVOS.find((o) => o.valor === v)?.rotulo ?? "";

export function FichaProntuario({ inicial, exemplo, logo }: { inicial: FichaView; exemplo: boolean; logo: string | null }) {
  const trava = useTrava();
  const [valores, setValores] = useState<FichaView>(inicial);
  const [status, setStatus] = useState<Status>({ tipo: "ocioso" });
  const [erros, setErros] = useState<Record<string, string>>({});
  const [, iniciar] = useTransition();
  const fila = useRef(0);

  const faltam = COMPLETUDE.filter((c) => !valores[c.campo].trim());
  const pct = Math.round(((COMPLETUDE.length - faltam.length) / COMPLETUDE.length) * 100);

  function salvar(parcial: Partial<FichaView>) {
    const novos = { ...valores, ...parcial };
    setValores(novos);
    if (trava.travado) {
      trava.abrir();
      return;
    }
    if (exemplo) {
      setStatus({ tipo: "exemplo", texto: "Exemplo: nada é salvo." });
      return;
    }
    const minha = ++fila.current;
    setStatus({ tipo: "salvando" });
    iniciar(async () => {
      const r = await salvarFichaDadosAcao(novos);
      if (minha !== fila.current) return; // uma gravação mais nova já saiu
      setErros(r.erros);
      if (r.ok) setStatus({ tipo: "salvo" });
      else if (Object.keys(r.erros).length)
        setStatus({ tipo: "rascunho", texto: "Ainda não salvo: complete os campos marcados." });
      else setStatus({ tipo: "erro", texto: r.mensagem });
    });
  }

  function focar(campo: Campo) {
    const el = document.getElementById(`ficha-${campo}`) ?? document.querySelector<HTMLElement>(`[data-campo="${campo}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    el?.focus({ preventScroll: true });
  }

  return (
    <div className="cx-ficha">
      <aside className="cx-ficha-id" aria-label="Identidade do negócio">
        <div className="cx-ficha-id-cartao">
          <div className="cx-ficha-id-topo">
            {logo ? (
              <Image src={logo} alt="" width={64} height={64} className="cx-ficha-logo" />
            ) : (
              <span className="cx-ficha-logo cx-ficha-logo--letras" aria-hidden="true">
                {iniciais(valores.nomeNegocio)}
              </span>
            )}
            <div className="cx-ficha-id-nome">
              <p className="cx-ficha-id-titulo">{valores.nomeNegocio || "Seu negócio"}</p>
              <p className="cx-ficha-id-cidade">{valores.cidade || "Cidade"}</p>
            </div>
          </div>

          <div className="cx-ficha-anel">
            <Anel pct={pct} />
            <p>
              <strong>Ficha {pct}% completa</strong>
              <span>{faltam.length ? `${faltam.length} ${faltam.length === 1 ? "item falta" : "itens faltam"}` : "Tudo preenchido"}</span>
            </p>
          </div>

          {faltam.length ? (
            <div className="cx-ficha-falta">
              <p className="cx-ficha-rotulo">Falta</p>
              <ul>
                {faltam.map((f) => (
                  <li key={f.campo}>
                    <button type="button" onClick={() => focar(f.campo)}>
                      {f.rotulo}
                      <ArrowRight size={15} strokeWidth={2} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="cx-ficha-status" data-tipo={status.tipo} role="status" aria-live="polite">
            {status.tipo === "salvando"
              ? "Salvando…"
              : status.tipo === "salvo"
                ? "Salvo agora"
                : status.tipo === "ocioso"
                  ? "Clique no texto para editar. Salva sozinho."
                  : status.texto}
          </p>
        </div>
      </aside>

      <div className="cx-ficha-folha">
        <ColarContexto valores={valores} exemplo={exemplo} aplicar={salvar} />

        <article className="cx-ficha-capitulos" aria-label="Ficha do negócio">
          <Capitulo n={1} titulo="O negócio" id="cap-negocio">
            <CampoNoLugar
              campo="nomeNegocio"
              rotulo="Nome do negócio"
              valor={valores.nomeNegocio}
              vazio="Nome do negócio"
              variante="titulo"
              max={120}
              erro={erros.nomeNegocio}
              salvar={(v) => salvar({ nomeNegocio: v })}
            />
            <dl className="cx-ficha-dados">
              <div>
                <dt>Cidade</dt>
                <dd>
                  <CampoNoLugar campo="cidade" rotulo="Cidade" valor={valores.cidade} vazio="Onde fica" variante="linha" max={120} erro={erros.cidade} salvar={(v) => salvar({ cidade: v })} />
                </dd>
              </div>
              <div>
                <dt>Site</dt>
                <dd>
                  <CampoNoLugar campo="site" rotulo="Site" valor={valores.site} vazio="Endereço do site" variante="linha" max={300} erro={erros.site} salvar={(v) => salvar({ site: v })} />
                </dd>
              </div>
            </dl>
            <fieldset className="cx-ficha-objetivo">
              <legend>O que você mais quer agora</legend>
              <div className="cx-ficha-pilulas" data-campo="objetivo" tabIndex={-1}>
                {OBJETIVOS.map((o) => (
                  <label key={o.valor} className="cx-ficha-pilula">
                    <input
                      type="radio"
                      name="objetivo"
                      value={o.valor}
                      checked={valores.objetivo === o.valor}
                      onChange={() => {
                        if (o.valor === "OUTRO" && !valores.objetivoOutro) setValores((v) => ({ ...v, objetivo: "OUTRO" }));
                        else salvar({ objetivo: o.valor });
                      }}
                    />
                    <span>{o.rotulo}</span>
                  </label>
                ))}
              </div>
              {valores.objetivo === "OUTRO" ? (
                <CampoNoLugar
                  campo="objetivoOutro"
                  rotulo="Qual é o objetivo"
                  valor={valores.objetivoOutro}
                  vazio="Qual é o objetivo"
                  variante="linha"
                  max={240}
                  erro={erros.objetivoOutro}
                  salvar={(v) => salvar({ objetivo: "OUTRO", objetivoOutro: v })}
                />
              ) : null}
              {erros.objetivo ? <span className="cx-erro">{erros.objetivo}</span> : null}
            </fieldset>
          </Capitulo>

          <Capitulo n={2} titulo="O que vende" id="cap-vende" apoio="Cada serviço ou produto numa etiqueta.">
            <Etiquetas campo="oQueVende" rotulo="Serviços e produtos" texto={valores.oQueVende} erro={erros.oQueVende} salvar={(v) => salvar({ oQueVende: v })} />
          </Capitulo>

          <Capitulo n={3} titulo="Para quem" id="cap-quem" apoio="Os públicos que você atende.">
            <Etiquetas campo="paraQuem" rotulo="Públicos" texto={valores.paraQuem} erro={erros.paraQuem} salvar={(v) => salvar({ paraQuem: v })} />
          </Capitulo>

          <Capitulo n={4} titulo="Do seu jeito" id="cap-jeito" apoio="Tudo o que os chefes escrevem segue isto.">
            <CampoNoLugar
              campo="comoFala"
              rotulo="Como você fala com os clientes"
              valor={valores.comoFala}
              vazio="Ex.: direto, com carinho, sem gíria."
              variante="texto"
              max={4000}
              salvar={(v) => salvar({ comoFala: v })}
            />
          </Capitulo>

          <Capitulo n={5} titulo="O que não quer" id="cap-nao" apoio="Palavras, temas ou promessas que não combinam com você.">
            <CampoNoLugar
              campo="naoQuer"
              rotulo="O que você não quer de jeito nenhum"
              valor={valores.naoQuer}
              vazio="Ex.: promessa de resultado milagroso."
              variante="texto"
              max={4000}
              salvar={(v) => salvar({ naoQuer: v })}
            />
          </Capitulo>
        </article>
      </div>
    </div>
  );
}

function iniciais(nome: string): string {
  const p = nome.trim().split(/\s+/).filter((x) => x.length > 2 || /^[A-Z]/.test(x));
  return ((p[0]?.[0] ?? "K") + (p[1]?.[0] ?? "")).toUpperCase();
}

function Anel({ pct }: { pct: number }) {
  const r = 26;
  const volta = 2 * Math.PI * r;
  return (
    <svg className="cx-ficha-anel-svg" width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r={r} className="cx-ficha-anel-trilho" />
      <circle cx="32" cy="32" r={r} className="cx-ficha-anel-feito" strokeDasharray={volta} strokeDashoffset={volta * (1 - pct / 100)} transform="rotate(-90 32 32)" />
      <text x="32" y="32" dominantBaseline="central" textAnchor="middle" className="cx-ficha-anel-num">
        {pct}
      </text>
    </svg>
  );
}

function Capitulo({ n, titulo, id, apoio, children }: { n: number; titulo: string; id: string; apoio?: string; children: React.ReactNode }) {
  return (
    <section className="cx-ficha-capitulo" aria-labelledby={id}>
      <header className="cx-ficha-capitulo-cabeca">
        <span className="cx-ficha-capitulo-n" aria-hidden="true">
          {String(n).padStart(2, "0")}
        </span>
        <h2 id={id} className="cx-ficha-capitulo-titulo">
          {titulo}
        </h2>
        {apoio ? <p className="cx-ficha-capitulo-apoio">{apoio}</p> : null}
      </header>
      <div className="cx-ficha-capitulo-corpo">{children}</div>
    </section>
  );
}

/**
 * Texto editável no lugar: parece texto corrido; clicar põe o cursor ali.
 * Salva ao sair (Enter sai nos campos de uma linha; Esc desfaz).
 */
function CampoNoLugar({
  campo,
  rotulo,
  valor,
  vazio,
  variante,
  max,
  erro,
  salvar,
}: {
  campo: Campo;
  rotulo: string;
  valor: string;
  vazio: string;
  variante: "titulo" | "linha" | "texto";
  max: number;
  erro?: string;
  salvar: (v: string) => void;
}) {
  const [rascunho, setRascunho] = useState(valor);
  const [antes, setAntes] = useState(valor);
  const ref = useRef<HTMLTextAreaElement>(null);
  // Valor novo de fora (Colar contexto aplicado): o rascunho acompanha.
  if (valor !== antes) {
    setAntes(valor);
    setRascunho(valor);
  }

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [rascunho]);

  function tecla(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Escape") {
      setRascunho(valor);
      requestAnimationFrame(() => ref.current?.blur());
    } else if (e.key === "Enter" && variante !== "texto") {
      e.preventDefault();
      ref.current?.blur();
    }
  }

  return (
    <span className="cx-nl-caixa" data-variante={variante}>
      <textarea
        ref={ref}
        id={`ficha-${campo}`}
        className="cx-nl"
        data-variante={variante}
        rows={1}
        value={rascunho}
        placeholder={vazio}
        maxLength={max}
        aria-label={rotulo}
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? `ficha-${campo}-erro` : undefined}
        spellCheck
        onChange={(e) => setRascunho(variante === "texto" ? e.target.value : e.target.value.replace(/\n/g, " "))}
        onKeyDown={tecla}
        onBlur={() => {
          const v = rascunho.trim();
          if (v !== valor.trim()) salvar(v);
        }}
      />
      {erro ? (
        <span id={`ficha-${campo}-erro`} className="cx-erro">
          {erro}
        </span>
      ) : null}
    </span>
  );
}

function Etiquetas({ campo, rotulo, texto, erro, salvar }: { campo: Campo; rotulo: string; texto: string; erro?: string; salvar: (v: string) => void }) {
  const lista = paraEtiquetas(texto);
  const [nova, setNova] = useState("");

  function adicionar() {
    const itens = paraEtiquetas(nova);
    setNova("");
    if (!itens.length) return;
    salvar(deEtiquetas([...lista, ...itens.filter((i) => !lista.some((l) => l.toLowerCase() === i.toLowerCase()))]));
  }

  function tecla(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      adicionar();
    } else if (e.key === "Backspace" && !nova && lista.length) {
      salvar(deEtiquetas(lista.slice(0, -1)));
    }
  }

  return (
    <div className="cx-etiquetas-caixa">
      <ul className="cx-etiquetas" aria-label={rotulo}>
        {lista.map((t, i) => (
          <li key={`${t}-${i}`} className="cx-etiqueta">
            <span>{t}</span>
            <button type="button" aria-label={`Tirar ${t}`} onClick={() => salvar(deEtiquetas(lista.filter((_, j) => j !== i)))}>
              <X size={14} strokeWidth={2.2} aria-hidden="true" />
            </button>
          </li>
        ))}
        <li className="cx-etiqueta-nova">
          <Plus size={16} strokeWidth={2} aria-hidden="true" />
          <input
            id={`ficha-${campo}`}
            value={nova}
            onChange={(e) => setNova(e.target.value)}
            onKeyDown={tecla}
            onBlur={adicionar}
            placeholder={lista.length ? "Adicionar" : `Adicionar ${rotulo.toLowerCase()}`}
            aria-label={`Adicionar a ${rotulo}`}
            aria-invalid={erro ? true : undefined}
            maxLength={160}
          />
        </li>
      </ul>
      {erro ? <span className="cx-erro">{erro}</span> : null}
    </div>
  );
}

/** Cola um texto livre; a IA propõe o que muda em cada capítulo; a pessoa aprova. */
function ColarContexto({ valores, exemplo, aplicar }: { valores: FichaView; exemplo: boolean; aplicar: (p: Partial<FichaView>) => void }) {
  const trava = useTrava();
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [proposta, setProposta] = useState<Partial<Record<CampoProposta, string>> | null>(null);
  const [marcados, setMarcados] = useState<Record<string, boolean>>({});
  const [lendo, iniciar] = useTransition();

  function distribuir() {
    setErro(null);
    if (trava.bloquear()) return;
    if (exemplo) {
      setErro("No exemplo a IA não roda. Com a conta do seu negócio, o texto vira ficha.");
      return;
    }
    iniciar(async () => {
      const r = await distribuirContextoFichaAcao(valores, texto);
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      const chaves = Object.keys(r.proposta);
      if (!chaves.length) {
        setErro("O texto não trouxe nada novo para a ficha.");
        return;
      }
      setProposta(r.proposta);
      setMarcados(Object.fromEntries(chaves.map((c) => [c, true])));
    });
  }

  function aprovar() {
    if (!proposta) return;
    const p: Partial<FichaView> = {};
    for (const [c, v] of Object.entries(proposta) as [CampoProposta, string][]) if (marcados[c]) p[c] = v;
    if (p.objetivoOutro && !p.objetivo) p.objetivo = "OUTRO";
    aplicar(p);
    setProposta(null);
    setTexto("");
    setAberto(false);
  }

  const nMarcados = Object.values(marcados).filter(Boolean).length;

  if (!aberto) {
    return (
      <button type="button" className="cx-colar-abrir" onClick={() => setAberto(true)}>
        <span className="cx-colar-icone" aria-hidden="true">
          <ClipboardPaste size={22} strokeWidth={1.8} />
        </span>
        <span className="cx-colar-abrir-texto">
          <strong>Colar contexto</strong>
          <span>Cole o que o ChatGPT ou o Claude disse sobre a sua empresa. A IA distribui nos capítulos.</span>
        </span>
        <ArrowRight size={20} strokeWidth={2} aria-hidden="true" className="cx-colar-seta" />
      </button>
    );
  }

  return (
    <section className="cx-colar" aria-labelledby="cx-colar-t">
      <div className="cx-colar-cabeca">
        <h2 id="cx-colar-t" className="cx-colar-titulo">
          Colar contexto
        </h2>
        <CopiarTexto texto={PEDIDO_IA} rotulo="Copiar pedido para a IA" />
      </div>

      {proposta ? (
        <>
          <p className="cx-colar-apoio">Isto é o que mudaria. Desmarque o que não quiser.</p>
          <ul className="cx-colar-mudancas">
            {(Object.entries(proposta) as [CampoProposta, string][]).map(([c, v]) => (
              <li key={c}>
                <label className="cx-colar-mudanca">
                  <input type="checkbox" checked={!!marcados[c]} onChange={(e) => setMarcados((m) => ({ ...m, [c]: e.target.checked }))} />
                  <span className="cx-colar-mudanca-corpo">
                    <span className="cx-ficha-rotulo">{CAPITULO_DO_CAMPO[c]}</span>
                    <Diferenca campo={c} antes={valores[c]} depois={v} />
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div className="cx-colar-botoes">
            <button type="button" className="cx-botao cx-botao--azul" disabled={!nMarcados} onClick={aprovar}>
              <Check size={18} strokeWidth={2.2} aria-hidden="true" />
              Aplicar {nMarcados} {nMarcados === 1 ? "mudança" : "mudanças"}
            </button>
            <button type="button" className="cx-botao cx-botao--fantasma-escuro" onClick={() => setProposta(null)}>
              Descartar
            </button>
          </div>
        </>
      ) : (
        <>
          <label className="cx-so-leitor" htmlFor="cx-colar-texto">
            Texto sobre a empresa
          </label>
          <textarea
            id="cx-colar-texto"
            className="cx-colar-area"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Cole aqui o texto sobre a sua empresa…"
            maxLength={20000}
            disabled={lendo}
          />
          <div className="cx-colar-botoes">
            <button type="button" className="cx-botao cx-botao--azul" disabled={lendo || texto.trim().length < 40} onClick={distribuir}>
              {lendo ? "Lendo o texto…" : "Distribuir nos capítulos"}
            </button>
            <button type="button" className="cx-botao cx-botao--fantasma-escuro" disabled={lendo} onClick={() => setAberto(false)}>
              Fechar
            </button>
            <span className="cx-colar-conta">{texto.length.toLocaleString("pt-BR")} / 20.000</span>
          </div>
        </>
      )}
      {erro ? (
        <p className="cx-aviso cx-aviso--erro" role="alert">
          {erro}
        </p>
      ) : null}
    </section>
  );
}

function Diferenca({ campo, antes, depois }: { campo: CampoProposta; antes: string; depois: string }) {
  if (campo === "oQueVende" || campo === "paraQuem") {
    const a = paraEtiquetas(antes);
    const d = paraEtiquetas(depois);
    const tem = (l: string[], x: string) => l.some((y) => y.toLowerCase() === x.toLowerCase());
    return (
      <span className="cx-etiquetas cx-etiquetas--diff">
        {d.map((t) => (
          <span key={`d-${t}`} className="cx-etiqueta" data-diff={tem(a, t) ? undefined : "novo"}>
            {tem(a, t) ? null : <span className="cx-so-leitor">Nova: </span>}
            {t}
          </span>
        ))}
        {a
          .filter((t) => !tem(d, t))
          .map((t) => (
            <span key={`a-${t}`} className="cx-etiqueta" data-diff="sai">
              <span className="cx-so-leitor">Sai: </span>
              {t}
            </span>
          ))}
      </span>
    );
  }
  const mostrar = (v: string) => (campo === "objetivo" ? rotuloObjetivo(v) : v);
  return (
    <span className="cx-colar-texto-diff">
      {antes ? (
        <del>
          <span className="cx-so-leitor">Antes: </span>
          {mostrar(antes)}
        </del>
      ) : null}
      <ins>
        <span className="cx-so-leitor">Depois: </span>
        {mostrar(depois)}
      </ins>
    </span>
  );
}
