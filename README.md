<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/logo-escuro.png">
    <img src="docs/logo.png" alt="central" width="360">
  </picture>
</p>

<p align="center">A sua empresa tocada por uma equipe de agentes de IA. Eles trabalham, você decide.</p>

<p align="center"><img src="docs/equipe.png" alt="A equipe: Inspetor Rastro, Editora Pauta, Negociador Trato, Conselho, Gerente Rotina, Norte e Revisor" width="900"></p>

## Pedágio

A Central é grátis para sempre. O pedágio é outro, e não custa nada:

1. Seguir o **[@mongarde_](https://x.com/mongarde_)** no X.
2. Cadastrar o seu projeto no ranking do **[mamaevireidev.com.br](https://mamaevireidev.com.br)**.
3. Dar uma força ao **[Clara Finance](https://github.com/cesaroeduardo/clara-finance?utm_source=mamaevireidev&utm_medium=ranking&utm_campaign=clara-finance&mvd_cid=zVTQdltE9CLQS7Yf)**, projeto de um amigo (uma estrela já ajuda).
4. Entrar na **[comunidade do X no WhatsApp](https://chat.whatsapp.com/GBKvnYBUEaaBqsJtzibh4r?s=cl&p=i&iam=2)**.

Dentro da Central, a seção **Pedágio** tem os mesmos links.

## O que é

Você conecta a sua empresa e uma equipe de 7 chefes passa a trabalhar nela. Tudo o que eles fazem chega em **Decisões**: você aprova, pede ajuste ou passa. Nada sai sem você.

| Chefe | Cuida de | Exemplos |
| --- | --- | --- |
| **Inspetor Rastro** | Presença | Acha a empresa no Google Maps, compara a nota e as avaliações com os vizinhos |
| **Editora Pauta** | Redes | Plano do mês, legenda, carrossel, roteiro de Reels/TikTok/Shorts, YouTube, stories, respostas |
| **Negociador Trato** | Vendas | Prospecção, conversa no WhatsApp, objeções, follow-up, proposta, contrato, página de vendas |
| **Conselho** | Estratégia | Avaliar ideia, concorrentes, oferta, preço, lançamento, marca, marketing, conta do lucro |
| **Gerente Rotina** | Operação | Lê os números do mês e aponta o que mudou |
| **Norte** | Diretoria | Escolhe a ação da semana e afina os seus pedidos |
| **Revisor** | Bastidor | Tira a cara de IA e confere os fatos antes de você ver |

E ainda:

- **Estúdio de redes**: cronograma do mês, carrosséis com a sua marca, roteiros, referências e as versões de cada peça.
- **Buffer**: peça aprovada e com data no cronograma vai para a fila do Buffer e sai no dia e na hora.
- **Contas das redes**: perfil, seguidores e cada post aberto com as métricas dele contra a média da conta. Vídeo do YouTube abre no player.
- **Sem API das redes**: o seu agente (OpenClaw, Hermes, Claude Code, Codex, um bot do Grok ou do n8n) lê os seus perfis e manda para a Central por uma chave. A tela de Conexões já traz o texto pronto para colar nele.
- **38 skills em português**, para negócio brasileiro (WhatsApp, Pix, MEI, Simples). Ficam na pasta `skills/`: dá para ler e editar.
- **Atualizações**: versão nova da Central, projetos novos e skills novas para instalar com um clique.
- **API e MCP**: tudo o que a tela faz, o seu agente faz por `/api/conta/v1` ou pelo MCP.

Nada de chave minha aqui dentro. A IA roda na **sua** chave (Claude, GPT, Gemini, DeepSeek, Grok ou OpenRouter), cobrada direto pelo provedor. As chaves ficam cifradas no seu banco.

## Telas

<p align="center"><img src="docs/telas/inicio.png" alt="Início: a ação da semana e a equipe" width="900"></p>

| | |
| --- | --- |
| <img src="docs/telas/entrar.png" alt="Entrar"> | <img src="docs/telas/onboarding.png" alt="Onboarding: o Rastro acha a empresa no Google Maps"> |
| **Entrar**: a equipe viva do lado. | **Onboarding**: o Rastro acha a empresa no Maps e preenche a ficha. Todo passo pula. |
| <img src="docs/telas/decisoes.png" alt="Decisões"> | <img src="docs/telas/vendas.png" alt="Vendas"> |
| **Decisões**: aprovar, pedir ajuste ou passar. | **Vendas**: tudo o que o Negociador Trato faz, um botão por ação. |
| <img src="docs/telas/conta.png" alt="Conta da rede"> | <img src="docs/telas/post.png" alt="Post aberto"> |
| **Contas das redes**: perfil, seguidores e os posts. | **Post aberto**: cada métrica contra a média da conta. |

---

## Começar em 3 comandos

Precisa do [Node.js 20.19+](https://nodejs.org) (Mac, Windows ou Linux).

```bash
git clone https://github.com/matheusmongarde/central.git
cd central
npm install
npm run setup     # escolhe o banco, gera o .env e instala o Rastro
npm run tudo      # sobe a Central + o Rastro
```

Abra **http://localhost:3000**. A primeira tela cria a sua conta (nome, empresa, e-mail e senha). Depois vêm, um por vez, a chave de IA e as redes, a sua empresa (o Rastro acha ela no Google Maps e preenche a ficha) e o Buffer. **Todo passo tem "pular por agora"**: dá para ligar depois em Conexões.

> Sem paciência? `npm install && npm run dev` já funciona com banco local, sem setup nenhum.

## Banco de dados

| Onde roda | Banco | `DATABASE_URL` |
| --- | --- | --- |
| Seu computador, VPS | SQLite (arquivo em `dados/`) | `file:./dados/central.db` |
| Vercel, ou quer na nuvem | Postgres (Supabase, Neon…) | `postgresql://usuario:senha@host:5432/postgres` |

Trocou a URL? Rode `npm run db` (gera o cliente e cria as tabelas). As imagens (slides, fotos da marca) também ficam no banco, então funcionam igual em qualquer lugar.

## Conexões

| O quê | Para quê | Onde pega |
| --- | --- | --- |
| Chave de IA | Os chefes trabalham | Claude, OpenAI, Gemini, DeepSeek, xAI ou OpenRouter (um clique) |
| Redes pela API | Métricas completas (alcance, salvamentos, retenção) | Instagram, YouTube, LinkedIn, X e Perfil da Empresa no Google, com guia passo a passo na tela |
| Redes pelo agente | Dados públicos sem API (seguidores, posts, curtidas) | Uma chave com o escopo **Redes** em Conexões › API e MCP |
| Buffer | Publicar sozinho no horário | [publish.buffer.com/settings/api](https://publish.buffer.com/settings/api) |
| Rastro | Achar a empresa e os vizinhos no Google Maps | Já vem junto (`servicos/rastro`) |
| E-mail | Link de "esqueci a senha" | [Resend](https://resend.com/api-keys). Sem ele, o link aparece no terminal |

O Buffer baixa as imagens da sua Central pelo link. Por isso ele só publica imagem com a Central num endereço público (VPS ou Vercel). No seu computador, o texto vai e a imagem você sobe no app do Buffer.

## Seu agente na Central

Em **Conexões › API e MCP**, crie uma chave e escolha o que ela pode fazer:

| Escopo | O agente pode |
| --- | --- |
| Ler | Ler decisões, entregas e execuções |
| Decidir | Aprovar, passar ou pedir ajuste |
| Pedir | Pedir trabalho a um chefe |
| Redes | Mandar perfil, seguidores e posts de qualquer rede (`POST /redes`) |
| Números | Informar os números do mês (`POST /numeros`) |
| Publicar | Ler a fila de peças aprovadas e marcar o que publicou (`GET /publicar`) |

```bash
curl http://localhost:3000/api/conta/v1 -H "Authorization: Bearer cen_..."
```

No Claude Code: `claude mcp add --transport http central http://localhost:3000/api/conta/mcp --header "Authorization: Bearer cen_..."`.

## Skills

Os manuais que os chefes leem ficam em `skills/<área>/<skill>/SKILL.md`:

```
skills/
  redes/        11 skills da Editora Pauta (servem Instagram, TikTok, YouTube, LinkedIn e X)
  vendas/       proposta, contrato, funil, agenda
  prospeccao/   as 8 da skill-prospeccao
  chicote/      a página de vendas (github.com/matheusmongarde/chicote)
  estrategia/   8 skills do Conselho
  operacao/     conta do lucro, operação do dia, plano de negócio
  bastidor/     afinar pedido, checar fatos, tirar cara de IA
```

Edite à vontade: o chefe lê o arquivo na hora. Skills novas chegam em **Atualizações** (o catálogo é o `catalogo.json` deste repositório).

## Subir em produção

### VPS (Ubuntu/Debian)

```bash
npm install && npm run setup     # o endereço público é o seu domínio
npm run build
npm i -g pm2 && pm2 start ecosystem.config.cjs && pm2 save
```

Na VPS, o botão **Atualizar** da tela de Atualizações faz `git pull`, instala, atualiza o banco, refaz o build e reinicia pelo PM2.

### Docker

```bash
npm run setup          # só para gerar o .env com os tokens
docker compose up -d
```

### Vercel

1. Faça um fork deste repositório e importe na Vercel.
2. Crie as variáveis `DATABASE_URL` (Postgres: Supabase ou Neon), `APP_SECRET` (32+ caracteres aleatórios) e `APP_URL` (o endereço do projeto).
3. Deploy. Para atualizar depois: **Sync fork** no GitHub e a Vercel publica sozinha.

O Rastro precisa de um navegador de verdade, então não roda na Vercel: suba ele numa VPS (`servicos/rastro`) e aponte em Conexões › Rastro, ou use a chave reserva da Google Places API.

## Esqueci a senha

Sem e-mail configurado, o link aparece no terminal onde a Central roda. Ou:

```bash
npm run senha
```

## Licença

MIT. Use, mude e venda como quiser.
