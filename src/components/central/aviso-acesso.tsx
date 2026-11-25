/** "Sem acesso" da Central (nunca redireciona ao painel). */
export function AvisoAcesso() {
  return (
    <main className="cx-sem-acesso">
      <p className="cx-sobrelinha">Central</p>
      <h1 className="cx-titulo">Sem acesso.</h1>
      <p className="cx-subtitulo">A Central ainda está em teste e não está aberta para este usuário.</p>
    </main>
  );
}
