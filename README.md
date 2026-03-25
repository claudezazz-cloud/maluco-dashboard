# Maluco da IA 👽🍀

**Assistente de IA interno para equipes da Zazz Internet** — provedor de fibra optica em Lunardelli-PR.

---

## Objetivo do Projeto

O Maluco da IA e um bot de WhatsApp com inteligencia artificial que funciona como assistente interno da empresa Zazz Internet. Ele atende os colaboradores diretamente no grupo de WhatsApp da equipe, respondendo duvidas sobre procedimentos da empresa (POPs), criando tarefas no Notion, gerando relatorios e aprendendo novas regras de comportamento em tempo real.

O projeto surgiu da necessidade de centralizar o conhecimento operacional da empresa em um unico lugar acessivel a todos os colaboradores, sem precisar procurar em documentos espalhados ou perguntar para o gestor. O bot consulta automaticamente os procedimentos cadastrados, mantem contexto de conversa e entende tanto mensagens de texto quanto audio.

Alem do bot, existe uma dashboard web completa para o administrador gerenciar tudo: POPs, regras de comportamento, system prompt, colaboradores, filiais, historico de conversas e log de erros.

---

## O que o bot ja faz hoje

### Atendimento no WhatsApp
- Responde mensagens de texto quando mencionado no grupo (ex: "@Claude como faco uma nova venda?")
- Recebe e transcreve mensagens de audio usando a API do Whisper (OpenAI)
- Busca semantica de POPs — quando o colaborador pergunta sobre um assunto, o bot carrega apenas os procedimentos relevantes usando full-text search do PostgreSQL (`to_tsvector`/`plainto_tsquery` com dicionario 'portuguese'), em vez de enviar todos os POPs de uma vez
- Mantem historico de conversa com Redis — o bot lembra das ultimas 8 mensagens trocadas para manter contexto entre perguntas
- Cria tarefas automaticamente no Notion quando o colaborador pede (ex: "Claude agenda uma instalacao para o cliente Joao amanha")
- Aprende novas regras em tempo real via WhatsApp (ex: "Claude aprenda: sempre pergunte o telefone do cliente")
- Gera relatorios diarios, semanais e mensais com base no historico de mensagens do grupo
- Envia mensagem de bom dia automatica de segunda a sabado as 7:30

### Tratamento de erros
- Quando a API do Claude retorna erro (ex: token limit, chave invalida), o bot responde com uma mensagem amigavel em vez de travar
- Todos os erros sao salvos automaticamente no banco de dados com detalhes: nome do no que falhou, mensagem de erro, mensagem do usuario que causou o erro, chat_id e timestamp
- Os erros podem ser consultados na dashboard

### Registro de conversas
- Toda interacao (pergunta do colaborador + resposta do bot) e salva no PostgreSQL
- Inclui metadados: remetente, tokens consumidos (input e output), POPs utilizados na resposta, chat_id
- Historico consultavel na dashboard com busca e paginacao

---

## Stack Tecnologica

| Componente | Tecnologia | Detalhes |
|-----------|-----------|----------|
| Automacao | **N8N Cloud** (v2.12.2) | Orquestra todo o fluxo do bot, 39 nos no workflow |
| WhatsApp | **Evolution API v2** | Instancia `ZazzClaude` hospedada no CloudFy |
| Inteligencia Artificial | **Claude Haiku 4.5** (Anthropic) | Modelo `claude-haiku-4-5-20251001`, chamado via API REST |
| Transcricao de audio | **OpenAI Whisper** | API `v1/audio/transcriptions` para converter audio em texto |
| Banco de dados | **PostgreSQL** | Hospedado no CloudFy (cloudfy.host), armazena mensagens, POPs, regras, conversas, erros, config |
| Cache e historico | **Redis** | Hospedado no CloudFy (`lanlunar-redis.cloudfy.live:6476`), armazena historico de conversa por chat_id |
| Tarefas | **Notion API** | Cria paginas automaticamente quando o colaborador solicita uma tarefa |
| Dashboard | **Next.js 14** + Tailwind CSS | App Router, React 18, tema dark customizado |
| Deploy dashboard | **Railway** | Auto-deploy via push no GitHub (`main` branch) |
| Repositorio | **GitHub** | `claudezazz-cloud/maluco-dashboard` |

---

## Servidores e Links

| Servico | URL | Observacao |
|---------|-----|-----------|
| Dashboard (producao) | `https://maluco-dashboard-production.up.railway.app` | Deploy automatico via GitHub |
| N8N Cloud | Painel do N8N | Workflow importado manualmente |
| Evolution API | `https://lanlunar-evolution.cloudfy.live` | Instancia WhatsApp: `ZazzClaude` |
| PostgreSQL | Hospedado no CloudFy | Credential no N8N: `postgres_cloudfy` (ID: `3jjT34yuXwgLE6ZN`) |
| Redis | `lanlunar-redis.cloudfy.live:6476` | Credential no N8N: `redis_cloudfy` (ID: `XYsy0h9be9PkUPMP`) |
| Notion | API via `api.notion.com` | Usado para criacao de tarefas |

---

## Banco de Dados — Tabelas PostgreSQL

O projeto usa um unico banco PostgreSQL com as seguintes tabelas:

### `mensagens`
Armazena todas as mensagens do grupo de WhatsApp (independente de mencionar o bot).
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| `id` | SERIAL PK | ID auto-incremento |
| `message_id` | VARCHAR UNIQUE | ID da mensagem no WhatsApp (evita duplicatas) |
| `remetente` | VARCHAR | Nome de quem enviou |
| `mensagem` | TEXT | Conteudo da mensagem (max 2000 chars) |
| `chat_id` | VARCHAR | ID do grupo/chat |
| `data_hora` | TIMESTAMPTZ | Quando foi enviada |

### `dashboard_pops`
Procedimentos Operacionais Padrao da empresa, consultados pelo bot via busca semantica.
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| `id` | SERIAL PK | ID auto-incremento |
| `titulo` | VARCHAR(255) | Nome do procedimento |
| `categoria` | VARCHAR(255) | Categoria (Geral, Atendimento, Tecnico, Financeiro, Comercial, RH, Outro) |
| `conteudo` | TEXT | Conteudo completo do POP |
| `ativo` | BOOLEAN | Se o POP esta ativo (soft delete) |
| `criado_em` | TIMESTAMP | Data de criacao |
| `atualizado_em` | TIMESTAMP | Ultima atualizacao |

### `regras`
Regras de comportamento da IA, ensinadas via WhatsApp ou dashboard.
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| `id` | SERIAL PK | ID auto-incremento |
| `regra` | TEXT | Texto da regra (ex: "sempre pergunte o telefone do cliente") |

### `dashboard_config`
Configuracoes gerais, incluindo o system prompt customizado.
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| `id` | SERIAL PK | ID auto-incremento |
| `chave` | VARCHAR(255) UNIQUE | Nome da configuracao (ex: `system_prompt`) |
| `valor` | TEXT | Valor da configuracao |
| `atualizado_em` | TIMESTAMP | Ultima atualizacao |

### `dashboard_colaboradores`
Colaboradores da empresa, injetados no prompt para o bot reconhecer nomes e cargos.
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| `id` | SERIAL PK | ID auto-incremento |
| `nome` | VARCHAR(255) | Nome do colaborador |
| `cargo` | VARCHAR(255) | Cargo na empresa |
| `funcoes` | TEXT | Descricao das funcoes |
| `ativo` | BOOLEAN | Se esta ativo |

### `dashboard_filiais`
Filiais da empresa, cada uma podendo ter seu proprio bot/workflow.
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| `id` | SERIAL PK | ID auto-incremento |
| `nome` | VARCHAR | Nome da filial |
| `n8n_workflow_id` | VARCHAR | ID do workflow no N8N |
| `evolution_instance` | VARCHAR | Instancia do WhatsApp |
| `group_chat_id` | VARCHAR | ID do grupo de WhatsApp |
| `ativo` | BOOLEAN | Se esta ativa |

### `dashboard_filiais_config`
Configuracoes por filial (chaves de API, tokens, etc).
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| `id` | SERIAL PK | ID auto-incremento |
| `filial_id` | INTEGER FK | Referencia `dashboard_filiais(id)` |
| `chave` | VARCHAR(255) | Nome da config (evolution_url, anthropic_key, etc) |
| `valor` | TEXT | Valor da config |

### `bot_conversas`
Historico de todas as interacoes do bot (pergunta + resposta).
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| `id` | SERIAL PK | ID auto-incremento |
| `chat_id` | VARCHAR(255) | ID do grupo/chat |
| `remetente` | VARCHAR(255) | Quem perguntou |
| `mensagem` | TEXT | Pergunta do colaborador (max 2000 chars) |
| `resposta` | TEXT | Resposta do bot (max 4000 chars) |
| `pops_usados` | TEXT | POPs que foram incluidos no contexto |
| `tokens_input` | INTEGER | Tokens de entrada consumidos |
| `tokens_output` | INTEGER | Tokens de saida consumidos |
| `criado_em` | TIMESTAMPTZ | Timestamp da interacao |

### `bot_erros`
Log de erros do bot, registrados automaticamente quando algo falha.
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| `id` | SERIAL PK | ID auto-incremento |
| `no_n8n` | VARCHAR(255) | Nome do no do N8N que falhou |
| `mensagem_erro` | TEXT | Mensagem de erro tecnica |
| `mensagem_usuario` | TEXT | Mensagem do usuario que causou o erro |
| `chat_id` | VARCHAR(255) | ID do grupo/chat |
| `criado_em` | TIMESTAMPTZ | Quando o erro ocorreu |

### Redis
O Redis armazena o historico de conversa por `chat_id` como chave.
- **Chave**: `history:{chatId}` (ex: `history:5543991663335@s.whatsapp.net`)
- **Valor**: JSON array com as ultimas mensagens no formato `[{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}]`
- **Uso**: O no "Busca Historico Redis" le o historico antes de montar o prompt, e o no "Salva Historico Redis" atualiza com a nova mensagem apos cada resposta
- **Limite**: Ultimas 8 interacoes (16 mensagens role/content) sao mantidas

---

## Arquitetura do Workflow N8N

O workflow principal tem **39 nos** organizados em varios fluxos:

### Fluxo principal (mensagem de texto)
```
Webhook (WhatsApp via Evolution API)
  |
  v
Extrai Dados Mensagem (Code)
  - Extrai: messageId, remetente, mensagem, chatId, isFromMe
  - Detecta tipo: texto, audio, imagem, etc
  |
  v
Salva no Postgres
  - Salva TODAS as mensagens do grupo na tabela `mensagens`
  - Independente de mencionar o bot
  |
  +---> Filter1 (filtra mensagens do proprio bot)
  |
  +---> Detecta Audio ---> [Fluxo de Audio]
  |
  v
Verifica Mencao (Code)
  - Verifica se o bot foi mencionado (@Claude, @Maluco, etc)
  - Se nao foi mencionado, para aqui
  |
  +---> E Treinamento? ---> Salva Regra ---> Confirma Aprendizado (WhatsApp)
  |
  +---> E Relatorio? ---> Busca Historico Postgres ---> Busca Historico 10
  |                        ---> Monta Prompt Relatorio ---> Claude API
  |
  v
Busca POPs (Postgres - busca semantica)
  - Usa to_tsvector/plainto_tsquery com dicionario 'portuguese'
  - Normaliza a mensagem (remove acentos, caracteres especiais)
  - Ordena por relevancia (ts_rank)
  |
  v
Busca System Prompt (Postgres)
  - Le o system prompt da tabela dashboard_config
  |
  v
Busca Colaboradores (Postgres)
  - Le a lista de colaboradores ativos
  |
  v
Busca Historico Redis
  - Busca as ultimas mensagens da conversa por chat_id
  |
  v
Monta Prompt (Code - no principal)
  - Combina: system prompt + regras + colaboradores + POPs relevantes + historico Redis
  - Substitui placeholders: {{DATA}}, {{ANO}}, {{TODAY}}, {{COLABORADORES}}, {{POPS}}, {{HISTORICO}}
  - Monta o body JSON para a API do Claude
  - Retorna: claudeBody, remetente, mensagemUsuario, popsUsados
  |
  v
Claude API (HTTP Request)
  - POST https://api.anthropic.com/v1/messages
  - Modelo: claude-haiku-4-5-20251001
  - Max tokens: 2048
  - Header: x-api-key, anthropic-version 2023-06-01
  |
  v
Parse Resposta (Code)
  - Extrai texto da resposta do Claude
  - Detecta se ha bloco |||NOTION||| para criar tarefa
  - Trata erros da API (retorna mensagem amigavel)
  - Calcula tokens consumidos
  - Monta novoHistorico para salvar no Redis
  |
  +--> Envia WhatsApp (HTTP Request - Evolution API)
  |
  +--> Salva Historico Redis (Redis SET)
  |
  +--> Salva Conversa (Postgres - tabela bot_conversas)
  |
  +--> E Erro? (Filter) ---> Salva Erro (Postgres - tabela bot_erros)
  |
  +--> Tem Notion? (IF) ---> Cria no Notion (HTTP Request)
```

### Fluxo de audio
```
Detecta Audio (Code)
  |
  v
Baixa Audio (HTTP Request - Evolution API getBase64FromMediaMessage)
  |
  v
Converte p/ Whisper (Code - converte base64 para formato multipart)
  |
  v
Transcreve Audio (HTTP Request - OpenAI Whisper API)
  |
  v
Formata Transcricao (Code)
  |
  v
Salva Transcricao (Postgres)
  |
  v
Verifica Mencao Audio ---> [continua no fluxo principal a partir de Busca POPs]
```

### Fluxo Bom Dia
```
Bom Dia Trigger (Schedule: seg-sab 7:30 AM)
  |
  v
Gera Bom Dia (Claude API - gera mensagem motivacional)
  |
  v
Extrai Mensagem (Code)
  |
  v
Envia Bom Dia (Evolution API - WhatsApp)
```

---

## Dashboard Web

**URL**: https://maluco-dashboard-production.up.railway.app

### Autenticacao
- Login com email + senha (bcryptjs para hash)
- JWT token armazenado em cookie HTTP-only (`auth_token`)
- Sessao valida por 7 dias
- Paginas protegidas: redireciona para `/login` se nao autenticado
- Paginas admin-only: redireciona para `/dashboard` se nao for admin

### Paginas

#### `/login` — Tela de Login
Formulario simples com email e senha. Apos login, redireciona para `/dashboard`.

#### `/dashboard` — Visao Geral
- Metricas globais: bots online, mensagens hoje, erros hoje
- Cards por filial mostrando status (online/offline), ultima execucao, erros do dia
- Lista de execucoes recentes do N8N (com filtro por filial)
- Auto-refresh a cada 30 segundos (toggle on/off)

#### `/pops` — Procedimentos Operacionais (admin)
- Lista todos os POPs cadastrados com titulo, categoria e data
- Criar novo POP (titulo, categoria, conteudo)
- Editar POP inline (expande o card, modo edicao)
- Arquivar POP (soft delete — `ativo = false`)
- Busca por titulo ou conteudo
- Filtro por categoria
- Categorias disponiveis: Geral, Atendimento, Tecnico, Financeiro, Comercial, RH, Outro

#### `/treinamento` — Regras de Comportamento (admin)
- Lista de regras que o bot deve seguir
- Adicionar nova regra (texto livre)
- Editar regra existente
- Excluir regra
- Gerenciar colaboradores: nome, cargo, funcoes (mesmo formulario nesta pagina)

#### `/system-prompt` — Instrucoes Base (admin)
- Editor de texto completo para o system prompt do bot
- Mostra placeholders disponiveis: `{{DATA}}`, `{{ANO}}`, `{{TODAY}}`, `{{COLABORADORES}}`, `{{CLIENTES}}`, `{{POPS}}`, `{{HISTORICO}}`, `{{REGRAS}}`
- Botao de restaurar prompt padrao
- Salva na tabela `dashboard_config` com chave `system_prompt`

#### `/conversas` — Historico de Interacoes (admin)
- Aba "Conversas": lista paginada (30 por pagina) de todas as interacoes do bot
  - Cards expansiveis mostrando: remetente, data, mensagem do colaborador, resposta do bot
  - Badges: tokens consumidos, POPs utilizados na resposta
  - Busca por texto (em mensagem, resposta ou remetente)
- Aba "Erros": lista dos ultimos 100 erros do bot
  - Detalhes: nome do no N8N, mensagem de erro, mensagem do usuario, chat_id, timestamp
  - Botao para limpar erros com mais de 7 dias

#### `/admin` — Gerenciamento de Filiais (admin)
- Lista de filiais com nome, workflow ID, instancia Evolution, chat_id
- Criar nova filial (com opcao de duplicar workflow base do N8N)
- Configurar credenciais por filial: Evolution URL/key, Anthropic key, OpenAI key, Notion token
- Excluir filial

### API Routes da Dashboard

| Rota | Metodo | Auth | Descricao |
|------|--------|------|-----------|
| `/api/auth/login` | POST | - | Login com email/senha, retorna cookie JWT |
| `/api/auth/logout` | POST | - | Remove cookie de autenticacao |
| `/api/auth/me` | GET | JWT | Retorna dados do usuario logado |
| `/api/status` | GET | JWT | Status de todas as filiais (bots online, mensagens, erros) |
| `/api/executions` | GET | JWT | Execucoes recentes do N8N |
| `/api/pops` | GET/POST | Admin | Listar/criar POPs |
| `/api/pops/[id]` | PUT/DELETE | Admin | Editar/arquivar POP |
| `/api/pops-n8n` | GET | Token | Endpoint para o N8N buscar POPs (auth via header `x-token`) |
| `/api/treinamento` | GET/POST | Admin | Listar/criar regras |
| `/api/treinamento/[id]` | PUT/DELETE | Admin | Editar/excluir regra |
| `/api/system-prompt` | GET/PUT | Admin | Ler/atualizar system prompt |
| `/api/colaboradores` | GET/POST | Admin | Listar/criar colaboradores |
| `/api/colaboradores/[id]` | PUT/DELETE | Admin | Editar/excluir colaborador |
| `/api/filiais` | GET/POST | Admin | Listar/criar filiais |
| `/api/filiais/[id]` | PUT/DELETE | Admin | Editar/excluir filial |
| `/api/conversas` | GET/POST | GET=Admin, POST=aberto | Listar conversas (paginado) / N8N salva conversa |
| `/api/erros` | GET/POST/DELETE | GET/DELETE=Admin, POST=aberto | Listar/salvar/limpar erros |

---

## Variaveis de Ambiente (Dashboard - Railway)

| Variavel | Descricao |
|----------|-----------|
| `PG_URL` | Connection string do PostgreSQL (ex: `postgresql://user:pass@host:port/db`) |
| `JWT_SECRET` | Secret para assinar tokens JWT de autenticacao |
| `N8N_URL` | URL do N8N Cloud (ex: `https://xxx.app.n8n.cloud`) |
| `N8N_API_KEY` | Chave de API do N8N para consultar workflows e execucoes |
| `N8N_POPS_TOKEN` | Token simples para o endpoint `/api/pops-n8n` (default: `MALUCO_POPS_2026`) |

---

## Como funciona o deploy

### Dashboard (automatico)
1. Push na branch `main` do GitHub
2. Railway detecta o push automaticamente
3. Executa `npm run build` (Next.js)
4. Inicia com `npm run start` na porta definida pelo Railway
5. Dashboard disponivel em `https://maluco-dashboard-production.up.railway.app`

### Workflow N8N (manual)
1. Editar o arquivo `workflow.json` na raiz do projeto
2. No painel do N8N Cloud, ir em "Import from file"
3. Selecionar o `workflow.json` atualizado
4. Conferir se as credentials (PostgreSQL, Redis) estao vinculadas corretamente
5. Ativar o workflow

---

## Estrutura de Arquivos

```
/
├── workflow.json                    # Workflow principal do N8N (39 nos)
├── deploy_workflow.json             # Copia de deploy
├── README.md                        # Este arquivo
├── SE VOCE E UMA IA, LEIA ISSO...  # Instrucoes para o Claude Code
│
├── dashboard/                       # Copia local de desenvolvimento
│   ├── package.json                 # Next.js 14, React 18, Tailwind CSS
│   ├── tailwind.config.js
│   ├── next.config.js
│   │
│   ├── app/                         # App Router (Next.js 14)
│   │   ├── layout.js                # Layout raiz
│   │   ├── page.js                  # Redirect para /dashboard
│   │   ├── globals.css              # Estilos globais (Tailwind)
│   │   ├── login/page.jsx           # Tela de login
│   │   ├── dashboard/page.jsx       # Visao geral
│   │   ├── pops/page.jsx            # Gerenciar POPs
│   │   ├── treinamento/page.jsx     # Regras + Colaboradores
│   │   ├── system-prompt/page.jsx   # Editor de system prompt
│   │   ├── conversas/page.jsx       # Historico de conversas + erros
│   │   ├── admin/page.jsx           # Gerenciar filiais
│   │   │
│   │   └── api/                     # API Routes
│   │       ├── auth/                # Login, logout, me
│   │       ├── pops/                # CRUD POPs
│   │       ├── pops-n8n/            # Endpoint para N8N
│   │       ├── treinamento/         # CRUD regras
│   │       ├── system-prompt/       # Ler/salvar system prompt
│   │       ├── colaboradores/       # CRUD colaboradores
│   │       ├── filiais/             # CRUD filiais
│   │       ├── status/              # Status dos bots
│   │       ├── executions/          # Execucoes N8N
│   │       ├── conversas/           # Historico de conversas
│   │       ├── erros/               # Log de erros
│   │       ├── n8n/                 # Proxy para API do N8N
│   │       ├── setup/               # Setup inicial do banco
│   │       └── debug/               # Debug/diagnostico
│   │
│   ├── components/                  # Componentes React
│   │   ├── Navbar.jsx               # Barra de navegacao (links admin-only)
│   │   ├── StatusCard.jsx           # Card de status por filial
│   │   └── ExecutionList.jsx        # Lista de execucoes N8N
│   │
│   └── lib/                         # Bibliotecas compartilhadas
│       ├── db.js                    # Pool PostgreSQL (pg)
│       ├── auth.js                  # JWT sign/verify/getSession
│       └── n8n.js                   # Client API do N8N
```

---

## Dependencias do Projeto

### Dashboard (package.json)
- **next** ^14.2.35 — Framework React full-stack
- **react** ^18 — Biblioteca UI
- **react-dom** ^18 — Renderizacao React
- **pg** ^8.12.0 — Driver PostgreSQL para Node.js
- **jsonwebtoken** ^9.0.2 — Geracao e verificacao de JWT
- **bcryptjs** ^2.4.3 — Hash de senhas
- **tailwindcss** ^3.4.1 — Framework CSS utilitario
- **autoprefixer** ^10.4.19 — PostCSS plugin
- **postcss** ^8.4.38 — Processador CSS

### APIs externas
- **Anthropic API** — Claude Haiku 4.5 para gerar respostas
- **OpenAI API** — Whisper para transcrever audio
- **Evolution API** — Enviar e receber mensagens do WhatsApp
- **Notion API** — Criar paginas/tarefas automaticamente
- **N8N API** — Consultar workflows e execucoes na dashboard

---

## Desenvolvimento por

**Franquelin Baldoria de Almeida**
- Instagram: [@Frank_almeida5](https://instagram.com/Frank_almeida5)
- WhatsApp: (43) 99166-3335
