import { dadosEspacos, salvarContexto, pesquisarClinica, rascunharContato } from "./acoes";

const areas = [
  { id: "engenharia", titulo: "Lumina Engenharia", texto: "Projetos, serviços de engenharia e relacionamento com clientes." },
  { id: "ofertas", titulo: "Lumina Ofertas", texto: "Produtos, afiliados e conteúdo de ofertas." },
  { id: "sites", titulo: "Sites para clínicas", texto: "Pesquisa, prévias e prospecção de profissionais de saúde." },
] as const;

function linkSeguro(valor: string | null) {
  if (!valor) return null;
  try { const u = new URL(valor); return ["http:", "https:"].includes(u.protocol) ? u.href : null; } catch { return null; }
}
export default async function Espacos() {
  const dados = await dadosEspacos();
  return <div style={{maxWidth: 1050, margin: "0 auto", padding: "20px 0 60px"}}>
    <p>ÁREAS DE TRABALHO</p>
    <h1>Seus projetos</h1>
    <p>Contextos separados para engenharia, ofertas e sites. Os departamentos existentes ainda usam a ficha principal; os contextos abaixo são usados nesta página.</p>
    <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))", gap:16, margin:"24px 0"}}>
      {areas.map(area => <section key={area.id} style={{background:"var(--cx-papel, white)", border:"1px solid #d8dfe8", borderRadius:16,padding:20}}>
        <h2>{area.titulo}</h2><p>{area.texto}</p>
        <form action={salvarContexto}>
          <input type="hidden" name="espaco" value={area.id}/>
          <label>Contexto desta frente<textarea name="contexto" defaultValue={dados[area.id]} maxLength={10000} rows={7} style={{display:"block",width:"100%",margin:"8px 0",padding:10}} placeholder="Serviços, público, objetivos e preferências..."/></label>
          <button type="submit" className="cx-botao cx-botao--azul">Salvar contexto</button>
        </form>
      </section>)}
    </div>
    <section style={{background:"var(--cx-papel, white)",border:"1px solid #d8dfe8",borderRadius:16,padding:20}}>
      <h2>Pesquisa de clínicas</h2>
      <p>Pesquise pelo nome para registrar dados públicos encontrados pelo Rastro. Confira se o estabelecimento é o correto. A pesquisa pode levar mais de um minuto.</p>
      <form action={pesquisarClinica} style={{display:"flex",gap:10,flexWrap:"wrap",margin:"16px 0"}}>
        <label>Nome ou busca <input name="nome" required minLength={2} maxLength={150} placeholder="Ex.: clínica de estética" style={{display:"block",padding:10}}/></label>
        <label>Cidade <input name="cidade" required minLength={2} maxLength={150} defaultValue="Vitória da Conquista" style={{display:"block",padding:10}}/></label>
        <button className="cx-botao cx-botao--azul" type="submit">Pesquisar</button>
      </form>
      <p>A pesquisa retorna um resultado por vez. Site ausente não comprova que a clínica não tenha site; a identidade do proprietário e o canal precisam ser verificados.</p>
      {dados.leads.length === 0 ? <p>Nenhuma pesquisa salva ainda.</p> : <div>
        {dados.leads.map((lead, i) => <article key={lead.maps ?? lead.nome + lead.criado} style={{borderTop:"1px solid #d8dfe8",padding:"16px 0"}}>
          <h3>{lead.nome}</h3><p>{lead.categoria || "Categoria não informada"} · {lead.endereco || "Endereço não informado"}</p>
          <p>{linkSeguro(lead.site) ? <a href={linkSeguro(lead.site)!} target="_blank" rel="noopener noreferrer">Site encontrado</a> : "Site não encontrado na pesquisa"} {linkSeguro(lead.maps) ? <> · <a href={linkSeguro(lead.maps)!} target="_blank" rel="noopener noreferrer">Google Maps</a></> : null}</p>
          <p>Responsável e contato pessoal: não verificados.</p>
          {lead.mensagem ? <div><strong>Rascunho para revisão</strong><p style={{whiteSpace:"pre-wrap"}}>{lead.mensagem}</p></div> : null}
          <form action={rascunharContato}><input type="hidden" name="indice" value={i}/><button className="cx-botao cx-botao--azul" type="submit">Preparar mensagem</button></form>
        </article>)}
      </div>}
    </section>
  </div>;
}