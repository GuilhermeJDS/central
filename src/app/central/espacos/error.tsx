"use client";
export default function ErroEspacos({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <section role="alert" style={{maxWidth:700,margin:"40px auto",padding:24}}>
    <h1>Não foi possível concluir</h1>
    <p>A pesquisa ou o pedido não terminou. Confira a conexão e tente novamente. Se estava pesquisando no Maps, o serviço pode demorar para despertar.</p>
    <button type="button" className="cx-botao cx-botao--azul" onClick={reset}>Voltar e tentar novamente</button>
  </section>;
}