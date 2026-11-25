import { ExternalLink, Star } from "lucide-react";

import { CabecaPagina } from "@/components/central/cabeca";
import { AtualizarCentral, BotaoSkill, MarcarVisto, VerificarAgora } from "@/components/central/projeto-aberto/botoes-atualizacao";
import { AUTOR, REPO_OFICIAL, catalogo, comoAtualizar, compararVersao, projetos, skillsInstaladas, versaoLocal } from "@/lib/atualizacoes";
import { configAtualizacoes } from "@/lib/config";

export const metadata = { title: "Atualizações" };
export const dynamic = "force-dynamic";

const fmt = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Sao_Paulo" });

export default async function Atualizacoes() {
  const [c, p, visto, instaladas] = await Promise.all([catalogo(), projetos(), configAtualizacoes(), skillsInstaladas()]);
  const local = versaoLocal();
  const remota = c.dado?.versao ?? null;
  const temNova = remota ? compararVersao(remota, local) > 0 : false;
  const modo = comoAtualizar();
  const novidades = (c.dado?.novidades ?? []).filter((n) => compararVersao(n.versao, local) > 0);

  return (
    <>
      <MarcarVisto />
      <CabecaPagina secao="Projeto aberto" titulo="Atualizações" subtitulo="Versão nova da Central, projetos novos e skills novas, direto do GitHub.">
        <VerificarAgora />
      </CabecaPagina>

      <section className="cx-painel cx-at-secao">
        <h2>Central</h2>
        <div className="cx-at-versao">
          <span>
            <span className="cx-dica">Você está na</span> <strong>{local}</strong>
          </span>
          {remota ? (
            temNova ? (
              <span>
                <span className="cx-selo-novo">nova</span> <span className="cx-dica">Saiu a</span> <strong>{remota}</strong>
              </span>
            ) : (
              <span className="cx-dica">Esta é a versão mais nova.</span>
            )
          ) : (
            <span className="cx-dica">Ainda não consegui conferir no GitHub ({c.erro ?? "sem conexão"}).</span>
          )}
        </div>
        {temNova && novidades.length ? (
          <ul className="cx-lista-at">
            {novidades.map((n) => (
              <li key={n.versao}>
                <div>
                  <strong>
                    {n.versao} · {n.data}
                  </strong>
                  {n.itens.map((i) => (
                    <span key={i} className="cx-dica">
                      {i}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        ) : null}
        {temNova ? (
          modo.podeAuto ? (
            <AtualizarCentral />
          ) : (
            <ol className="cx-at-passos">
              {modo.modo === "vercel" ? (
                <>
                  <li>Abra o seu fork no GitHub e clique em <strong>Sync fork</strong>.</li>
                  <li>A Vercel publica a versão nova sozinha em um ou dois minutos.</li>
                </>
              ) : modo.modo === "docker" ? (
                <li>
                  No servidor: <code>git pull && docker compose up -d --build</code>
                </li>
              ) : (
                <>
                  <li>
                    Baixe a versão nova em <a href={`https://github.com/${REPO_OFICIAL}`} target="_blank" rel="noreferrer">github.com/{REPO_OFICIAL}</a> e troque os arquivos, mantendo a pasta <code>dados/</code> e o <code>.env</code>.
                  </li>
                  <li>
                    Rode <code>npm install</code> e <code>npm run dev</code>.
                  </li>
                  <li>Da próxima vez, use <code>git clone</code>: aí o botão Atualizar faz tudo sozinho.</li>
                </>
              )}
            </ol>
          )
        ) : null}
      </section>

      <section className="cx-painel cx-at-secao">
        <h2>Skills novas</h2>
        <p className="cx-dica">Instalou, o chefe já usa. A skill fica guardada no seu banco.</p>
        {c.dado?.skills.length ? (
          <ul className="cx-lista-at">
            {c.dado.skills.map((s) => (
              <li key={s.slug}>
                <div>
                  <strong>
                    {s.nome}
                    {!instaladas.has(s.slug) && !visto.skillsVistas.includes(s.slug) ? <span className="cx-selo-novo">nova</span> : null}
                  </strong>
                  <span className="cx-dica">
                    {s.chefe} · {s.descricao}
                  </span>
                </div>
                <BotaoSkill slug={s.slug} instalada={instaladas.has(s.slug)} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="cx-dica">Nenhuma skill nova no catálogo por enquanto.</p>
        )}
      </section>

      <section className="cx-painel cx-at-secao">
        <h2>Projetos do {AUTOR}</h2>
        <p className="cx-dica">Tudo aberto e grátis, como a Central.</p>
        {p.dado?.length ? (
          <ul className="cx-lista-at">
            {p.dado.map((r) => (
              <li key={r.nome}>
                <div>
                  <strong>
                    {r.nome}
                    {!visto.reposVistos.includes(r.nome) ? <span className="cx-selo-novo">novo</span> : null}
                  </strong>
                  <span className="cx-dica">{r.descricao ?? "Sem descrição."}</span>
                  <span className="cx-dica">
                    <Star size={13} aria-hidden="true" /> {r.estrelas} · criado em {fmt.format(new Date(r.criadoEm))}
                  </span>
                </div>
                <a href={r.url} target="_blank" rel="noreferrer" className="cx-botao cx-botao--branco">
                  Abrir <ExternalLink size={15} aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="cx-dica">Não consegui ler os projetos agora ({p.erro ?? "sem conexão"}).</p>
        )}
      </section>
    </>
  );
}
