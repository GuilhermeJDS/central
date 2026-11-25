import Link from "next/link";

import { CabecaPagina } from "@/components/central/cabeca";
import { MarcaChefe } from "@/components/central/chefe";
import { listarSkills } from "@/lib/skills/lista";

export const metadata = { title: "Skills" };
export const dynamic = "force-dynamic";

/** Os manuais que cada chefe lê antes de trabalhar. */
export default async function Skills() {
  const skills = await listarSkills();
  const porChefe = new Map<string, typeof skills>();
  for (const s of skills) porChefe.set(s.chefe, [...(porChefe.get(s.chefe) ?? []), s]);
  return (
    <>
      <CabecaPagina
        secao="Ajustes"
        titulo="Skills"
        subtitulo={
          <>
            {skills.length} manuais que os chefes leem antes de trabalhar. Os arquivos ficam na pasta <code>skills/</code>: dá para editar à vontade. Skills novas chegam em{" "}
            <Link href="/central/atualizacoes">Atualizações</Link>.
          </>
        }
      />
      {[...porChefe].map(([chefe, lista]) => (
        <section key={chefe} className="cx-painel cx-at-secao">
          <h2 className="cx-skills-chefe">
            {chefe.includes(" e ") ? null : <MarcaChefe nome={chefe} tamanho={40} />}
            {chefe} <span className="cx-dica">{lista.length}</span>
          </h2>
          <ul className="cx-lista-at">
            {lista.map((s) => (
              <li key={s.slug}>
                <div>
                  <strong>
                    {s.nome}
                    {s.origem === "instalada" ? <span className="cx-selo-novo">instalada</span> : null}
                  </strong>
                  <span className="cx-dica">{s.descricao}</span>
                  <span className="cx-dica">
                    <code>
                      skills/{s.area}/{s.slug}
                    </code>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
