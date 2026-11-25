---
name: Korely
colors:
  # Base (claro)
  mineral: "#F5F4F1"        # fundo da página
  surface: "#FFFFFF"        # cards e painéis
  tinta: "#1A1A1A"          # texto principal
  aco: "#6B6B6B"            # texto secundário
  concreto: "#3D3D3D"       # neutro escuro (sombras, hovers)
  border: "#D8D6D0"         # divisórias
  # Destaque
  luz-servico: "#2F6AF7"    # azul de ação (sem nicho)
  accent-barbearia: "#A3401B"
  accent-petshop: "#B45309"
  accent-estetica: "#9E3F5C"
  # Estados
  confirmado: "#16A34A"
  aguardando: "#D97706"
  error: "#B91C1C"
  # Escuro
  dark-background: "#0D0D0D"
  dark-surface: "#1A1A1A"
  dark-foreground: "#F2F0EB"
  # Chefes (claro / escuro)
  chefe-rastro: "#0B6B63"
  chefe-pauta: "#9B2C6B"
  chefe-trato: "#9A4A06"
  chefe-conselho: "#3A3F9A"
  chefe-rotina: "#1D6B34"
  chefe-norte: "#1A1A1A"
---

# Design System: Korely

Guia visual do painel e do site da Korely. Parte 1–5 descreve **o que o código
tem hoje** (extraído de `src/app/globals.css`, `src/app/layout.tsx` e
`src/components/ui`). A Parte 6 traz **as regras que valem daqui pra frente**:
onde o código atual diverge delas, a regra manda e a tela é ajustada quando
for mexida. A Parte 7 é a rotina de verificação obrigatória.

## 1. Atmosfera

Papel mineral morno (`#F5F4F1`) com superfícies brancas por cima, texto quase
preto e um único destaque de cor por contexto. É um painel de trabalho para
dono de barbearia, pet shop e clínica de estética: calmo, legível no celular,
sem enfeite. A cor de destaque muda com o nicho (latão/terra na barbearia,
laranja no pet, rosé na estética) e cada chefe de IA tem a sua cor fixa.

Três temas no painel (`html[data-theme]`): **claro** (padrão), **escuro** e
**executivo**. O nicho entra por `data-nicho` e reescreve `--accent`. O site
público usa `data-site-theme` e a variante `dark:` do Tailwind segue esse
atributo, não a preferência do sistema.
A Central (`/central`) segue o mesmo tema do usuário (`User.temaPanel`; executivo vira
escuro) via `data-tema` na raiz `.central`, com botão sol/lua no topo da barra
lateral. Cores só por tokens `--cx-*` (redefinidos em `.central[data-tema="escuro"]`).

## 2. Cores e papéis

Tailwind 4, sem `tailwind.config`: tokens em `:root` e `@theme inline` no
`globals.css`. Use sempre o token, nunca o hex solto.

### Base
| Token | Claro | Escuro | Papel |
|---|---|---|---|
| `--background` / `bg-background` | `#F5F4F1` | `#0D0D0D` | fundo da página |
| `--surface` / `bg-surface` | `#FFFFFF` | `#1A1A1A` | card, painel, folha |
| `--foreground` / `text-foreground` | `#1A1A1A` | `#F2F0EB` | texto principal |
| `--aco` / `text-aco` | `#6B6B6B` | `#F2F0EB` a 65% | texto secundário, rótulos |
| `--concreto` | `#3D3D3D` | `#2A2A2A` | base de sombras e hovers (`concreto/[0.03]`) |
| `--border` | `#D8D6D0` | branco 15% | divisórias |

Estética clara ajusta o fundo para `#FCF8F8` e a borda para `#F0E2E5`.

### Destaque
| Token | Valor | Papel |
|---|---|---|
| `--accent` | `#2F6AF7` sem nicho; `#A3401B` barbearia; `#B45309` pet; `#9E3F5C` estética | botão primário, item ativo, link |
| `--accent-soft` | `--accent` a 8% | fundo de chip, ícone vazio, realce leve |
| `--accent-hover` | `--accent` 86% + preto | hover do primário |
| `--accent-contrast` | `#FFFFFF` | texto sobre destaque |

### Estados
`--status-confirmado #16A34A`, `--status-aguardando #D97706`, `--error #B91C1C`,
cancelado = aço/concreto. Agenda: compareceu `#2F6AF7`, faltou `#B91C1C`.

### Chefes (identidade fixa)
Definidos em `globals.css` (`[data-chefe=…] { --chefe }`) e
`src/components/chefes/chefe-ui.tsx` (`CHEFES_PAINEL`: nome, departamento e
símbolo SVG). Derivados: `--chefe-suave` (9% sobre surface) e `--chefe-linha`.

| Chefe | Departamento | Claro | Escuro/Executivo |
|---|---|---|---|
| Inspetor Rastro | Presença | `#0B6B63` | `#5CCFC2` |
| Editora Pauta | Redes | `#9B2C6B` | `#F08CBF` |
| Negociador Trato | Vendas | `#9A4A06` | `#F2A75E` |
| Conselho | Estratégia | `#3A3F9A` | `#A9ADF5` |
| Gerente Rotina | Operação | `#1D6B34` | `#7FD894` |
| Norte | Diretoria | `#1A1A1A` | `#F4F4F5` |

### Agentes da prospecção (admin)
Mesma mecânica dos chefes (`var(--chefe)`, `--chefe-suave`, `--chefe-linha`):
o Rastro usa `data-chefe="rastro"`; os outros usam `data-agente`. Marca e nome
via `AgenteMarca` / `AgenteNome` (`src/components/admin/prospeccao/agente.tsx`).

| Agente | Atributo | Símbolo | Claro | Escuro/Executivo |
|---|---|---|---|---|
| Rastro | `data-chefe="rastro"` | símbolo do chefe | `#0B6B63` | `#5CCFC2` |
| Prévias | `data-agente="previas"` | Lucide `PanelsTopLeft` | `#5F6B12` | `#C5D46A` |
| Contato frio | `data-agente="contato-frio"` | Lucide `Store` | `#0E6F8F` | `#6CCBE6` |
| Conversa | `data-agente="conversa"` | Lucide `MessageCircle` | `#7A3E9D` | `#D3A4F0` |
| Externo (Grok etc., pela API) | `data-agente="externo"` | Lucide `Bot` | `#475569` | `#B4C0D3` |

O agente externo aparece com o **nome da chave** (`AgenteNome nome=…`), na cor
do Externo.

## 3. Tipografia

Fontes locais (`public/fonts`, via `next/font/local`):

- **Bricolage Grotesque 800** (`font-display`): títulos de página e números de
  destaque. Grotesca larga, com personalidade.
- **Source Sans 3** (`font-sans`, padrão): texto de interface.
- **Inter** (`--font-ui`): telas de cobrança.
- **Geist Mono** (`font-mono`): códigos, chaves.
- **Fraunces**: apenas prévias de site de cliente.

Escala em uso: título de página 28px/700 `leading-tight tracking-tight`;
título de painel 15px/600; corpo `--text-base` 15px; número de KPI 24px/700
`tabular-nums`; rótulo 12px maiúsculo `tracking-wide`.

## 4. Componentes (`src/components/ui`)

- **PageHeader**: faixa no topo da página; título 28px, descrição 14px
  `text-aco`, ações à direita, abas coladas na base, link "voltar" opcional.
- **Card / Panel**: `rounded-xl` (12px), `bg-surface`, hoje com borda de 1px e
  sem sombra; Panel tem cabeçalho 52px com título + 1 ação e corpo `p-5`.
  `PanelGrid`: 8 + 4 colunas no desktop. Nunca card dentro de card.
- **KpiFaixa**: um painel com os números lado a lado e divisória vertical (2 por
  linha no celular); rótulo 12px maiúsculo, valor 24px, apoio 12px.
- **Button**: `rounded-xl`; tamanhos sm (`px-3.5 py-2`), md (`px-6 py-3`),
  lg (`px-8 py-4`); variantes primary (destaque), secondary (borda leve sobre
  surface), ghost, destructive. Foco: anel de 2px na cor de destaque a 45%.
- **Input** (`panel-input.ts`): `rounded-xl`, borda `concreto/12`, `px-4 py-3`,
  foco com borda e anel azul de 10%.
- **Badge**: pílula `rounded-full px-2.5 py-0.5 text-xs`.
- **CountedFilterChips**: chips `rounded-xl px-4 py-2.5` com contador em pílula.
- **Sheet**: folha lateral à direita, até 440px, `shadow-2xl`.
- **Switch**: Radix, 44×24, ligado na cor de ação.
- **EmptyState**: ícone em círculo 64px `accent-soft`, título 15px/600, uma ação.
- **AvatarIniciais**: foto redonda 40px ou iniciais sobre `accent-soft`.

## 5. Layout

- Contêineres: `container-page` (64rem) no site, `container-tenant` (72rem) no
  painel, com margem lateral 16 → 24 → 32 → 40px.
- Espaçamento: grade de 4px; `--spacing-card` 16px, `--spacing-section` 24px;
  `gap-6` entre blocos de página.
- Raios: botão/input/card 12px (`rounded-xl`), `--radius-card` 16px em cards de
  destaque, pílulas `rounded-full`.
- Sombras: `--shadow-premium-card` (duas camadas macias com concreto a 8% e 5%)
  e `--agenda-card-shadow`.
- Movimento: entradas curtas (`chefe-vitoria` 420ms ease-out) e sempre com
  `prefers-reduced-motion: reduce` desligando a animação.

## 6. Regras daqui pra frente

### 6.1 Moldura igual em toda tela de painel
1. **Sobrelinha**: traço curto + texto pequeno em maiúsculas na cor de
   destaque (ex.: `— AGENDA · HOJE`).
2. **Título grande com ponto final** em `font-display` (ex.: "Agenda."). O
   ponto pode vir na cor de destaque.
3. **Uma linha de subtítulo** em `text-aco`. Nunca dois parágrafos.
4. **Controles à direita**, na linha do título (período, ação principal). No
   celular, descem para baixo do subtítulo.

### 6.2 Miolo diferente em cada tela
Cada página tem **uma estrutura dominante** que diz o que ela é: número
gigante, gráfico, calendário, pilha de cartas, mapa, linha do tempo, lista
com fotos. Nunca a mesma forma repetida de tela em tela (ex.: toda página
virando "faixa de KPIs + tabela"). Antes de montar, nomeie a estrutura
dominante da tela.

### 6.3 Números
- Número grande (`font-display`, `tabular-nums`) com **rótulo pequeno em
  maiúsculas** (12–13px, `tracking-wide`, `text-aco`).
- Variação em **chip**: ▲ ou ▼ + percentual, fundo suave (verde 10–12% para
  subida, vermelho para queda), texto na cor cheia.
- Comparação embaixo em uma linha curta ("vs. 30 dias antes: 35.377").

### 6.4 Cards
- Canto arredondado (16px) e **sombra macia, sem borda**
  (`--shadow-premium-card`). Divisória interna só quando separa conteúdo.
- **Um único bloco preenchido na cor de destaque por tela** (o número ou a
  ação que mais importa), com texto branco. O resto em `surface`.
- Nunca card dentro de card.

### 6.5 Imagem e ícones
- Imagem real sempre que existir: foto do cliente, miniatura do post, foto do
  serviço, retrato do profissional.
- Ícones só do **Lucide** (`lucide-react`), traço uniforme. Exceção: símbolo
  próprio de cada chefe (`CHEFES_PAINEL.simbolo`).
- **Proibido emoji como ícone** (em botão, título, item de menu, estado vazio).

### 6.6 Pouco texto
Nenhum parágrafo onde caiba um número, um gráfico ou um botão. Explicação
vira rótulo; instrução vira botão; lista de fatos vira número.

### 6.7 Acessibilidade e responsivo
- Contraste AA no mínimo (4,5:1 texto, 3:1 elementos grandes) nos três temas.
- **Fonte mínima 15px** para texto de leitura; 12–13px só para rótulos em
  maiúsculas e metadados.
- Funciona a **390px** sem rolagem horizontal; alvos de toque ≥ 44px.
- Toda animação respeita `prefers-reduced-motion`.

### 6.8 Identidade dos chefes
Cor e símbolo de cada chefe (tabela da seção 2) iguais em todo lugar: painel,
Central, notificações, e-mails, site. Sempre via `data-chefe` + `var(--chefe)`
e `CHEFES_PAINEL`; nunca hex solto nem símbolo redesenhado.

### 6.9 Referências de estrutura
As imagens em `docs/referencias/` (Studio Criativo / Oratry) servem para
**estrutura e espaçamento**: sobrelinha + título com ponto + subtítulo +
controles à direita; seletor de período em pílulas; cards de número com chip
de variação; um bloco cheio na cor de destaque; calendário com miniaturas;
muito ar entre blocos. **Não copiar** marca, gradiente azul, textos nem
conteúdo.

### 6.10 Sistema: grade, base e escala
Vale para toda tela nova ou mexida (tokens em `src/app/central/central.css`).

- **Grade de 12 colunas** (`.cx-g12`), goteira 24px (`--cx-goteira`). Todo
  bloco ocupa um número inteiro de colunas: 8/4, 7/5, 4/8, 3/9, 12. Nada
  solto fora da grade.
- **Base de 8px**: todo espaçamento é múltiplo de 8 (`--cx-e-1` 8 · `-2` 16 ·
  `-3` 24 · `-4` 32 · `-5` 40 · `-6` 48 · `-8` 64). 4px (`--cx-e-meio`) só
  dentro de componente pequeno (ícone + texto, chip).
- **Escala tipográfica 1,25** a partir de 16px: 13 (rótulo) · 16 (corpo) ·
  20 · 25 · 31 · 39 · 49 · 61 · 76 (`--cx-t-rotulo`, `--cx-t-corpo`,
  `--cx-t-1` … `--cx-t-7`). Tamanho fora da escala só para número gigante
  que precise caber.
- **Container queries**: a área de conteúdo é o contêiner `conteudo` e cada
  bloco é `.cx-bloco` (`container-type: inline-size`). O bloco muda de
  arranjo pela própria largura, não pela janela — assim nada desalinha ao
  reduzir a janela com a barra lateral aberta.
- **Números** sempre `tabular-nums` (a raiz `.central` já liga; não desligar).
  Coluna de número em tabela alinha à direita.
- **Proibido** usar a grade de cards quadrados de borda arredondada como
  solução padrão. Card é para conteúdo que se move junto (uma pessoa, uma
  ação); lista é lista, tabela é tabela, prontuário é prontuário.

### 6.11 Estrutura dominante de cada tela da Central
Cada tela tem UMA estrutura própria. O porquê fica escrito aqui.

| Tela | Estrutura dominante | Por quê |
|---|---|---|
| Início | **Card do Norte em 8/4**: à esquerda a ação (gradiente diagonal por estado, ruído fino, título, botões numa linha de base); à direita o K recortado e o retrato do chefe que executa, saindo pela borda de baixo; anel de progresso da semana. Embaixo, a equipe em linha. | A tela existe para uma decisão por vez. O bloco tem peso de pôster e o rosto de quem vai fazer, para a decisão parecer entregue a alguém. |
| Ficha | **Prontuário**: coluna esquerda fixa com o cartão de identidade (logo, nome, cidade, anel "Ficha X% completa", o que falta) e, à direita, capítulos com edição no lugar (clicar no texto edita); serviços e públicos em etiquetas; "Colar contexto" para a IA distribuir. | É um documento sobre o negócio que todos os chefes leem, não um formulário. Ler primeiro, editar onde está. |
| Conexões | **Painel de controle**: faixa de estado geral no topo (IA, redes X de 5, última leitura), provedores em blocos com logo, a tabela de modelo por chefe com a coluna dos retratos e escolha em pílula, e as redes em blocos com números. "Como pegar o token" abre o **guia na própria página**: passos numerados (7/12) com o link direto e o espaço do print/vídeo de cada um (`midia` em `CATALOGO_REDES`); à direita (5/12, fixo) o token, Testar (chama a rede, não grava), o status, Salvar e como renova. Aba **API e MCP** (`?aba=api`): à esquerda (7/12) as chaves da conta (nome, começo `kor_ct_…`, escopos em etiqueta, último uso, Revogar com confirmação na própria linha), a chave nova num aviso amarelo que aparece uma vez, o formulário (nome + escopos Ler/Decidir/Pedir) e a lista de ferramentas; à direita (5/12) como conectar: endereço do MCP, comando do Claude Code, JSON e curl, com a chave nova já nos exemplos. | A pergunta da tela é "está tudo ligado?". O estado vem antes do detalhe. |
| Contratar | **O formulário**: um bloco 8/12 que começa pela pergunta "O que você precisa?" (texto grande), prazo em pílulas e contato numa linha; ao lado (4/12), só quando existem, "Seus pedidos" em lista com a etapa e o botão Pagar. | Pedir tem que ser a coisa mais fácil da tela. Sem vitrine de serviços: o orçamento é feito sob medida no admin (Pedidos → orçamento → checkout Korely). |
| Projetos | **Loja**: vitrine de produtos (capa 16:10, categoria e versão, nome, o que faz, preço) em 3/2/1 colunas pela largura do contêiner; o detalhe abre na mesma página em 7/5 (galeria com miniaturas, Sobre, linha do tempo de versões; à direita a caixa de compra fixa com preço, Comprar, o que vem junto e requisitos); "Seus projetos" em lista com Baixar e a atualização. | É uma loja: a capa e o preço vendem. Tudo acontece dentro da Central; o checkout da Korely volta para Seus projetos. |
| Conta (menu do avatar) | **Rodapé da barra lateral** com avatar, nome e e-mail abrindo um menu para cima (Minha conta, Meu plano, Histórico de compras, Configurações, Sair). Minha conta: cartão da foto 4/12 + dados e senha 8/12. Meu plano: o plano é o único bloco cheio em azul (nome, valor/mês, situação) e ao lado a cobrança e o que inclui. Compras: **extrato** agrupado por mês com o total, tipo em etiqueta, valor à direita e o recibo imprimível. | Conta é coisa de quem usa, não do negócio: fica no rodapé, fora da navegação do trabalho. O extrato responde "quanto paguei e por quê" sem abrir nada. |
| Execuções | **Log com instrumentos**: faixa de métricas com mini-gráficos, gráfico de custo e execuções por dia do mês, tabela densa agrupada por dia com ponto de status, números à direita e saída abrindo no lugar. | É ferramenta de quem desenvolve: densidade e leitura rápida de padrão, não cartões. |

### 6.12 Fundo ilustrado da Central
`public/central/fundo-{claro,escuro}.png` é a fonte (céu no alto, cidade
embaixo). Saem dois recortes por tema, em AVIF/WebP e versão de celular:
`fundo-*-ceu` (preso no topo da área de conteúdo, some para baixo) e
`fundo-*` (cidade, presa no rodapé, some para cima). As duas camadas usam a
mesma opacidade (20%), desfoque de 2px e máscara em degradê espelhada.

## 7. Rotina de verificação visual

Obrigatória em toda tarefa que mexe em tela. Só commitar depois de passar.

1. **Subir o app**: `npm run dev -- -p 3001` e abrir
   `http://demo-chefes.localhost:3001` pela extensão do Chrome.
2. **Entrar com o usuário de teste** do banco local (dono da conta Demo
   Chefes): e-mail e senha no arquivo local `docs/teste-local.md` (fora do
   git). Só existe no banco local; nunca criar em produção.
3. **Abrir a tela mexida em 1440px e em 390px** (e no tema escuro, se a tela
   usa cor).
4. **Comparar com este DESIGN.md**: moldura (6.1), estrutura dominante (6.2),
   números e chips (6.3), cards (6.4), imagem/ícones/emoji (6.5), excesso de
   texto (6.6), acessibilidade (6.7), chefes (6.8).
5. **Comparar com o checklist do Impeccable** (`impeccable` → `audit`:
   acessibilidade, performance, temas, responsivo, integridade da
   implementação; e o `craft-floor`).
6. **Corrigir e repetir** os passos 3–5 até não sobrar falha.
7. **Commitar.** Os prints da conferência são de trabalho: não vão para o
   repositório nem precisam ser enviados.
