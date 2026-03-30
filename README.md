# Maluco da IA 👽🍀

**Assistente de IA interno para equipes da Zazz Internet** — provedor de fibra optica em Lunardelli-PR.

---

## Objetivo do Projeto

O Maluco da IA e um bot de WhatsApp com inteligencia artificial que funciona como assistente interno da empresa Zazz Internet. Ele atende os colaboradores diretamente no grupo de WhatsApp da equipe, respondendo duvidas sobre procedimentos da empresa (POPs), criando tarefas no Notion, gerando relatorios e aprendendo novas regras de comportamento em tempo real.

O projeto surgiu da necessidade de centralizar o conhecimento operacional da empresa em um unico lugar acessivel a todos os colaboradores, sem precisar procurar em documentos espalhados ou perguntar para o gestor. O bot consulta automaticamente os procedimentos cadastrados, mantem contexto de conversa e entende tanto mensagens de texto quanto audio.

Alem do bot, existe uma dashboard web completa para o administrador gerenciar tudo: POPs, regras de comportamento, system prompt, colaboradores, chamados, clientes, historico de conversas e log de erros.

---

## O que o bot ja faz hoje

### Atendimento no WhatsApp
- Responde mensagens de texto quando mencionado no grupo (ex: "@Claude como faco uma nova venda?")
- Recebe e transcreve mensagens de audio usando a API do Whisper (OpenAI)
- Busca semantica de POPs — quando o colaborador pergunta sobre um assunto, o bot carrega apenas os procedimentos relevantes usando full-text search do PostgreSQL (`to_tsvector`/`plainto_tsquery` com dicionario 'portuguese')
- POPs marcados com "LEIA SEMPRE" no titulo sao incluidos em **todas** as respostas, independente da pergunta
- Mantem historico de conversa com Redis — o bot lembra das ultimas 20 mensagens trocadas para manter contexto entre perguntas (TTL de 4 horas)
- Busca clientes por nome na base de dados quando mencionados na conversa
- Cria tarefas automaticamente no Notion quando o colaborador pede (ex: "Claude agenda uma instalacao para o cliente Joao amanha")
- Aprende novas regras em tempo real via WhatsApp (ex: "Claude aprenda: sempre pergunte o telefone do cliente")
- Gera relatorios diarios, semanais e mensais com base no historico de mensagens do grupo
- Envia mensagem de bom dia automatica de segunda a sabado as 7:30 com resumo dos chamados em aberto
- Importa chamados via planilha XLSX na dashboard — o bot responde perguntas sobre chamados abertos, agendamentos e SLA

### Tratamento de erros
- Quando a API do Claude retorna erro, o bot responde com uma mensagem amigavel em vez de travar
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
| Servidor | **Hostinger VPS KVM 2** | 8GB RAM, Ubuntu 24.04, IP 195.200.7.239 |
| Automacao | **N8N** (Docker) | Orquestra todo o fluxo do bot |
| WhatsApp | **Evolution API v2** (Docker) | Instancia `ZazzClaude` |
| Inteligencia Artificial | **Claude Haiku 4.5** (Anthropic) | Modelo `claude-haiku-4-5-20251001`, chamado via API REST |
| Transcricao de audio | **OpenAI Whisper** | API `v1/audio/transcriptions` para converter audio em texto |
| Banco de dados | **PostgreSQL** (Docker) | Container `n8n-postgres-1`, db `zazzdb`, user `zazz` |
| Cache e historico | **Redis** (Docker) | Container `n8n-redis-1`, historico de conversa e chamados |
| Tarefas | **Notion API** | Cria paginas automaticamente quando o colaborador solicita |
| Dashboard | **Next.js 14** + Tailwind CSS | App Router, React 18, tema dark verde |
| Dashboard deploy | **PM2** | Processo gerenciado em `/opt/zazz/dashboard/` |
| Reverse proxy | **Traefik** | SSL automatico via Let's Encrypt |
| Repositorio | **GitHub** | `claudezazz-cloud/maluco-dashboard` |

---

## Servidores e Links

| Servico | URL | Detalhes |
|---------|-----|----------|
| Dashboard | `https://dashboard.srv1537041.hstgr.cloud` | PM2 na porta 3001 |
| N8N | `https://n8n.srv1537041.hstgr.cloud` | Docker na porta 5678 |
| Evolution API | `https://evolution.srv1537041.hstgr.cloud` | Docker na porta 8080 |
| PostgreSQL | interno | Container Docker, porta 5432 |
| Redis | interno | Container Docker, porta 6379 |
| Notion | API via `api.notion.com` | Criacao de tarefas |

**Docker Compose:** `/docker/n8n/docker-compose.yml`
**Dashboard (PM2):** `/opt/zazz/dashboard/`

---

## Banco de Dados — Tabelas PostgreSQL

Acesso ao banco:
```bash
docker exec -it n8n-postgres-1 psql -U zazz -d zazzdb
```

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
| `titulo` | VARCHAR(255) | Nome do procedimento (se contem "LEIA SEMPRE", aparece em todas as respostas) |
| `categoria` | VARCHAR(255) | Categoria (Geral, Atendimento, Tecnico, Financeiro, Comercial, RH, Outro) |
| `conteudo` | TEXT | Conteudo completo do POP |
| `ativo` | BOOLEAN | Se o POP esta ativo (soft delete) |
| `criado_em` | TIMESTAMP | Data de criacao |
| `atualizado_em` | TIMESTAMP | Ultima atualizacao |

### `dashboard_clientes`
Lista de clientes importada via planilha XLSX na dashboard.
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| `id` | SERIAL PK | ID auto-incremento |
| `cod` | VARCHAR(50) | Codigo do cliente no sistema |
| `nome` | VARCHAR(255) | Nome do cliente |
| `ativo` | BOOLEAN | Se esta ativo |

### `dashboard_usuarios`
Usuarios da dashboard (login).
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| `id` | SERIAL PK | ID auto-incremento |
| `email` | VARCHAR(255) UNIQUE | Email de login |
| `senha_hash` | TEXT | Senha com bcrypt |
| `nome` | VARCHAR(255) | Nome do usuario |
| `role` | VARCHAR(50) | Role: `admin` ou `viewer` |
| `ativo` | BOOLEAN | Se esta ativo |
| `criado_em` | TIMESTAMP | Data de criacao |

### `regras`
Regras de comportamento da IA, ensinadas via WhatsApp ou dashboard.
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| `id` | SERIAL PK | ID auto-incremento |
| `regra` | TEXT | Texto da regra |

### `dashboard_config`
Configuracoes gerais, incluindo o system prompt customizado.
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| `id` | SERIAL PK | ID auto-incremento |
| `chave` | VARCHAR(255) UNIQUE | Nome da configuracao (ex: `system_prompt`, `bom_dia_group_id`) |
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
O Redis armazena dados temporarios:
- **`conv:{chatId}`** — Historico de conversa (ultimas 20 mensagens, TTL 4h)
- **`chamados:data`** — Chamados importados via planilha (TTL 24h)
- **`config:bom_dia_grupo`** — ID do grupo que recebe o bom dia

---

## Arquitetura do Workflow N8N

### Fluxo principal (mensagem de texto)
```
Webhook (WhatsApp via Evolution API)
  |
  v
Filter1 (filtra mensagens validas)
  |
  +---> Extrai Dados Mensagem ---> Salva no Postgres (todas as mensagens)
  |
  +---> Detecta Audio ---> [Fluxo de Audio]
  |
  v
Verifica Mencao (Code)
  - Verifica se o bot foi mencionado
  - Ignora mensagens com mais de 2 minutos
  |
  +---> E Treinamento? ---> Salva Regra ---> Confirma Aprendizado (WhatsApp)
  |
  v
Busca Regras (Postgres)
  |
  v
E Relatorio?
  |--SIM--> Busca Historico Postgres (LIMIT 2000) ---> Monta Prompt Relatorio ---> Claude API
  |
  |--NAO--> Busca Historico 10 ---> Busca POPs (busca semantica + LEIA SEMPRE)
              ---> Busca System Prompt ---> Busca Colaboradores
              ---> Busca Historico Redis ---> Busca Chamados Redis
              ---> Busca Clientes ---> Monta Prompt ---> Claude API
  |
  v
Parse Resposta (Code)
  - Extrai texto, detecta |||NOTION|||, trata erros
  - Monta historico Redis (ultimas 20 msgs)
  |
  +--> Envia WhatsApp (Evolution API)
  +--> Salva Historico Redis (TTL 4h)
  +--> Salva Conversa (Postgres)
  +--> E Erro? ---> Salva Erro (Postgres)
  +--> Tem Notion? ---> Cria no Notion
```

### Fluxo de audio
```
Detecta Audio ---> Baixa Audio (Evolution API)
  ---> Converte p/ Whisper ---> Transcreve Audio (OpenAI Whisper)
  ---> Formata Transcricao ---> Salva Transcricao (Postgres)
  ---> Verifica Mencao Audio ---> [continua no fluxo principal]
```

### Fluxo Bom Dia
```
Bom Dia Trigger (seg-sab 7:30 AM)
  ---> Busca Chamados Bom Dia (Redis)
  ---> Gera Bom Dia (Claude API - saudacao + resumo de chamados)
  ---> Extrai Mensagem
  ---> Busca Config Grupo (Redis)
  ---> Envia Bom Dia (Evolution API)
```

---

## Dashboard Web

**URL**: https://dashboard.srv1537041.hstgr.cloud

### Autenticacao
- Login com email + senha (bcryptjs para hash)
- JWT token armazenado em cookie HTTP-only (`auth_token`)
- Sessao valida por 7 dias
- Tabela: `dashboard_usuarios` (coluna `senha_hash`, nao `password`)
- Paginas protegidas: redireciona para `/login` se nao autenticado
- Paginas admin-only: redireciona para `/dashboard` se nao for admin

### Navegacao (Navbar)
Links visiveis para admin:
- **Dashboard** — Visao geral
- **Treinamento & POPs** — Regras, POPs e Colaboradores (3 abas)
- **Chamados & Clientes** — Importacao de dados (2 abas)
- **System Prompt** — Editor do prompt base
- **Conversas** — Historico e erros
- **Admin** — Filiais

Sidebar lateral (hamburger menu) exibe o README/Sobre.

### Paginas

#### `/login` — Tela de Login
Formulario simples com email e senha. Apos login, redireciona para `/dashboard`.

#### `/dashboard` — Visao Geral
- Metricas globais: bots online, mensagens hoje, erros hoje
- Cards por filial mostrando status, ultima execucao, erros do dia
- Lista de execucoes recentes do N8N
- Auto-refresh a cada 30 segundos

#### `/treinamento` — Treinamento & POPs (admin)
Pagina com 3 abas e contadores:

**Aba Regras:**
- Lista de regras que o bot deve seguir em todas as respostas
- Adicionar, editar e excluir regras
- Contador de caracteres
- Info: colaboradores tambem podem ensinar via WhatsApp com `Claude aprenda: ...`

**Aba POPs:**
- Lista todos os POPs com titulo, categoria e data
- Criar novo POP (titulo, categoria, conteudo)
- Editar POP inline (expande o card)
- Arquivar POP (soft delete)
- Busca por titulo ou conteudo + filtro por categoria
- Categorias: Geral, Atendimento, Tecnico, Financeiro, Comercial, RH, Outro
- POPs com "LEIA SEMPRE" no titulo sao incluidos em todas as respostas do bot

**Aba Colaboradores:**
- Cadastro de membros da equipe: nome, cargo, funcoes
- Editar e remover colaboradores
- Avatar com inicial do nome

#### `/chamados` — Chamados & Clientes (admin)
Pagina com 2 abas e badges de quantidade:

**Aba Chamados:**
- Upload de planilha XLSX com chamados (drag-and-drop ou clique)
- Preview da planilha antes de enviar (10 primeiras linhas)
- Status: quantidade ativa, data de importacao, tempo restante (TTL 24h)
- Botao para limpar chamados e limpar historico de conversas Redis
- O bot usa os chamados para responder perguntas sobre SLA, agendamentos, etc.

**Aba Clientes:**
- Upload de planilha XLSX com clientes (colunas Cod e Nome)
- Preview antes de enviar
- Status: quantidade ativa, data de importacao
- Dados permanentes (sem TTL) — ficam ate serem removidos ou substituidos
- O bot busca clientes por nome quando mencionados na conversa

#### `/system-prompt` — Instrucoes Base (admin)
- Editor de texto completo para o system prompt do bot
- Placeholders: `{{DATA}}`, `{{ANO}}`, `{{TODAY}}`, `{{COLABORADORES}}`, `{{CLIENTES}}`, `{{POPS}}`, `{{HISTORICO}}`, `{{REGRAS}}`
- Botao de restaurar prompt padrao

#### `/conversas` — Historico de Interacoes (admin)
- Aba "Conversas": lista paginada (30/pagina) de todas as interacoes do bot
  - Cards expansiveis: remetente, data, mensagem, resposta, tokens, POPs usados
  - Busca por texto
- Aba "Erros": ultimos 100 erros do bot
  - Detalhes: no N8N, mensagem de erro, mensagem do usuario, chat_id, timestamp

#### `/admin` — Gerenciamento (admin)
- Lista de filiais com nome, workflow ID, instancia Evolution, chat_id
- Criar nova filial (com opcao de duplicar workflow)
- Configurar credenciais por filial
- Configuracao do grupo do Bom Dia (salva em `config:bom_dia_grupo` no Redis)

#### `/pops` e `/clientes` — Redirects
Redirecionam automaticamente para `/treinamento` e `/chamados` respectivamente.

### API Routes

| Rota | Metodo | Auth | Descricao |
|------|--------|------|-----------|
| `/api/auth/login` | POST | - | Login com email/senha, retorna cookie JWT |
| `/api/auth/logout` | POST | - | Remove cookie de autenticacao |
| `/api/auth/me` | GET | JWT | Retorna dados do usuario logado |
| `/api/status` | GET | JWT | Status de todas as filiais |
| `/api/executions` | GET | JWT | Execucoes recentes do N8N |
| `/api/pops` | GET/POST | Admin | Listar/criar POPs |
| `/api/pops/[id]` | PUT/DELETE | Admin | Editar/arquivar POP |
| `/api/pops-n8n` | GET | Token | Endpoint para o N8N buscar POPs |
| `/api/treinamento` | GET/POST | Admin | Listar/criar regras |
| `/api/treinamento/[id]` | PUT/DELETE | Admin | Editar/excluir regra |
| `/api/system-prompt` | GET/PUT | Admin | Ler/atualizar system prompt |
| `/api/colaboradores` | GET/POST | Admin | Listar/criar colaboradores |
| `/api/colaboradores/[id]` | PUT/DELETE | Admin | Editar/excluir colaborador |
| `/api/chamados` | GET/POST/DELETE | Admin | Status/importar/remover chamados |
| `/api/clientes` | GET/POST/DELETE | Admin | Status/importar/remover clientes |
| `/api/historico` | DELETE | Admin | Limpar historico de conversas Redis |
| `/api/config/bom-dia` | GET/PUT | Admin | Config do grupo do bom dia |
| `/api/filiais` | GET/POST | Admin | Listar/criar filiais |
| `/api/filiais/[id]` | PUT/DELETE | Admin | Editar/excluir filial |
| `/api/conversas` | GET/POST | GET=Admin, POST=aberto | Listar/salvar conversas |
| `/api/erros` | GET/POST/DELETE | GET/DELETE=Admin, POST=aberto | Listar/salvar/limpar erros |

---

## Variaveis de Ambiente (Dashboard)

```
PG_URL=postgresql://zazz:SENHA@localhost:5432/zazzdb
JWT_SECRET=SeuSecretJWT
N8N_URL=https://n8n.srv1537041.hstgr.cloud
N8N_API_KEY=chave-gerada-no-painel-n8n
N8N_POPS_TOKEN=MALUCO_POPS_2026
REDIS_URL=redis://:SENHA@localhost:6379
```

---

## Deploy

### Dashboard (manual via SSH)
```bash
ssh root@195.200.7.239
cd /opt/zazz/dashboard
git pull origin main
npm run build
pm2 restart dashboard --update-env
pm2 save
```

### Workflow N8N (manual)
1. Editar o arquivo `workflow_v2.json` na raiz do projeto
2. No painel do N8N, ir em "Import from file"
3. Selecionar o `workflow_v2.json` atualizado
4. Conferir se as credentials (PostgreSQL, Redis) estao vinculadas
5. Ativar o workflow

---

## Estrutura de Arquivos

```
/
├── workflow_v2.json                    # Workflow principal do N8N
├── deploy_workflow.json                # Copia de deploy
├── ALTERACOES_PROJETO.md               # Historico completo de mudancas
├── README.md                           # Este arquivo
│
├── dashboard/                          # Dashboard Next.js (repo separado)
│   ├── package.json                    # Next.js 14, React 18, Tailwind CSS
│   ├── tailwind.config.js
│   ├── next.config.js
│   │
│   ├── app/                            # App Router (Next.js 14)
│   │   ├── layout.js                   # Layout raiz
│   │   ├── page.js                     # Redirect para /dashboard
│   │   ├── globals.css                 # Estilos globais (Tailwind)
│   │   ├── login/page.jsx              # Tela de login
│   │   ├── dashboard/page.jsx          # Visao geral
│   │   ├── treinamento/page.jsx        # Regras + POPs + Colaboradores (3 abas)
│   │   ├── chamados/page.jsx           # Chamados + Clientes (2 abas)
│   │   ├── pops/page.jsx               # Redirect → /treinamento
│   │   ├── clientes/page.jsx           # Redirect → /chamados
│   │   ├── system-prompt/page.jsx      # Editor de system prompt
│   │   ├── conversas/page.jsx          # Historico de conversas + erros
│   │   ├── admin/page.jsx              # Gerenciar filiais + config bom dia
│   │   │
│   │   └── api/                        # API Routes
│   │       ├── auth/                   # Login, logout, me
│   │       ├── pops/                   # CRUD POPs
│   │       ├── pops-n8n/               # Endpoint para N8N
│   │       ├── treinamento/            # CRUD regras
│   │       ├── system-prompt/          # Ler/salvar system prompt
│   │       ├── colaboradores/          # CRUD colaboradores
│   │       ├── chamados/               # Importar/remover chamados
│   │       ├── clientes/               # Importar/remover clientes
│   │       ├── historico/              # Limpar historico Redis
│   │       ├── config/                 # Config bom dia
│   │       ├── filiais/                # CRUD filiais
│   │       ├── status/                 # Status dos bots
│   │       ├── executions/             # Execucoes N8N
│   │       ├── conversas/              # Historico de conversas
│   │       ├── erros/                  # Log de erros
│   │       ├── n8n/                    # Proxy para API do N8N
│   │       ├── setup/                  # Setup inicial do banco
│   │       ├── readme/                 # Conteudo do README para Sidebar
│   │       └── debug/                  # Debug/diagnostico
│   │
│   ├── components/                     # Componentes React
│   │   ├── Navbar.jsx                  # Navegacao (5 links admin)
│   │   ├── Sidebar.jsx                 # Painel lateral "Sobre" (README)
│   │   ├── StatusCard.jsx              # Card de status por filial
│   │   └── ExecutionList.jsx           # Lista de execucoes N8N
│   │
│   └── lib/                            # Bibliotecas compartilhadas
│       ├── db.js                       # Pool PostgreSQL (pg) — usa PG_URL
│       ├── auth.js                     # JWT sign/verify/getSession
│       └── n8n.js                      # Client API do N8N
│
├── hostinger/                          # Configs de referencia para o VPS
│   ├── docker-compose.yml
│   ├── .env.example
│   └── SETUP_HOSTINGER.md
```

---

## Comandos Uteis no Servidor

```bash
# Ver todos os containers
cd /docker/n8n && docker compose ps

# Reiniciar tudo
cd /docker/n8n && docker compose restart

# Ver logs do N8N
docker compose logs n8n -f --tail=50

# Ver logs da Evolution
docker compose logs evolution -f --tail=50

# Acessar banco
docker exec -it n8n-postgres-1 psql -U zazz -d zazzdb

# Acessar Redis
docker exec -it n8n-redis-1 redis-cli -a ZazzRedis2026!

# Status da dashboard
pm2 status

# Logs da dashboard
pm2 logs dashboard --lines 50

# Reiniciar dashboard com novas variaveis
pm2 restart dashboard --update-env && pm2 save
```

---

## Desenvolvimento por

**Franquelin Baldoria de Almeida**
- Instagram: [@Frank_almeida5](https://instagram.com/Frank_almeida5)
- WhatsApp: (43) 99166-3335
