import Link from "next/link";
import { notFound } from "next/navigation";
import { dadosEspacos } from "../../acoes";
import styles from "./previa.module.css";

export const dynamic = "force-dynamic";
export default async function PreviaClinica({ params }: { params: Promise<{id:string}> }) {
  const { id } = await params;
  if (!/^(?:[a-f0-9]{32}|[a-f0-9-]{36})$/.test(id)) notFound();
  const { leads } = await dadosEspacos();
  const lead = leads.find(l => l.id === id);
  if (!lead?.rascunhoSite) notFound();
  const site = lead.rascunhoSite;
  return <div className={styles.pagina}>
    <div className={styles.aviso}>
      <span>Prévia privada · confira todas as informações antes de apresentar</span>
      <Link href="/central/espacos">Voltar à prospecção</Link>
    </div>
    <header className={styles.topo}>
      <div className={styles.marca}>{lead.nome}</div>
      <span className={styles.rotulo}>Apresentação da clínica</span>
    </header>
    <section className={styles.hero}>
      <div><span className={styles.rotulo}>Vitória da Conquista</span><h1>{site.titulo}</h1><p>{site.apresentacao}</p></div>
      <div className={styles.cartao} aria-hidden="true">Cuidado e presença</div>
    </section>
    <section className={styles.conteudo}>
      <h2>Conheça a clínica</h2>
      {site.servicos.length > 0 ? <ul>{site.servicos.map((s,i)=><li key={i}>{s}</li>)}</ul> : <p className={styles.pendente}>Serviços e especialidades ainda precisam ser confirmados antes de serem incluídos.</p>}
      <p>{site.chamada}</p>
      {lead.endereco ? <p><strong>Endereço informado:</strong> {lead.endereco}</p> : null}
    </section>
    <footer className={styles.rodape}>Material de demonstração · Informações sujeitas à confirmação</footer>
  </div>;
}