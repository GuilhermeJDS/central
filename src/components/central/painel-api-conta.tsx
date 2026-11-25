"use client";

import { Check, Copy, KeyRound, Plug, TriangleAlert } from "lucide-react";
import { useId, useState, useTransition } from "react";

import type { ResultadoNovaChave } from "@/app/central/acoes-api-conta";
import { ESCOPOS_CONTA } from "@/lib/api-conta/escopos";

export type ChaveContaView = {
  id: string;
  nome: string;
  prefixo: string;
  escopos: string[];
  criadoEm: string;
  ultimoUsoEm: string | null;
};

export type FerramentaView = {
  nome: string;
  escopo: string;
  descricao: string;
};

const ROTULO_ESCOPO: Record<string, string> = Object.fromEntries(
  ESCOPOS_CONTA.map((e) => [e.id, e.rotulo]),
);

const data = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  });

function quando(iso: string | null, agora: number): string {
  if (!iso) return "Nunca usada";
  const min = Math.round((agora - new Date(iso).getTime()) / 60_000);
  if (min < 2) return "Usada agora";
  if (min < 60) return `Usada há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `Usada há ${h} h`;
  return `Usada em ${data(iso)}`;
}

/** Copiar o texto exato (a chave tem _ e -; nada é alterado). */
function Copiar({ texto, rotulo }: { texto: string; rotulo: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      className="cx-botao cx-botao--suave cx-api-copiar"
      aria-live="polite"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto);
          setOk(true);
          setTimeout(() => setOk(false), 1800);
        } catch {
          setOk(false);
        }
      }}
    >
      {ok ? (
        <Check size={16} strokeWidth={2} aria-hidden="true" />
      ) : (
        <Copy size={16} strokeWidth={1.8} aria-hidden="true" />
      )}
      {ok ? "Copiado" : rotulo}
    </button>
  );
}

/**
 * Conexões › API e MCP: o dono cria uma chave (vista uma vez), revoga e vê
 * como ligar o MCP. A chave alcança só esta conta, com os escopos escolhidos.
 */
export function PainelApiConta({
  chaves,
  ferramentas,
  base,
  podeEditar,
  agora,
  acoes,
}: {
  chaves: ChaveContaView[];
  ferramentas: FerramentaView[];
  /** Endereço público da Central (sem barra no fim). */
  base: string;
  podeEditar: boolean;
  agora: number;
  acoes: {
    criar: (form: FormData) => Promise<ResultadoNovaChave>;
    revogar: (id: string) => Promise<{ ok: boolean; mensagem?: string }>;
  };
}) {
  const id = useId();
  const [nova, setNova] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [revogando, setRevogando] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  const urlMcp = `${base}/api/conta/mcp`;
  const chaveNosExemplos = nova ?? "SUA_CHAVE";
  const comandoClaude = `claude mcp add --transport http central ${urlMcp} --header "Authorization: Bearer ${chaveNosExemplos}"`;
  const json = JSON.stringify(
    {
      mcpServers: {
        central: {
          type: "http",
          url: urlMcp,
          headers: { Authorization: `Bearer ${chaveNosExemplos}` },
        },
      },
    },
    null,
    2,
  );
  const curl = `curl ${base}/api/conta/v1 \\\n  -H "Authorization: Bearer ${chaveNosExemplos}"`;
  const instrucoes = [
    "Você trabalha para a minha empresa junto com a Central (uma equipe de agentes de IA).",
    `API: ${base}/api/conta/v1 com o cabeçalho "Authorization: Bearer ${chaveNosExemplos}". Comece com GET / para ver o que você pode fazer.`,
    "",
    "Toda semana, faça isto:",
    "1. Abra os meus perfis (Instagram, TikTok, YouTube, LinkedIn, X) pelo navegador e leia o perfil (nome, @, seguidores, seguindo, publicações, bio, link, foto) e os últimos 20 posts (id, texto, link, data, formato, imagem, duração e as métricas que aparecem: visualizações, curtidas, comentários, compartilhamentos, salvamentos).",
    '2. Mande cada rede com POST /redes: { "rede": "INSTAGRAM" | "TIKTOK" | "YOUTUBE" | "LINKEDIN" | "X", "perfil": {...}, "posts": [...] }.',
    '3. No começo de cada mês, mande os números do mês anterior com POST /numeros: { "mes": "AAAA-MM", "receita": reais, "atendimentos", "cancelados", "faltas", "clientesAtivos", "clientesNovos", "clientesSumidos" }.',
    "4. Se eu pedir para você publicar: GET /publicar traz as peças aprovadas com data; publique no horário e marque com POST /publicar/{id} { \"link\": \"link do post\" }.",
    "Nunca invente número: mande só o que leu. Não mexa em nada que eu não pedi.",
  ].join("\n");

  return (
    <div className="cx-api">
      <div className="cx-api-coluna">
        <section
          className="cx-painel cx-api-chaves"
          aria-labelledby={`${id}-chaves`}
        >
          <div className="cx-con-secao-cabeca">
            <h2 id={`${id}-chaves`} className="cx-con-secao-titulo">
              Suas chaves
            </h2>
            <p className="cx-con-secao-apoio">
              Cada chave só alcança esta conta. Ela aparece uma vez, na criação;
              aqui fica só o começo.
            </p>
          </div>

          {nova ? (
            <div className="cx-api-nova" role="status">
              <p className="cx-api-nova-titulo">
                <TriangleAlert size={18} strokeWidth={2} aria-hidden="true" />
                Copie agora: esta chave não aparece de novo.
              </p>
              <code className="cx-api-codigo cx-api-codigo--chave">{nova}</code>
              <div className="cx-api-nova-acoes">
                <Copiar texto={nova} rotulo="Copiar a chave" />
                <button
                  type="button"
                  className="cx-botao cx-botao--branco"
                  onClick={() => setNova(null)}
                >
                  Já guardei
                </button>
              </div>
            </div>
          ) : null}

          {chaves.length > 0 ? (
            <ul className="cx-api-lista">
              {chaves.map((c) => (
                <li key={c.id} className="cx-api-linha">
                  <span className="cx-api-icone" aria-hidden="true">
                    <KeyRound size={18} strokeWidth={1.8} />
                  </span>
                  <div className="cx-api-linha-texto">
                    <p className="cx-api-nome">{c.nome}</p>
                    <p className="cx-api-meta">
                      <code>{c.prefixo}…</code> · criada em {data(c.criadoEm)} ·{" "}
                      {quando(c.ultimoUsoEm, agora)}
                    </p>
                  </div>
                  <ul className="cx-api-escopos" aria-label="Escopos">
                    {c.escopos.map((e) => (
                      <li key={e}>{ROTULO_ESCOPO[e] ?? e}</li>
                    ))}
                  </ul>
                  {podeEditar ? (
                    revogando === c.id ? (
                      <div className="cx-api-confirma">
                        <button
                          type="button"
                          className="cx-botao cx-api-revogar-sim"
                          disabled={pendente}
                          onClick={() =>
                            iniciar(async () => {
                              const r = await acoes.revogar(c.id);
                              setRevogando(null);
                              setErro(
                                r.ok
                                  ? null
                                  : (r.mensagem ?? "Não deu para revogar."),
                              );
                            })
                          }
                        >
                          {pendente ? "Revogando…" : "Revogar agora"}
                        </button>
                        <button
                          type="button"
                          className="cx-botao cx-botao--suave"
                          onClick={() => setRevogando(null)}
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="cx-botao cx-botao--suave"
                        onClick={() => setRevogando(c.id)}
                      >
                        Revogar
                      </button>
                    )
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="cx-dica cx-api-vazio">Nenhuma chave ativa.</p>
          )}

          {podeEditar ? (
            <form
              className="cx-api-form"
              autoComplete="off"
              action={(form) =>
                iniciar(async () => {
                  const r = await acoes.criar(form);
                  if (r.ok) {
                    setNova(r.chave);
                    setErro(null);
                  } else setErro(r.mensagem);
                })
              }
            >
              <div className="cx-campo">
                <label className="cx-campo-rotulo" htmlFor={`${id}-nome`}>
                  Nome da chave
                </label>
                <input
                  id={`${id}-nome`}
                  name="nome"
                  className="cx-input"
                  required
                  minLength={2}
                  maxLength={60}
                  placeholder="Ex.: Claude Code no notebook"
                />
              </div>
              <fieldset className="cx-api-escolha">
                <legend className="cx-campo-rotulo">
                  O que ela pode fazer
                </legend>
                {ESCOPOS_CONTA.map((e) => (
                  <label key={e.id} className="cx-api-opcao">
                    <input
                      type="checkbox"
                      name="escopos"
                      value={e.id}
                      defaultChecked={e.id === "leitura"}
                    />
                    <span>
                      <strong>{e.rotulo}</strong>
                      {e.descricao}
                    </span>
                  </label>
                ))}
              </fieldset>
              <div className="cx-api-form-rodape">
                <button
                  type="submit"
                  className="cx-botao cx-botao--azul"
                  disabled={pendente}
                >
                  {pendente ? "Criando…" : "Criar chave"}
                </button>
                {erro ? (
                  <p role="alert" className="cx-aviso cx-aviso--erro">
                    {erro}
                  </p>
                ) : null}
              </div>
            </form>
          ) : (
            <p className="cx-dica">Só o dono da conta cria e revoga chaves.</p>
          )}
        </section>

        <section
          className="cx-painel cx-api-tools"
          aria-labelledby={`${id}-ferramentas`}
        >
          <div className="cx-con-secao-cabeca">
            <h2 id={`${id}-ferramentas`} className="cx-con-secao-titulo">
              <Plug size={20} strokeWidth={2} aria-hidden="true" /> Ferramentas
            </h2>
            <p className="cx-con-secao-apoio">
              As mesmas no MCP e na API REST. A chave só vê as do escopo dela.
            </p>
          </div>
          <ul className="cx-api-ferramentas">
            {ferramentas.map((f) => (
              <li key={f.nome}>
                <code>{f.nome}</code>
                <span className="cx-api-ferramenta-escopo">
                  {f.escopo === "livre"
                    ? "qualquer chave"
                    : ROTULO_ESCOPO[f.escopo]}
                </span>
                <span className="cx-api-ferramenta-texto">{f.descricao}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="cx-painel cx-api-mcp" aria-labelledby={`${id}-mcp`}>
        <div className="cx-con-secao-cabeca">
          <h2 id={`${id}-mcp`} className="cx-con-secao-titulo">
            Conectar o MCP
          </h2>
          <p className="cx-con-secao-apoio">
            O seu agente usa a Central pelas mesmas ferramentas da tela.{" "}
            {nova
              ? "A chave nova já está nos exemplos."
              : "Troque SUA_CHAVE pela chave criada ao lado."}
          </p>
        </div>

        <div className="cx-api-bloco">
          <p className="cx-campo-rotulo">Endereço do servidor (HTTP)</p>
          <div className="cx-api-codigo-linha">
            <code className="cx-api-codigo">{urlMcp}</code>
            <Copiar texto={urlMcp} rotulo="Copiar" />
          </div>
        </div>

        <div className="cx-api-bloco">
          <p className="cx-campo-rotulo">Sem API das redes: o seu agente traz os dados</p>
          <p className="cx-con-secao-apoio">
            OpenClaw, Hermes, Claude Code, Codex, um bot do Grok ou do n8n: qualquer agente que navega consegue ler os seus perfis e mandar para a Central. Crie uma chave com os escopos Redes, Números e Publicar e cole isto no agente.
          </p>
          <pre className="cx-api-codigo cx-api-pre">{instrucoes}</pre>
          <Copiar texto={instrucoes} rotulo="Copiar instruções" />
        </div>

        <div className="cx-api-bloco">
          <p className="cx-campo-rotulo">Claude Code</p>
          <pre className="cx-api-codigo cx-api-pre">{comandoClaude}</pre>
          <Copiar texto={comandoClaude} rotulo="Copiar comando" />
        </div>

        <div className="cx-api-bloco">
          <p className="cx-campo-rotulo">Cursor, .mcp.json e outros clientes</p>
          <pre className="cx-api-codigo cx-api-pre">{json}</pre>
          <Copiar texto={json} rotulo="Copiar JSON" />
        </div>

        <div className="cx-api-bloco">
          <p className="cx-campo-rotulo">API REST</p>
          <pre className="cx-api-codigo cx-api-pre">{curl}</pre>
        </div>
      </section>
    </div>
  );
}
