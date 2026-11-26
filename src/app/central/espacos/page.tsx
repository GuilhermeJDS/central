import Link from "next/link";
import { CopiarTexto } from "@/components/central/copiar";
import { enderecoPublico } from "@/lib/config";
import { BotaoAguardar } from "./botao-aguardar";
import { dadosEspacos, salvarContexto, pesquisarClinica, rascunharContato, atualizarLead, perguntarEspaco, prepararPrevia, criarLinkPrevia, revogarLinkPrevia, registrarOportunidade } from "./acoes";

const areas = [
  { id:"engenharia", titulo:"Lumina Engenharia", texto:"Projetos e serviços de engenharia." },
  { id:"ofertas", titulo:"Lumina Ofertas", texto:"Produtos, afiliados e conteúdo de ofertas." },
  { id:"sites", titulo:"Sites para clínicas", texto:"Pesquisa, prévias e prospecção de profissionais de saúde." },
] as const;
const etapas = [
  ["pesquisado","Pesquisado"],["qualificando","Em análise"],["previa","Prévia em preparo"],
  ["pronto","Pronto para contato"],["contatado","Contatado"],["negociacao","Em negociação"],["fechado","Fechado"],["descartado","Descartado"]
];
function linkSeguro(valor: string | null | undefined) {
  if (!valor) return null;
  try { const u = new URL(valor); return ["http:", "https:"].includes(u.protocol) ? u.href : null; } catch { return null; }
}
function resposta(raw: string): {pedido:string;texto:string} | null {
  try { const r = JSON.parse(raw); return typeof r?.texto === "string" && typeof r?.pedido === "string" ? r : null; } catch { return null; }
}
const caixa = {background:"var(--cx-papel, white)", border:"1px solid #d8dfe8", borderRadius:16, padding:20};
const campo = {display:"block", width:"100%", margin:"8px 0", padding:10};
export default async function Espacos() {
  const [dados, base] = await Promise.all([dadosEspacos(), enderecoPublico()]);
  return <div style={{maxWidth:1050,margin:"0 auto",padding:"20px 0 60px"}}>
    <p>ÁREAS DE TRABALHO</p><h1>Seus projetos</h1>
    <p>Cada área guarda seu contexto e responde pedidos próprios. Os departamentos da Central continuam usando a ficha principal.</p>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:16,margin:"24px 0"}}>
      {areas.map((area, i) => {
        const ultima = resposta(dados.respostas[i]);
        return <section key={area.id} style={caixa}>
          <h2>{area.titulo}</h2><p>{area.texto}</p>
          <form action={salvarContexto}>
            <input type="hidden" name="espaco" value={area.id}/>
            <label>Contexto desta frente<textarea name="contexto" defaultValue={dados[area.id]} maxLength={10000} rows={6} style={campo} placeholder="Serviços, público, objetivos e preferências..."/></label>
            <BotaoAguardar normal="Salvar contexto" aguardando="Salvando…" />
          </form>
          <form action={perguntarEspaco} style={{marginTop:18}}>
            <input type="hidden" name="espaco" value={area.id}/>
            <label>Pedir trabalho<textarea name="pedido" maxLength={4000} minLength={4} required rows={3} style={campo} placeholder="O que você precisa?"/></label>
            <BotaoAguardar normal="Pedir à IA" aguardando="Preparando resposta…" />
          </form>
          {ultima ? <div style={{marginTop:16}}><strong>Último pedido</strong><p>{ultima.pedido}</p><strong>Resposta</strong><p style={{whiteSpace:"pre-wrap"}}>{ultima.texto}</p></div> : null}
        </section>;
      })}
    </div>
    <section style={caixa}>
      <h2>Prospecção de clínicas</h2>
      <p>Pesquise um estabelecimento pelo Rastro e acompanhe sua análise. A busca pode levar mais de um minuto.</p>
      <form action={pesquisarClinica} style={{display:"flex",gap:10,flexWrap:"wrap",margin:"16px 0"}}>
        <label>Nome ou busca <input name="nome" required minLength={2} maxLength={150} placeholder="Ex.: clínica de estética" style={{display:"block",padding:10}}/></label>
        <label>Cidade <input name="cidade" required minLength={2} maxLength={150} defaultValue="Vitória da Conquista" style={{display:"block",padding:10}}/></label>
        <BotaoAguardar normal="Pesquisar" aguardando="Pesquisando no Maps…" />
      </form>
      <p>Um resultado por pesquisa. Site ausente não comprova que a clínica não tenha site. Confira o responsável e seu contato antes de usá-los.</p>
      <details style={{margin:"20px 0",padding:16,border:"1px solid #d8dfe8",borderRadius:12}}>
        <summary>Registrar oportunidade pesquisada</summary>
        <p>Inclua fontes para que as informações possam ser conferidas. Um contato da clínica não confirma a identidade do responsável.</p>
        <form action={registrarOportunidade}>
          <label>Profissional ou clínica <input name="nome" required minLength={2} maxLength={150} style={campo}/></label>
          <label>Cidade <input name="cidade" required defaultValue="Vitória da Conquista" maxLength={150} style={campo}/></label>
          <label>Categoria <input name="categoria" maxLength={100} style={campo}/></label>
          <label>Site encontrado <input type="url" name="site" maxLength={500} style={campo}/></label>
          <label>Google Maps <input type="url" name="maps" maxLength={1000} style={campo}/></label>
          <label>Responsável confirmado <input name="responsavel" maxLength={150} style={campo}/></label>
          <label>Contato profissional direto confirmado <input name="contato" maxLength={300} style={campo}/></label>
          <label>Fontes e observações <textarea name="evidencia" required minLength={10} maxLength={2000} rows={4} style={campo}/></label>
          <BotaoAguardar normal="Salvar oportunidade" aguardando="Salvando…" />
        </form>
      </details>
      {dados.leads.length === 0 ? <p>Nenhuma pesquisa salva ainda.</p> : <div>
        {dados.leads.map(lead => <article key={lead.id} style={{borderTop:"1px solid #d8dfe8",padding:"16px 0"}}>
          <h3>{lead.nome}</h3><p>{lead.categoria || "Categoria não informada"} · {lead.endereco || "Endereço não informado"}</p>
          <p>{linkSeguro(lead.site) ? <a href={linkSeguro(lead.site)!} target="_blank" rel="noopener noreferrer">Site encontrado</a> : "Site não encontrado na pesquisa"} {linkSeguro(lead.maps) ? <> · <a href={linkSeguro(lead.maps)!} target="_blank" rel="noopener noreferrer">Google Maps</a></> : null}</p>
          <form action={atualizarLead}>
            <input type="hidden" name="id" value={lead.id}/>
            <label>Etapa <select name="status" defaultValue={lead.status || "pesquisado"} style={campo}>{etapas.map(([valor,rotulo])=><option key={valor} value={valor}>{rotulo}</option>)}</select></label>
            <label>Responsável confirmado <input name="responsavel" maxLength={150} defaultValue={lead.responsavel || ""} style={campo}/></label>
            <label>Contato direto confirmado <input name="contato" maxLength={300} defaultValue={lead.contato || ""} style={campo}/></label>
            <label>Evidências e observações <textarea name="evidencia" maxLength={2000} defaultValue={lead.evidencia || ""} rows={3} style={campo}/></label>
            <label>Link da prévia <input name="previa" maxLength={500} defaultValue={lead.previa || ""} style={campo}/></label>
            <BotaoAguardar normal="Salvar acompanhamento" aguardando="Salvando…" />
          </form>
          {linkSeguro(lead.previa) ? <p><a href={linkSeguro(lead.previa)!} target="_blank" rel="noopener noreferrer">Abrir prévia</a></p> : null}
          <form action={prepararPrevia} style={{marginTop:16}}><input type="hidden" name="id" value={lead.id}/><BotaoAguardar normal="Criar rascunho de página" aguardando="Preparando rascunho…" /></form>
          {lead.rascunhoSite ? <section style={{margin:"16px 0",padding:20,border:"1px solid #d8dfe8",borderRadius:12}}>
            <p>PRÉVIA DE CONTEÚDO · AINDA NÃO PUBLICADA</p>
            <h3>{lead.rascunhoSite.titulo}</h3><p>{lead.rascunhoSite.apresentacao}</p>
            {lead.rascunhoSite.servicos.length ? <ul>{lead.rascunhoSite.servicos.map((s,i)=><li key={i}>{s}</li>)}</ul> : <p>Serviços aguardam confirmação.</p>}
            <p>{lead.rascunhoSite.chamada}</p><p>Confira os dados antes de usar esta prévia.</p>
            <Link href={`/central/espacos/previa/${lead.id}`} className="cx-botao cx-botao--azul">Visualizar página</Link>
            <form action={criarLinkPrevia} style={{marginTop:12}}><input type="hidden" name="id" value={lead.id}/><BotaoAguardar normal={lead.compartilhamento ? "Gerar novo link" : "Criar link para compartilhar"} aguardando="Criando link…" /></form>
            {lead.compartilhamento ? <div style={{marginTop:12}}>
              <p>Link público válido até {new Date(lead.compartilhamento.expiraEm).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo"})}. Quem tiver o link poderá abrir a demonstração.</p>
              <p><a href={`/proposta/${lead.compartilhamento.token}`} target="_blank" rel="noreferrer">Abrir demonstração compartilhável</a></p>
              <CopiarTexto texto={`${base}/proposta/${lead.compartilhamento.token}`} rotulo="Copiar link" />
              <form action={revogarLinkPrevia}><input type="hidden" name="id" value={lead.id}/><BotaoAguardar normal="Revogar link" aguardando="Revogando…" /></form>
            </div> : null}
          </section> : null}
          {lead.mensagem ? <div><strong>Rascunho para revisão</strong><p style={{whiteSpace:"pre-wrap"}}>{lead.mensagem}</p></div> : null}
          <form action={rascunharContato}><input type="hidden" name="id" value={lead.id}/><BotaoAguardar normal="Preparar mensagem" aguardando="Preparando mensagem…" /></form>
        </article>)}
      </div>}
    </section>
  </div>;
}