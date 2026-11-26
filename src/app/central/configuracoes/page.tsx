import { Building2, Database, KeyRound, Mail, MapPin, Send, UserRound } from "lucide-react";

import { CabecaPagina } from "@/components/central/cabeca";
import { CampoCfg, Expansivel, FormConfig, Remover } from "@/components/central/configuracoes";
import { FormIntegracao } from "@/components/central/form-integracao";
import { Avatar } from "@/components/central/menu-conta";
import { grupo, type GrupoId } from "@/lib/catalogo-integracoes";
import { configGeral, enderecoPublico, resumoIntegracoes } from "@/lib/config";
import { db, ehSqlite } from "@/lib/db";
import { exigirUsuario } from "@/lib/sessao";

import { novaPessoaAcao, removerPessoaAcao, salvarSistemaAcao, salvarVoceAcao, trocarSenhaAcao } from "../acoes-configuracoes";

export const metadata = { title: "Configurações" };
export const dynamic = "force-dynamic";

const ICONE: Record<GrupoId, React.ReactNode> = { rastro: <MapPin size={18} />, buffer: <Send size={18} />, email: <Mail size={18} /> };

/** Conta e sistema, no modelo do Garimpo: você, a empresa, as conexões do sistema e quem entra. */
export default async function Configuracoes() {
  const eu = await exigirUsuario();
  const [conta, geral, base, resumo, pessoas, foto] = await Promise.all([
    db.account.findUnique({ where: { id: eu.accountId }, select: { nome: true } }),
    configGeral(),
    enderecoPublico(),
    resumoIntegracoes(),
    db.user.findMany({ where: { accountId: eu.accountId }, orderBy: { createdAt: "asc" }, select: { id: true, nome: true, email: true, fotoPerfil: true } }),
    db.user.findUnique({ where: { id: eu.id }, select: { fotoPerfil: true } }),
  ]);
  const grupos: GrupoId[] = ["rastro", "buffer", "email"];

  return (
    <>
      <CabecaPagina secao="Ajustes" titulo="Configurações" subtitulo="Você, a empresa, as conexões do sistema e quem entra no painel." />

      <section className="cx-painel cx-cfg-quem">
        <Avatar u={{ nome: eu.nome, email: eu.email, foto: foto?.fotoPerfil ?? null }} tamanho={56} />
        <div>
          <p className="cx-integracao-nome">{eu.nome}</p>
          <p className="cx-dica">{eu.email}</p>
        </div>
      </section>

      <section className="cx-cfg-secao">
        <h2 className="cx-cfg-titulo">Você</h2>
        <Expansivel icone={<UserRound size={18} />} titulo="Nome e e-mail" resumo={`${eu.nome} · ${eu.email}`}>
          <FormConfig acao={salvarVoceAcao} botao="Salvar">
            <div className="cx-cfg-grade">
              <CampoCfg rotulo="Nome" name="nome" defaultValue={eu.nome} autoComplete="name" />
              <CampoCfg rotulo="E-mail de acesso" name="email" type="email" defaultValue={eu.email} autoComplete="email" />
            </div>
          </FormConfig>
        </Expansivel>
        <Expansivel icone={<KeyRound size={18} />} titulo="Senha" resumo="Trocar a senha derruba as outras sessões abertas." acao="Trocar">
          <FormConfig acao={trocarSenhaAcao} botao="Trocar senha" limpar>
            <div className="cx-cfg-grade">
              <CampoCfg rotulo="Senha atual" name="atual" type="password" autoComplete="current-password" />
              <CampoCfg rotulo="Senha nova" name="nova" type="password" autoComplete="new-password" minLength={8} dica="8 caracteres ou mais." />
            </div>
          </FormConfig>
        </Expansivel>
      </section>

      <section className="cx-cfg-secao">
        <h2 className="cx-cfg-titulo">Empresa e sistema</h2>
        <Expansivel icone={<Building2 size={18} />} titulo="Nome e endereço" resumo={`${conta?.nome ?? "Sem nome"} · ${geral.appUrl || `${base} (descoberto sozinho)`}`}>
          <FormConfig acao={salvarSistemaAcao} botao="Salvar">
            <div className="cx-cfg-grade">
              <CampoCfg rotulo="Nome da empresa" name="empresa" defaultValue={conta?.nome ?? ""} dica="Os chefes chamam o negócio por esse nome." />
              <CampoCfg rotulo="Endereço público" name="appUrl" defaultValue={geral.appUrl} placeholder="https://central.seudominio.com" dica="Onde a Central está no ar. Vai nos links do Buffer, das redes e dos e-mails." />
            </div>
          </FormConfig>
        </Expansivel>
        <div className="cx-exp cx-exp--fixo">
          <div className="cx-exp-linha">
            <span className="cx-exp-icone" aria-hidden="true">
              <Database size={18} />
            </span>
            <span className="cx-exp-texto">
              <strong>Banco de dados</strong>
              <span>{ehSqlite() ? "SQLite local, na pasta dados/." : "Postgres."} Para trocar, mude a DATABASE_URL no .env e rode npm run db.</span>
            </span>
          </div>
        </div>
      </section>

      <section className="cx-cfg-secao">
        <h2 className="cx-cfg-titulo">Conexões do sistema</h2>
        <p className="cx-dica">A chave de IA, as redes e a API do seu agente ficam em Conexões.</p>
        {grupos.map((g) => {
          const def = grupo(g);
          const p = def.provedores[0];
          const ligado = !!resumo[g]?.ativo;
          return (
            <Expansivel key={g} icone={ICONE[g]} titulo={def.nome} resumo={ligado ? `Ligado · ${p.resumo}` : p.resumo} acao={ligado ? "Editar" : "Ligar"}>
              <FormIntegracao grupo={g} provedor={p} resumo={resumo[g]?.provedores[p.id]} />
            </Expansivel>
          );
        })}
      </section>

      <section className="cx-cfg-secao">
        <div className="cx-cfg-titulo-linha">
          <h2 className="cx-cfg-titulo">Quem entra no painel</h2>
        </div>
        <ul className="cx-painel cx-cfg-pessoas">
          {pessoas.map((p) => (
            <li key={p.id}>
              <Avatar u={{ nome: p.nome, email: p.email, foto: p.fotoPerfil }} tamanho={36} />
              <span className="cx-exp-texto">
                <strong>{p.nome}</strong>
                <span>{p.email}</span>
              </span>
              {p.id === eu.id ? <span className="cx-ob-selo" data-ok="true">você</span> : <Remover acao={removerPessoaAcao.bind(null, p.id)} nome={p.nome.split(" ")[0]} />}
            </li>
          ))}
        </ul>
        <Expansivel icone={<UserRound size={18} />} titulo="Adicionar pessoa" resumo="Ela entra com este e-mail e senha e vê tudo." acao="Adicionar">
          <FormConfig acao={novaPessoaAcao} botao="Adicionar" limpar>
            <div className="cx-cfg-grade cx-cfg-grade--3">
              <CampoCfg rotulo="Nome" name="nome" />
              <CampoCfg rotulo="E-mail" name="email" type="email" />
              <CampoCfg rotulo="Senha inicial" name="senha" type="password" autoComplete="new-password" />
            </div>
          </FormConfig>
        </Expansivel>
      </section>
    </>
  );
}
