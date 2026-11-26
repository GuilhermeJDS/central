import { createHash } from "node:crypto";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import styles from "@/app/central/espacos/previa/[id]/previa.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title:"Proposta de site", robots:{index:false,follow:false,nocache:true}, referrer:"no-referrer" };
const schema = z.object({
  nome:z.string().min(1).max(200), categoria:z.string().nullable(), endereco:z.string().nullable(),
  expiraEm:z.string(), rascunhoSite:z.object({titulo:z.string(), apresentacao:z.string(), servicos:z.array(z.string()), chamada:z.string()})
});
export default async function PropostaPublica({params}:{params:Promise<{token:string}>}) {
  const {token} = await params;
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) notFound();
  const hash = createHash("sha256").update(token).digest("hex");
  const registro = await prisma.config.findUnique({where:{chave:"previa.publica."+hash}});
  if (!registro) notFound();
  let raw:unknown;
  try {raw=JSON.parse(registro.valor);} catch {notFound();}
  const result = schema.safeParse(raw);
  if (!result.success || !Number.isFinite(Date.parse(result.data.expiraEm)) || Date.parse(result.data.expiraEm) <= Date.now()) notFound();
  const {nome,categoria,endereco,rascunhoSite:site} = result.data;
  return <main className={styles.pagina}>
    <div className={styles.aviso}><span>DEMONSTRAÇÃO NÃO OFICIAL · Proposta de site apresentada para avaliação</span></div>
    <header className={styles.topo}><div className={styles.marca}>{nome}</div><span className={styles.rotulo}>Proposta visual</span></header>
    <section className={styles.hero}>
      <div><span className={styles.rotulo}>{categoria || "Clínica"}</span><h1>{site.titulo}</h1><p>{site.apresentacao}</p></div>
      <div className={styles.cartao} aria-hidden="true">Cuidado e presença</div>
    </section>
    <section className={styles.conteudo}><h2>Conheça a clínica</h2>
      {site.servicos.length ? <ul>{site.servicos.map((s,i)=><li key={i}>{s}</li>)}</ul> : <p className={styles.pendente}>Conteúdo e serviços a confirmar.</p>}
      <p>{site.chamada}</p>{endereco ? <p><strong>Endereço informado:</strong> {endereco}</p> : null}
    </section>
    <footer className={styles.rodape}>Demonstração não oficial · Informações sujeitas à confirmação</footer>
  </main>;
}