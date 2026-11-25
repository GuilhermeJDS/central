import { CabecaPagina } from "@/components/central/cabeca";
import { ChipChefe } from "@/components/central/chefe";
import { BotoesArea, FilaDaRede } from "@/components/central/area-rede";
import { BibliotecaPecas } from "@/components/central/estudio/biblioteca";
import { NovaPeca } from "@/components/central/estudio/nova-peca";
import { PedirChefe } from "@/components/central/pedir-chefe";
import { listarPecas, pautasBase } from "@/lib/central/estudio/pecas";
import { TIPOS_PAUTA } from "@/lib/central/estudio/tipos";
import { AREAS_REDES, areaPorSlug } from "@/lib/central/redes-areas";
import { decodificarTicket } from "@/lib/central/disparar";
import { trabalhosDaRede } from "@/lib/central/redes-dados";
import { redesConectadas } from "@/lib/redes/contas";

import { contexto } from "../../_lib/painel";
import { podeGerarNaCentral } from "../../_lib/sessao";
import { filtroDaBusca, secaoCom, type BuscaEstudio } from "../_comum";

/** Estúdio › Pautas: o que gerar em cada rede e o que espera o seu sim. */
export default async function PaginaPautas({ searchParams }: { searchParams: BuscaEstudio }) {
  const c = await contexto();
  if (!c) return null;
  const { sp, filtro } = await filtroDaBusca(searchParams);
  const conta = c.accountId;
  const areas = filtro ? [areaPorSlug(filtro.slug)!] : [...AREAS_REDES];

  const [listas, conectadas, podeGerar, pecas, pautas] = await Promise.all([
    conta ? Promise.all(areas.map((a) => trabalhosDaRede(conta, a))) : Promise.resolve([]),
    conta ? redesConectadas(conta) : Promise.resolve(new Set<string>()),
    conta ? podeGerarNaCentral(conta) : Promise.resolve(false),
    conta ? listarPecas(conta, { tipos: TIPOS_PAUTA, rede: filtro?.rede }) : Promise.resolve([]),
    conta ? pautasBase(conta) : Promise.resolve([]),
  ]);
  const trabalhos = listas.flat().sort((a, b) => b.em.localeCompare(a.em));
  const pendentes = trabalhos.filter((t) => t.estado === "pendente").length;
  const ticket = typeof sp.t === "string" ? sp.t : undefined;

  return (
    <>
      <CabecaPagina
        secao={secaoCom("Pautas", filtro)}
        titulo="Pautas"
        subtitulo={filtro ? `O que a Editora Pauta cria para o seu ${filtro.nome}, com um clique.` : "Escolha uma rede no filtro para ver os botões dela."}
        chip={<ChipChefe nome="Editora Pauta" />}
      >
        <NovaPeca secao="pautas" redeInicial={filtro?.rede} pautas={pautas} ativo={!!conta && podeGerar} />
      </CabecaPagina>
      <div className="cx-area">
        {filtro ? (
          <BotoesArea area={areas[0]} conectadas={[...conectadas]} ativo={!!conta && podeGerar} />
        ) : (
          <PedirChefe
            key={ticket ?? "sem-ticket"}
            slug="redes"
            chefe="Editora Pauta"
            leitura={false}
            ticketInicial={decodificarTicket(ticket)}
            exemplo={!conta}
          />
        )}
        <section className="cx-area-fila" aria-labelledby="cx-area-fila-t">
          <div className="cx-prontas-topo">
            <h2 id="cx-area-fila-t" className="cx-prontas-titulo">
              Esperando o seu sim
            </h2>
            {pendentes ? <span className="cx-prontas-conta">{pendentes}</span> : null}
          </div>
          <FilaDaRede itens={trabalhos} ativo={!!conta} />
        </section>

        <section className="cx-area-fila" aria-labelledby="cx-pautas-prontas">
          <div className="cx-prontas-topo">
            <h2 id="cx-pautas-prontas" className="cx-prontas-titulo">
              {filtro?.slug === "x" ? "Posts e threads" : filtro ? "Posts e textos" : "Posts, threads e textos"}
            </h2>
          </div>
          <BibliotecaPecas
            pecas={pecas}
            base="/central/redes/pautas"
            rede={filtro?.slug ?? null}
            nomeNegocio={c.nomeNegocio}
            vazio={<p className="cx-vazio-texto">Aprove uma pauta de post ou thread e a peça pronta aparece aqui.</p>}
          />
        </section>
      </div>
    </>
  );
}
