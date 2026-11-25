"use client";

import { ArrowUpRight, Check, LoaderCircle, RefreshCw, ShieldCheck, X } from "lucide-react";
import { useEffect, useId, useRef, useState, useTransition } from "react";

import { LogoMarca, MARCA_REDE } from "@/components/central/marcas";
import { CATALOGO_REDES, type CampoExtra, type RedeConectavel } from "@/lib/redes/catalogo";
import type { ConexaoView, ResultadoConexao, ResultadoTesteConexao } from "@/lib/redes/contas";

const fmtData = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "numeric", month: "short", year: "numeric" });
const OPCIONAIS = new Set<CampoExtra["nome"]>(["oauth", "clientId", "clientSecret", "appId", "appSecret"]);

/** Situação do token de uma conexão: o que a tela mostra no bloco e no guia. */
export function situacaoToken(c: ConexaoView | null, agora: number): { estado: "fora" | "ok" | "vence" | "caiu"; texto: string } {
  if (!c) return { estado: "fora", texto: "Não conectada" };
  if (!c.validaEm) return { estado: "caiu", texto: "Token caiu: renove" };
  if (c.expiraEm) {
    const dias = Math.ceil((new Date(c.expiraEm).getTime() - agora) / 86_400_000);
    if (dias <= 0) return { estado: "caiu", texto: "Token venceu: renove" };
    if (c.renovaSozinho) return { estado: "ok", texto: "Conectada · renova sozinho" };
    if (dias <= 7) return { estado: "vence", texto: `Vence em ${dias} ${dias === 1 ? "dia" : "dias"}` };
    return { estado: "ok", texto: `Conectada · vence ${fmtData.format(new Date(c.expiraEm))}` };
  }
  return { estado: "ok", texto: c.renovaSozinho ? "Conectada · renova sozinho" : "Conectada" };
}

function Midia({ src, legenda, n }: { src?: string; legenda?: string; n: number }) {
  if (!src) return null;
  const texto = legenda ?? `Passo ${n}`;
  return (
    <figure className="cx-guia-figura">
      {/\.(mp4|webm)$/i.test(src) ? (
        <video className="cx-guia-midia" src={src} controls muted playsInline preload="metadata" aria-label={texto} />
      ) : (
        <a href={src} target="_blank" rel="noopener noreferrer" className="cx-guia-midia-link" aria-label={`${texto} (abre o print inteiro em nova aba)`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="cx-guia-midia" src={src} alt="" loading="lazy" decoding="async" width={1600} height={1067} />
        </a>
      )}
      <figcaption className="cx-guia-legenda">{texto}</figcaption>
    </figure>
  );
}

/**
 * Guia "Como pegar o token" na própria página: os passos numerados com o link
 * direto de cada um e o espaço do print/vídeo; ao lado, o campo do token,
 * Testar (chama a rede de verdade, sem gravar), o status, Salvar e como o
 * token se renova.
 */
export function GuiaToken({
  rede,
  conexao,
  podeEditar,
  agora,
  testar,
  conectar,
  fechar,
  aoSalvar,
}: {
  rede: RedeConectavel;
  conexao: ConexaoView | null;
  podeEditar: boolean;
  agora: number;
  testar: (form: FormData) => Promise<ResultadoTesteConexao>;
  conectar: (form: FormData) => Promise<ResultadoConexao>;
  fechar: () => void;
  aoSalvar: (r: ResultadoConexao) => void;
}) {
  const id = useId();
  const info = CATALOGO_REDES[rede];
  const raiz = useRef<HTMLElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const [teste, setTeste] = useState<ResultadoTesteConexao | null>(null);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [testando, iniciarTeste] = useTransition();
  const [salvando, iniciarSalvar] = useTransition();
  const sit = situacaoToken(conexao, agora);
  const principais = info.extras.filter((e) => rede === "GOOGLE_EMPRESA" || !OPCIONAIS.has(e.nome));
  const opcionais = info.extras.filter((e) => !principais.includes(e));

  useEffect(() => {
    raiz.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    raiz.current?.focus({ preventScroll: true });
  }, []);

  function dados(): FormData {
    const f = new FormData(form.current!);
    f.set("rede", rede);
    return f;
  }

  function rodarTeste() {
    setErroSalvar(null);
    iniciarTeste(async () => setTeste(await testar(dados())));
  }

  function salvar() {
    setErroSalvar(null);
    iniciarSalvar(async () => {
      const r = await conectar(dados());
      if (r.ok) {
        aoSalvar(r);
        fechar();
      } else setErroSalvar(r.mensagem);
    });
  }

  const campo = (e: CampoExtra) => (
    <div key={e.nome} className="cx-campo">
      <label className="cx-campo-rotulo" htmlFor={`${id}-${e.nome}`}>
        {e.rotulo}
      </label>
      <input
        id={`${id}-${e.nome}`}
        name={e.nome}
        type={e.secreto ? "password" : "text"}
        autoComplete="off"
        spellCheck={false}
        maxLength={e.secreto ? 4000 : 300}
        className="cx-input"
        disabled={!podeEditar}
        onChange={() => setTeste(null)}
      />
      <p className="cx-dica">{e.ajuda}</p>
    </div>
  );

  return (
    <section ref={raiz} tabIndex={-1} className="cx-guia" data-marca={rede.toLowerCase()} aria-labelledby={`${id}-t`}>
      <header className="cx-guia-cabeca">
        <span className="cx-rede-logo">
          <LogoMarca marca={MARCA_REDE[rede]} tamanho={24} />
        </span>
        <div className="cx-guia-cabeca-texto">
          <h3 id={`${id}-t`} className="cx-guia-titulo">
            Como pegar o token do {info.nome}
          </h3>
          <p className="cx-dica">{info.paraQue}</p>
        </div>
        <button type="button" className="cx-rack-botao cx-rack-botao--icone" aria-label="Fechar guia" onClick={fechar}>
          <X size={16} strokeWidth={2} aria-hidden="true" />
        </button>
      </header>

      <div className="cx-guia-corpo">
        <ol className="cx-guia-passos">
          {info.guia.map((p, i) => (
            <li key={p.titulo} className="cx-guia-passo">
              <span className="cx-guia-num" aria-hidden="true">
                {i + 1}
              </span>
              <div className="cx-guia-passo-texto">
                <p className="cx-guia-passo-titulo">
                  <span className="cx-so-leitor">Passo {i + 1}: </span>
                  {p.titulo}
                </p>
                <p className="cx-guia-passo-desc">{p.texto}</p>
                {p.link ? (
                  <a href={p.link.url} target="_blank" rel="noopener noreferrer" className="cx-guia-link">
                    {p.link.rotulo}
                    <ArrowUpRight size={15} strokeWidth={2.2} aria-hidden="true" />
                    <span className="cx-so-leitor"> (abre em nova aba)</span>
                  </a>
                ) : null}
              </div>
              <Midia src={p.midia} legenda={p.legenda} n={i + 1} />
            </li>
          ))}
        </ol>

        <form ref={form} className="cx-guia-form" autoComplete="off" onSubmit={(e) => e.preventDefault()} aria-label={`Token do ${info.nome}`}>
          <p className="cx-guia-status" data-estado={sit.estado}>
            <span className="cx-guia-status-ponto" aria-hidden="true" />
            {conexao ? `${sit.texto} · ${conexao.nome}` : sit.texto}
          </p>

          <div className="cx-campo">
            <label className="cx-campo-rotulo" htmlFor={`${id}-token`}>
              {info.rotuloToken}
            </label>
            <input
              id={`${id}-token`}
              name="token"
              type="password"
              autoComplete="off"
              spellCheck={false}
              required
              minLength={20}
              maxLength={4000}
              className="cx-input cx-guia-token"
              placeholder="Cole aqui o token"
              disabled={!podeEditar}
              onChange={() => setTeste(null)}
            />
            <p className="cx-dica">{info.dicaToken}</p>
          </div>
          {principais.map(campo)}
          {opcionais.length ? (
            <details className="cx-guia-opcional">
              <summary>{rede === "YOUTUBE" ? "Retenção e renovação (opcional)" : "Renovar sozinho (opcional)"}</summary>
              <div className="cx-guia-opcional-campos">{opcionais.map(campo)}</div>
            </details>
          ) : null}

          {podeEditar ? (
            <div className="cx-guia-botoes">
              <button type="button" className="cx-botao cx-botao--suave" onClick={rodarTeste} disabled={testando || salvando}>
                {testando ? <LoaderCircle size={17} className="cx-girando" aria-hidden="true" /> : <RefreshCw size={16} strokeWidth={2.2} aria-hidden="true" />}
                {testando ? "Testando…" : "Testar"}
              </button>
              <button type="button" className="cx-botao cx-botao--azul" onClick={salvar} disabled={!teste?.ok || salvando || testando}>
                {salvando ? "Salvando…" : "Salvar conexão"}
              </button>
            </div>
          ) : (
            <p className="cx-dica">Só o dono da conta conecta ou troca o token.</p>
          )}

          <div aria-live="polite">
            {teste ? (
              <p className={`cx-guia-resultado ${teste.ok ? "cx-guia-resultado--ok" : "cx-guia-resultado--erro"}`}>
                {teste.ok ? <Check size={17} strokeWidth={2.4} aria-hidden="true" /> : null}
                <span>
                  {teste.mensagem}
                  {teste.ok && teste.expiraEm ? ` Vence ${fmtData.format(new Date(teste.expiraEm))}.` : ""}
                  {teste.ok ? " Agora é só salvar." : ""}
                </span>
              </p>
            ) : null}
            {erroSalvar ? (
              <p role="alert" className="cx-guia-resultado cx-guia-resultado--erro">
                {erroSalvar}
              </p>
            ) : null}
          </div>

          <div className="cx-guia-renova">
            <ShieldCheck size={18} strokeWidth={2} aria-hidden="true" />
            <p>
              <strong>Renovação.</strong> {info.renovacao}
            </p>
          </div>
        </form>
      </div>
    </section>
  );
}
