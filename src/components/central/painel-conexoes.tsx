"use client";

/**
 * Conexões como painel (DESIGN.md 6.11): o estado geral no topo, os
 * provedores de IA num rack com logo, status, modelo e "Testar", a tabela do
 * modelo de cada chefe (retratos + escolha em pílula) e as redes em blocos
 * com seguidores e última leitura. Conectar/trocar abre a gaveta embaixo do
 * rack, no lugar.
 */
import { ArrowUpRight, Check, ChevronDown, LoaderCircle, Plug, RefreshCw, Trash2, X } from "lucide-react";
import { useEffect, useId, useRef, useState, useTransition } from "react";

import { RetratoChefe, idDoChefe } from "@/components/central/chefe";
import { LogoMarca, MARCA_IA, MARCA_REDE } from "@/components/central/marcas";
import { SeletorModelo } from "@/components/chave-ia/seletor-modelo";
import { departamentoPorChefe } from "@/lib/central/departamentos";
import type { ChaveIaView, ModeloChefeView, ResultadoChave, ResultadoModelos } from "@/lib/ia/chaves-conta";
import { CATALOGO_IA, PROVEDORES_IA, type ProvedorIA } from "@/lib/ia/provedores/catalogo";
import type { ModeloAoVivo } from "@/lib/ia/provedores/modelos-tipos";
import { CATALOGO_REDES, REDES_CONECTAVEIS, type RedeConectavel } from "@/lib/redes/catalogo";
import { ALVO_DA_REDE } from "@/lib/redes/oauth-alvos";
import type { ConexaoView, ResultadoConexao, ResultadoTesteConexao } from "@/lib/redes/contas";
import { GuiaToken, situacaoToken } from "@/components/central/guia-token";

type LeituraRede = { seguidores: number | null; em: string };

type Props = {
  chaves: ChaveIaView[];
  chefes: readonly string[];
  escolhas: ModeloChefeView[];
  conexoes: ConexaoView[];
  leituras: Partial<Record<RedeConectavel, LeituraRede>>;
  podeEditar: boolean;
  agora: number;
  /** "Conectar com…" ligado (o app do .env está no ambiente). */
  oauth: { redes: RedeConectavel[]; openrouter: boolean };
  /** Aviso da volta do "Conectar com…" (já decifrado no servidor). */
  aviso: { ok: boolean; mensagem: string } | null;
  acoes: {
    salvarChave: (form: FormData) => Promise<ResultadoChave>;
    usarChave: (p: ProvedorIA) => Promise<ResultadoChave>;
    apagarChave: (p: ProvedorIA) => Promise<ResultadoChave>;
    testarChave: (p: ProvedorIA) => Promise<ResultadoChave>;
    modelosChaveNova: (p: ProvedorIA, chave: string) => Promise<ResultadoModelos>;
    modelosChaveSalva: (p: ProvedorIA) => Promise<ResultadoModelos>;
    salvarModeloChefe: (chefe: string, escolha: string) => Promise<ResultadoChave>;
    conectarRede: (form: FormData) => Promise<ResultadoConexao>;
    apagarRede: (rede: RedeConectavel) => Promise<ResultadoConexao>;
    testarRede: (form: FormData) => Promise<ResultadoTesteConexao>;
  };
};

const fmtInt = new Intl.NumberFormat("pt-BR");
const NOME_CURTO: Record<ProvedorIA, string> = { ANTHROPIC: "Claude", OPENAI: "ChatGPT", GOOGLE: "Gemini", DEEPSEEK: "DeepSeek", XAI: "Grok", OPENROUTER: "OpenRouter" };
const EMPRESA: Record<ProvedorIA, string> = { ANTHROPIC: "Anthropic", OPENAI: "OpenAI", GOOGLE: "Google", DEEPSEEK: "DeepSeek", XAI: "xAI", OPENROUTER: "Vários modelos" };

function haQuanto(iso: string | null, agora: number): string {
  if (!iso) return "—";
  const min = Math.max(0, Math.round((agora - new Date(iso).getTime()) / 60_000));
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "ontem" : `há ${d} dias`;
}

function compacto(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (n >= 10_000) return `${(n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return fmtInt.format(n);
}

export function PainelConexoes(p: Props) {
  const ativa = p.chaves.find((k) => k.ativa && k.validaEm) ?? null;
  const validas = p.conexoes.filter((c) => c.validaEm);
  const ultima = Object.values(p.leituras)
    .map((l) => l?.em)
    .filter((x): x is string => !!x)
    .sort()
    .at(-1) ?? null;

  return (
    <div className="cx-con">
      {p.aviso ? (
        <p role="status" className={`cx-aviso cx-con-aviso ${p.aviso.ok ? "cx-aviso--ok" : "cx-aviso--erro"}`}>
          {p.aviso.ok ? <Check size={15} strokeWidth={2.4} aria-hidden="true" /> : <X size={15} strokeWidth={2.4} aria-hidden="true" />}
          {p.aviso.mensagem}
        </p>
      ) : null}
      <section className="cx-con-estado" aria-label="Estado geral">
        <div className="cx-con-estado-item">
          <p className="cx-con-rotulo">Inteligência</p>
          {ativa ? (
            <p className="cx-con-estado-valor">
              <span className="cx-con-estado-logo">
                <LogoMarca marca={MARCA_IA[ativa.provedor]} tamanho={22} />
              </span>
              <span>
                <strong>{NOME_CURTO[ativa.provedor]} conectado</strong>
                <span className="cx-con-estado-apoio">{ativa.modelo}</span>
              </span>
            </p>
          ) : (
            <p className="cx-con-estado-valor">
              <strong>Sem chave de IA</strong>
              <span className="cx-con-estado-apoio">Os chefes param até conectar.</span>
            </p>
          )}
        </div>
        <div className="cx-con-estado-item">
          <p className="cx-con-rotulo">Redes conectadas</p>
          <p className="cx-con-estado-numero">
            {validas.length}
            <small> de {REDES_CONECTAVEIS.length}</small>
          </p>
          <ul className="cx-con-estado-redes" aria-label="Redes">
            {REDES_CONECTAVEIS.map((r) => {
              const ok = validas.some((c) => c.rede === r);
              return (
                <li key={r} data-ok={ok ? "" : undefined} title={`${CATALOGO_REDES[r].nome}: ${ok ? "conectada" : "não conectada"}`}>
                  <LogoMarca marca={MARCA_REDE[r]} tamanho={16} />
                  <span className="cx-so-leitor">
                    {CATALOGO_REDES[r].nome}: {ok ? "conectada" : "não conectada"}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="cx-con-estado-item">
          <p className="cx-con-rotulo">Última leitura</p>
          <p className="cx-con-estado-numero">{ultima ? haQuanto(ultima, p.agora) : "—"}</p>
          <p className="cx-con-estado-apoio">{ultima ? "das redes, pelos chefes" : "Nenhuma rede lida ainda"}</p>
        </div>
      </section>

      <RackProvedores {...p} />
      <TabelaModelos {...p} />
      <BlocosRedes {...p} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Provedores de IA
// ---------------------------------------------------------------------------

/** Caminho do "Conectar com…" (rota de servidor; navegação de página inteira). */
const conectarCom = (alvo: string) => `/api/central/conectar/${alvo}`;

function RackProvedores({ chaves, podeEditar, acoes, oauth }: Props) {
  // Com o OpenRouter de um clique, ninguém cai direto no formulário de chave.
  const [aberto, setAberto] = useState<ProvedorIA | null>(chaves.length || oauth.openrouter ? null : "ANTHROPIC");
  // Um clique primeiro; quem já tem chave segue na ordem de sempre.
  const ordem = oauth.openrouter ? (["OPENROUTER", ...PROVEDORES_IA.filter((x) => x !== "OPENROUTER")] as ProvedorIA[]) : PROVEDORES_IA.filter((x) => x !== "OPENROUTER" || chaves.some((c) => c.provedor === x));
  const [resultado, setResultado] = useState<{ p: ProvedorIA; r: ResultadoChave } | null>(null);
  const [ocupado, setOcupado] = useState<{ p: ProvedorIA; o: "testar" | "usar" | "apagar" } | null>(null);
  const [confirmar, setConfirmar] = useState<ProvedorIA | null>(null);
  const [, iniciar] = useTransition();

  function rodar(prov: ProvedorIA, o: "testar" | "usar" | "apagar", fn: () => Promise<ResultadoChave>) {
    setResultado(null);
    setOcupado({ p: prov, o });
    iniciar(async () => {
      const r = await fn();
      setResultado({ p: prov, r });
      setOcupado(null);
      setConfirmar(null);
    });
  }

  return (
    <section className="cx-con-secao" aria-labelledby="cx-con-ia">
      <div className="cx-con-secao-cabeca">
        <h2 id="cx-con-ia" className="cx-con-secao-titulo">
          Provedores de IA
        </h2>
        <p className="cx-con-secao-apoio">
          Os chefes usam a sua conta; o provedor cobra direto de você.{oauth.openrouter ? " O jeito mais fácil: OpenRouter, com um clique, dá acesso a Claude, GPT e Gemini." : ""}
        </p>
      </div>
      <ul className="cx-rack">
        {ordem.map((prov) => {
          const k = chaves.find((c) => c.provedor === prov);
          const estado = !k ? "fora" : !k.validaEm ? "caiu" : k.ativa ? "uso" : "ok";
          const ocup = ocupado?.p === prov ? ocupado.o : null;
          const res = resultado?.p === prov ? resultado.r : null;
          return (
            <li key={prov} className="cx-rack-item" data-estado={estado} data-aberto={aberto === prov ? "" : undefined}>
              <span className="cx-rack-logo">
                <LogoMarca marca={MARCA_IA[prov]} tamanho={28} />
              </span>
              <p className="cx-rack-nome">
                {NOME_CURTO[prov]}
                <span>{EMPRESA[prov]}</span>
              </p>
              <p className="cx-rack-status" data-estado={estado}>
                {estado === "uso" ? "Em uso" : estado === "ok" ? "Conectado" : estado === "caiu" ? "Falhou no teste" : "Não conectado"}
              </p>
              <p className="cx-rack-modelo">{k ? k.modelo : CATALOGO_IA[prov].modeloPadrao}</p>
              {k && !k.validaEm ? null : k ? <p className="cx-rack-final">final {k.ultimos4}</p> : <p className="cx-rack-final">&nbsp;</p>}
              <div className="cx-rack-acoes">
                {k && podeEditar ? (
                  <>
                    <button type="button" className="cx-rack-botao" disabled={!!ocupado} onClick={() => rodar(prov, "testar", () => acoes.testarChave(prov))}>
                      {ocup === "testar" ? <LoaderCircle size={15} className="cx-girando" aria-hidden="true" /> : <RefreshCw size={15} strokeWidth={2} aria-hidden="true" />}
                      {ocup === "testar" ? "Testando…" : "Testar"}
                    </button>
                    {estado === "ok" ? (
                      <button type="button" className="cx-rack-botao" disabled={!!ocupado} onClick={() => rodar(prov, "usar", () => acoes.usarChave(prov))}>
                        Usar
                      </button>
                    ) : null}
                    <button type="button" className="cx-rack-botao" onClick={() => setAberto(aberto === prov ? null : prov)} aria-expanded={aberto === prov}>
                      Trocar
                    </button>
                    {confirmar === prov ? (
                      <button type="button" className="cx-rack-botao cx-rack-botao--perigo" disabled={!!ocupado} onClick={() => rodar(prov, "apagar", () => acoes.apagarChave(prov))}>
                        Confirmar
                      </button>
                    ) : (
                      <button type="button" className="cx-rack-botao cx-rack-botao--icone" aria-label={`Apagar a chave ${NOME_CURTO[prov]}`} onClick={() => setConfirmar(prov)}>
                        <Trash2 size={15} strokeWidth={2} aria-hidden="true" />
                      </button>
                    )}
                  </>
                ) : podeEditar && prov === "OPENROUTER" && oauth.openrouter ? (
                  <>
                    <a className="cx-rack-botao cx-rack-botao--cheio" href={conectarCom("openrouter")}>
                      <Plug size={15} strokeWidth={2} aria-hidden="true" />
                      Conectar com um clique
                    </a>
                    <button type="button" className="cx-rack-botao" onClick={() => setAberto(aberto === prov ? null : prov)} aria-expanded={aberto === prov}>
                      Colar chave
                    </button>
                  </>
                ) : podeEditar ? (
                  <button type="button" className="cx-rack-botao cx-rack-botao--cheio" onClick={() => setAberto(aberto === prov ? null : prov)} aria-expanded={aberto === prov}>
                    <Plug size={15} strokeWidth={2} aria-hidden="true" />
                    Conectar
                  </button>
                ) : null}
              </div>
              {res ? (
                <p role="status" className={`cx-rack-res ${res.ok ? "cx-aviso--ok" : "cx-aviso--erro"}`}>
                  {res.ok ? <Check size={14} strokeWidth={2.4} aria-hidden="true" /> : <X size={14} strokeWidth={2.4} aria-hidden="true" />}
                  {res.mensagem}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
      {aberto && podeEditar ? (
        <GavetaChave
          key={aberto}
          provedor={aberto}
          fechar={() => setAberto(null)}
          salvar={acoes.salvarChave}
          listarModelos={acoes.modelosChaveNova}
          aoSalvar={(r) => setResultado({ p: aberto, r })}
        />
      ) : null}
      {!podeEditar ? <p className="cx-dica">Só o dono da conta conecta ou troca a chave.</p> : null}
    </section>
  );
}

function GavetaChave({
  provedor,
  fechar,
  salvar,
  listarModelos,
  aoSalvar,
}: {
  provedor: ProvedorIA;
  fechar: () => void;
  salvar: (form: FormData) => Promise<ResultadoChave>;
  listarModelos: (p: ProvedorIA, chave: string) => Promise<ResultadoModelos>;
  aoSalvar: (r: ResultadoChave) => void;
}) {
  const id = useId();
  const info = CATALOGO_IA[provedor];
  const [chave, setChave] = useState("");
  const [modelo, setModelo] = useState("");
  const [modelos, setModelos] = useState<ModeloAoVivo[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const pedido = useRef(0);
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (espera.current) clearTimeout(espera.current);
  }, []);

  function buscar(bruta: string) {
    const k = bruta.trim();
    const n = ++pedido.current;
    if (espera.current) clearTimeout(espera.current);
    setModelos(null);
    setErro(null);
    if (k.length < 10 || /\s/.test(k)) return setBuscando(false);
    setBuscando(true);
    espera.current = setTimeout(async () => {
      const r = await listarModelos(provedor, k).catch(() => ({ ok: false as const, mensagem: "Não deu para buscar os modelos agora." }));
      if (n !== pedido.current) return;
      setBuscando(false);
      if (r.ok) {
        setModelos(r.modelos);
        const sugerido = r.modelos.find((m) => m.id === info.modeloPadrao && m.tipo === "texto");
        setModelo((m) => (r.modelos.some((x) => x.id === m) ? m : (sugerido?.id ?? "")));
      } else setErro(r.mensagem);
    }, 350);
  }

  function enviar(form: FormData) {
    if (!modelo) return setErro("Selecione o modelo.");
    form.set("provedor", provedor);
    setErro(null);
    iniciar(async () => {
      const r = await salvar(form);
      if (r.ok) {
        aoSalvar(r);
        fechar();
      } else setErro(r.mensagem);
    });
  }

  return (
    <form action={enviar} className="cx-gaveta" aria-label={`Conectar ${info.nome}`} autoComplete="off">
      <div className="cx-gaveta-cabeca">
        <span className="cx-rack-logo">
          <LogoMarca marca={MARCA_IA[provedor]} tamanho={24} />
        </span>
        <p className="cx-gaveta-titulo">Conectar {info.nome}</p>
        <button type="button" className="cx-rack-botao cx-rack-botao--icone" aria-label="Fechar" onClick={fechar}>
          <X size={16} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
      <div className="cx-gaveta-campos">
        <div className="cx-campo">
          <label className="cx-campo-rotulo" htmlFor={`${id}-chave`}>
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
            className="cx-input"
            placeholder="Cole aqui a chave"
            value={chave}
            onChange={(e) => {
              setChave(e.target.value);
              buscar(e.target.value);
            }}
          />
          <a className="cx-gaveta-link" href={info.ondePegar} target="_blank" rel="noopener noreferrer">
            Criar a chave em {new URL(info.ondePegar).host}
            <ArrowUpRight size={14} strokeWidth={2} aria-hidden="true" />
          </a>
        </div>
        <div className="cx-campo">
          <span className="cx-campo-rotulo" id={`${id}-modelo-r`}>
            Modelo
          </span>
          <SeletorModelo id={`${id}-modelo`} rotuloId={`${id}-modelo-r`} name="modelo" modelos={modelos} carregando={buscando} valor={modelo} onChange={setModelo} disabled={pendente} />
        </div>
      </div>
      <div className="cx-gaveta-rodape">
        <button type="submit" className="cx-botao cx-botao--azul" disabled={pendente || !modelo}>
          {pendente ? "Testando…" : "Salvar e testar"}
        </button>
        {erro ? (
          <p role="alert" className="cx-aviso cx-aviso--erro">
            {erro}
          </p>
        ) : (
          <p className="cx-dica">Fica guardada cifrada; aqui aparecem só os 4 últimos caracteres.</p>
        )}
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Modelo de cada chefe
// ---------------------------------------------------------------------------

type Lista = { modelos: ModeloAoVivo[] | null; erro: string | null };

function TabelaModelos({ chefes, chaves, escolhas, podeEditar, acoes }: Props) {
  const validas = chaves.filter((k) => k.validaEm);
  const ativa = validas.find((k) => k.ativa) ?? validas[0] ?? null;
  const provs = validas.map((k) => k.provedor).join(",");
  const [escolhido, setEscolhido] = useState<Record<string, { provedor: ProvedorIA; modelo: string } | null>>(() =>
    Object.fromEntries(chefes.map((c) => [c, escolhas.find((x) => x.chefe === c) ?? null])),
  );
  const [listas, setListas] = useState<Partial<Record<ProvedorIA, Lista>>>({});
  const [outro, setOutro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ chefe: string; r: ResultadoChave } | null>(null);
  const [pendente, iniciar] = useTransition();

  const listar = acoes.modelosChaveSalva;
  useEffect(() => {
    let vivo = true;
    for (const p of provs.split(",").filter(Boolean) as ProvedorIA[]) {
      listar(p)
        .catch(() => ({ ok: false as const, mensagem: "Não deu para buscar os modelos agora." }))
        .then((r) => {
          if (vivo) setListas((l) => ({ ...l, [p]: r.ok ? { modelos: r.modelos, erro: null } : { modelos: null, erro: r.mensagem } }));
        });
    }
    return () => {
      vivo = false;
    };
  }, [provs, listar]);

  function trocar(chefe: string, provedor: ProvedorIA, valor: string) {
    const antes = escolhido[chefe];
    const novo = valor === "padrao" ? null : { provedor, modelo: valor };
    setEscolhido((v) => ({ ...v, [chefe]: novo }));
    setAviso(null);
    setOutro(null);
    iniciar(async () => {
      const r = await acoes.salvarModeloChefe(chefe, novo ? `${provedor}|${valor}` : "padrao");
      if (!r.ok) setEscolhido((v) => ({ ...v, [chefe]: antes }));
      setAviso({ chefe, r });
    });
  }

  return (
    <section className="cx-con-secao" aria-labelledby="cx-con-modelos">
      <div className="cx-con-secao-cabeca">
        <h2 id="cx-con-modelos" className="cx-con-secao-titulo">
          Modelo de cada chefe
        </h2>
        <p className="cx-con-secao-apoio">Sem escolha, o chefe usa o padrão da chave em uso{ativa ? ` (${ativa.modelo})` : ""}.</p>
      </div>
      {!ativa ? (
        <p className="cx-dica">Conecte um provedor acima para escolher o modelo de cada chefe.</p>
      ) : (
        <div className="cx-tabela-caixa">
          <table className="cx-modelos-tabela">
            <thead>
              <tr>
                <th scope="col" className="cx-modelos-col-retrato">
                  <span className="cx-so-leitor">Retrato</span>
                </th>
                <th scope="col">Chefe</th>
                <th scope="col">Modelo</th>
              </tr>
            </thead>
            <tbody>
              {chefes.map((chefe) => {
                const e = escolhido[chefe];
                const prov = e?.provedor ?? ativa.provedor;
                const lista = listas[prov];
                const texto = (lista?.modelos ?? []).filter((m) => m.tipo === "texto");
                // Pílulas: o padrão, os modelos sugeridos que a chave enxerga e o escolhido.
                const sugeridos = CATALOGO_IA[prov].modelos.filter((m) => texto.some((t) => t.id === m) && m !== ativa.modelo);
                const pilulas = [...new Set([...sugeridos, ...(e ? [e.modelo] : [])])].filter((m) => !(prov === ativa.provedor && m === ativa.modelo)).slice(0, 4);
                const id = `cx-mod-${idDoChefe(chefe)}`;
                return (
                  <tr key={chefe} data-chefe={idDoChefe(chefe)}>
                    <td className="cx-modelos-col-retrato">
                      <span className="cx-modelos-retrato">
                        <RetratoChefe nome={chefe} tamanho={72} />
                      </span>
                    </td>
                    <th scope="row" className="cx-modelos-chefe" id={`${id}-r`}>
                      {chefe}
                      <span>{departamentoPorChefe(chefe)?.nome ?? "Diretoria"}</span>
                    </th>
                    <td>
                      <div className="cx-pilulas" role="radiogroup" aria-labelledby={`${id}-r`}>
                        <BotaoPilula ativo={!e} disabled={!podeEditar || pendente} onClick={() => trocar(chefe, ativa.provedor, "padrao")}>
                          Padrão
                        </BotaoPilula>
                        {pilulas.map((m) => (
                          <BotaoPilula key={m} ativo={e?.modelo === m} disabled={!podeEditar || pendente} onClick={() => trocar(chefe, prov, m)}>
                            {m}
                          </BotaoPilula>
                        ))}
                        {texto.length > pilulas.length + 1 ? (
                          <button
                            type="button"
                            className="cx-pilula cx-pilula--outro"
                            aria-expanded={outro === chefe}
                            disabled={!podeEditar || pendente}
                            onClick={() => setOutro(outro === chefe ? null : chefe)}
                          >
                            Outro
                            <ChevronDown size={14} strokeWidth={2.2} aria-hidden="true" />
                          </button>
                        ) : null}
                        {!lista ? <LoaderCircle size={16} className="cx-girando cx-pilulas-carregando" aria-label="Carregando modelos" /> : null}
                      </div>
                      {outro === chefe ? (
                        <div className="cx-pilulas-outro">
                          <SeletorModelo
                            id={id}
                            rotuloId={`${id}-r`}
                            modelos={lista?.modelos ?? null}
                            carregando={!lista}
                            semLista={lista?.erro ?? "Lista indisponível"}
                            valor={e && e.provedor === prov ? e.modelo : ""}
                            onChange={(v) => trocar(chefe, prov, v)}
                            disabled={!podeEditar || pendente}
                          />
                        </div>
                      ) : null}
                      {lista?.erro ? <p className="cx-aviso cx-aviso--erro">{lista.erro}</p> : null}
                      {aviso?.chefe === chefe ? (
                        <p role="status" className={`cx-aviso ${aviso.r.ok ? "cx-aviso--ok" : "cx-aviso--erro"}`}>
                          {aviso.r.ok ? "Salvo." : aviso.r.mensagem}
                        </p>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {!podeEditar ? <p className="cx-dica">Só o dono da conta troca o modelo dos chefes.</p> : null}
    </section>
  );
}

function BotaoPilula({ ativo, disabled, onClick, children }: { ativo: boolean; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" role="radio" aria-checked={ativo} className="cx-pilula" disabled={disabled} onClick={onClick}>
      {ativo ? <Check size={14} strokeWidth={2.6} aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Redes
// ---------------------------------------------------------------------------

function BlocosRedes({ conexoes, leituras, podeEditar, agora, acoes, oauth }: Props) {
  const [aberto, setAberto] = useState<RedeConectavel | null>(null);
  const [resultado, setResultado] = useState<{ rede: RedeConectavel; r: ResultadoConexao } | null>(null);
  const [confirmar, setConfirmar] = useState<RedeConectavel | null>(null);
  const [pendente, iniciar] = useTransition();
  const porRede = new Map(conexoes.map((c) => [c.rede, c]));

  function apagar(rede: RedeConectavel) {
    iniciar(async () => {
      const r = await acoes.apagarRede(rede);
      setResultado({ rede, r });
      setConfirmar(null);
    });
  }

  return (
    <section className="cx-con-secao" aria-labelledby="cx-con-redes">
      <div className="cx-con-secao-cabeca">
        <h2 id="cx-con-redes" className="cx-con-secao-titulo">
          Redes
        </h2>
        <p className="cx-con-secao-apoio">Conectadas, os chefes trabalham com os seus números reais. A Central só lê daqui; quem publica é o Buffer, depois da sua aprovação.</p>
      </div>
      <ul className="cx-redes-blocos">
        {REDES_CONECTAVEIS.map((rede) => {
          const c = porRede.get(rede) ?? null;
          const info = CATALOGO_REDES[rede];
          const sit = situacaoToken(c, agora);
          const estado = sit.estado === "vence" ? "ok" : sit.estado;
          const l = leituras[rede];
          const res = resultado?.rede === rede ? resultado.r : null;
          return (
            <li key={rede} className="cx-rede-bloco" data-estado={estado} data-marca={rede.toLowerCase()}>
              <div className="cx-rede-bloco-topo">
                <span className="cx-rede-logo">
                  <LogoMarca marca={MARCA_REDE[rede]} tamanho={22} />
                </span>
                <span className="cx-rack-status" data-estado={sit.estado === "ok" ? "uso" : sit.estado === "vence" ? "caiu" : sit.estado}>
                  {sit.estado === "ok" ? "Conectada" : sit.estado === "vence" ? sit.texto : sit.estado === "caiu" ? "Token caiu" : "Não conectada"}
                </span>
              </div>
              <p className="cx-rede-nome">{info.nome}</p>
              <p className="cx-rede-conta">{c ? c.nome : "—"}</p>
              <dl className="cx-rede-numeros">
                <div>
                  <dt>{rede === "YOUTUBE" ? "Inscritos" : "Seguidores"}</dt>
                  <dd className="cx-rede-seguidores">{l?.seguidores != null ? compacto(l.seguidores) : "—"}</dd>
                </div>
                <div>
                  <dt>Sincronizada</dt>
                  <dd>{l ? haQuanto(l.em, agora) : c?.validaEm ? `teste ${haQuanto(c.validaEm, agora)}` : "—"}</dd>
                </div>
              </dl>
              <div className="cx-rede-acoes">
                {podeEditar && oauth.redes.includes(rede) ? (
                  <>
                    <a
                      className={`cx-rack-botao${c && sit.estado === "ok" ? "" : " cx-rack-botao--cheio"}`}
                      href={conectarCom(ALVO_DA_REDE[rede])}
                      aria-label={`${!c ? "Conectar" : "Reconectar"} com ${info.nome}`}
                    >
                      {!c ? <Plug size={15} strokeWidth={2} aria-hidden="true" /> : null}
                      {!c ? `Conectar com ${info.nome}` : sit.estado === "caiu" || sit.estado === "vence" ? "Reconectar" : "Trocar conta"}
                    </a>
                    <button type="button" className="cx-rack-botao" aria-expanded={aberto === rede} onClick={() => setAberto(aberto === rede ? null : rede)}>
                      Colar token
                    </button>
                  </>
                ) : podeEditar ? (
                  <button
                    type="button"
                    className={`cx-rack-botao${c ? "" : " cx-rack-botao--cheio"}`}
                    aria-expanded={aberto === rede}
                    onClick={() => setAberto(aberto === rede ? null : rede)}
                  >
                    {!c ? "Conectar" : sit.estado === "caiu" || sit.estado === "vence" ? "Renovar" : "Trocar token"}
                  </button>
                ) : null}
                {c && podeEditar ? (
                  confirmar === rede ? (
                    <button type="button" className="cx-rack-botao cx-rack-botao--perigo" disabled={pendente} onClick={() => apagar(rede)}>
                      Confirmar
                    </button>
                  ) : (
                    <button type="button" className="cx-rack-botao cx-rack-botao--icone" aria-label={`Desconectar ${info.nome}`} onClick={() => setConfirmar(rede)}>
                      <Trash2 size={15} strokeWidth={2} aria-hidden="true" />
                    </button>
                  )
                ) : null}
              </div>
              {oauth.redes.includes(rede) ? null : (
                <button type="button" className="cx-gaveta-link cx-guia-abrir" aria-expanded={aberto === rede} onClick={() => setAberto(aberto === rede ? null : rede)}>
                  Como pegar o token
                  <ArrowUpRight size={14} strokeWidth={2} aria-hidden="true" />
                </button>
              )}
              {res ? (
                <p role="status" className={`cx-rack-res ${res.ok ? "cx-aviso--ok" : "cx-aviso--erro"}`}>
                  {res.mensagem}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
      {aberto ? (
        <GuiaToken
          key={aberto}
          rede={aberto}
          conexao={porRede.get(aberto) ?? null}
          podeEditar={podeEditar}
          agora={agora}
          testar={acoes.testarRede}
          conectar={acoes.conectarRede}
          fechar={() => setAberto(null)}
          aoSalvar={(r) => setResultado({ rede: aberto, r })}
        />
      ) : null}
      {!podeEditar ? <p className="cx-dica">Só o dono da conta conecta ou troca as contas das redes.</p> : null}
    </section>
  );
}
