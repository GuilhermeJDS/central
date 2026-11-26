import { ListaPedagio, type ItemPedagio } from "@/components/central/projeto-aberto/pedagio";
import { Policial } from "@/components/central/projeto-aberto/policial";

export const metadata = { title: "Pedágio" };

const ITENS: ItemPedagio[] = [
  { id: "x", titulo: "Seguir o @mongarde_ no X", texto: "É onde saem as próximas ferramentas e as skills novas.", acao: "Seguir", link: "https://x.com/mongarde_" },
  { id: "mvd", titulo: "Pôr o seu projeto no ranking", texto: "Cadastre o que você está construindo no mamaevireidev.com.br.", acao: "Cadastrar", link: "https://mamaevireidev.com.br" },
  {
    id: "clara",
    titulo: "Dar uma força ao Clara Finance",
    texto: "Projeto de um amigo. Uma estrela no GitHub já ajuda muito.",
    acao: "Ajudar",
    link: "https://github.com/cesaroeduardo/clara-finance?utm_source=mamaevireidev&utm_medium=ranking&utm_campaign=clara-finance&mvd_cid=zVTQdltE9CLQS7Yf",
  },
  { id: "grupo", titulo: "Entrar na comunidade do X", texto: "O grupo no WhatsApp de quem constrói em público.", acao: "Entrar", link: "https://chat.whatsapp.com/GBKvnYBUEaaBqsJtzibh4r?s=cl&p=i&iam=2" },
];

/** O guarda do pedágio em pontilhado, a placa PARE e o cartão com os 4 itens por cima. */
export default function Pedagio() {
  return (
    <section className="cx-painel cx-pedagio-palco">
      <div className="cx-pedagio-chao" aria-hidden="true" />
      <div className="cx-pedagio-guarda">
        <Policial className="cx-pedagio-policial" />
        <span className="cx-pedagio-pare">Pare</span>
      </div>
      <div className="cx-pedagio-cartao">
        <p className="cx-sobrelinha">Pedágio</p>
        <h1 className="cx-pedagio-titulo">Aqui ninguém passa sem pagar o pedágio.</h1>
        <p className="cx-pedagio-texto">A Central é aberta e grátis para sempre. O pedágio é outro: não custa nada e ajuda quem faz e quem está começando.</p>
        <ListaPedagio itens={ITENS} />
      </div>
    </section>
  );
}
