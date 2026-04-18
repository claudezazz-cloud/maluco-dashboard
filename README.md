# Maluco da IA

**Assistente de IA interno para equipes da Zazz Internet** — provedor de fibra optica em Lunardelli-PR.

---

## Objetivo do Projeto

O Maluco da IA e um bot de WhatsApp com inteligencia artificial que funciona como assistente interno da empresa Zazz Internet. Ele atende os colaboradores diretamente no grupo de WhatsApp da equipe, respondendo duvidas sobre procedimentos da empresa (POPs), criando tarefas no Notion, gerando relatorios e aprendendo novas regras de comportamento em tempo real.

O projeto surgiu da necessidade de centralizar o conhecimento operacional da empresa em um unico lugar acessivel a todos os colaboradores, sem precisar procurar em documentos espalhados ou perguntar para o gestor. O bot consulta automaticamente os procedimentos cadastrados, mantem contexto de conversa e entende tanto mensagens de texto quanto audio.

Alem do bot, existe uma dashboard web completa para o administrador gerenciar tudo: POPs, regras de comportamento, system prompt, colaboradores, filiais, historico de conversas e log de erros.

---

## O que o bot faz hoje

### Atendimento no WhatsApp
- Responde mensagens de texto quando mencionado no grupo (ex: "@Claude como faco uma nova venda?")
- Recebe e transcreve mensagens de audio usando **Groq Whisper-large-v3** (substituto do OpenAI Whisper — mais rapido e free tier)
- **Reconhecimento de imagens com Claude Vision** — toda imagem enviada no grupo e automaticamente analisada pelo Claude Haiku 4.5. A descricao substitui o placeholder `[imagem]` no banco, permitindo que relatorios incluam contexto visual. Quando a legenda menciona o bot, ele responde analisando a foto diretamente (Vision nativo no prompt principal)
- **Multi-imagem em uma unica resposta** — a dashboard permite enviar ate 10 imagens numa mesma mensagem. O Claude Vision analisa o conjunto (SEQUENCIA das imagens) e devolve uma unica resposta. Ideal para analisar prints de conversas do WhatsApp e receber sugestoes de melhoria
- Busca semantica de POPs com sistema de prioridade (`sempre` / `importante` / `relevante`) — POPs "sempre" sao injetados em toda resposta, "importante" sempre enviam conteudo completo, "relevante" sao filtrados por score de palavras-chave (top 5 mais proximos da mensagem)
- Mantem historico de conversa com Redis — o bot lembra das ultimas mensagens trocadas para manter contexto entre perguntas
- Cria tarefas automaticamente no Notion quando o colaborador pede (ex: "Claude agenda uma instalacao para o cliente Joao amanha")
- Aprende novas regras em tempo real via WhatsApp (ex: "Claude aprenda: sempre pergunte o telefone do cliente")
- Gera relatorios completos com base no historico de mensagens do grupo — inclui todas as mensagens, estatisticas de solicitacoes/resolucoes, destaques e pendencias
- Detecta automaticamente solicitacoes e resolucoes no chat, classificando mensagens como `solicitacao` ou `resolucao` na coluna `tipo_atendimento`
- Importacao de chamados via planilha XLSX na dashboard — dados ficam disponiveis para o bot por 24h no Redis
- Importacao de clientes via planilha XLSX na dashboard
- Limpeza de historico de conversas do Redis via dashboard

### Skills (Comandos com /)
O bot suporta comandos de skill iniciados com `/`, cadastrados na dashboard:
- `/menu` — lista todas as skills ativas com nome, descricao e exemplo de uso (responde direto sem chamar Claude)
- `/relatorio` — gera relatorio de atendimentos do dia
- Skills customizadas podem ser criadas pela dashboard com: nome do comando, descricao, prompt de contexto e exemplo de uso
- Skills sao detectadas automaticamente pelo no "Verifica Mencao" via regex `/(?:^|\s)(\/\S+)/`, funcionando tanto em privado quanto em grupos com mencao ao bot
- O contexto da skill e injetado no prompt do Claude, mantendo todas as outras funcoes ativas (POPs, historico, chamados)

### Solicitacoes Programadas (Agendamento)
Execucoes automaticas de comandos em horarios definidos, gerenciadas pela dashboard:
- Substitui os antigos triggers dedicados (Bom Dia, Pendentes) por um sistema unico e flexivel
- Configuravel por horario (ex: 07:30, 17:00), dias da semana (seg-sab, todos, etc.) e chat de destino
- O N8N verifica a cada minuto se ha tarefas pendentes e injeta uma mensagem sintetica no webhook, passando pelo fluxo normal do bot
- Protecao contra duplicatas: tarefas ja executadas nao disparam novamente (intervalo minimo de 50 minutos)
- Botao "Executar Agora" na dashboard para testar qualquer agendamento manualmente sem esperar o horario
- Exemplos de uso: bom dia com resumo de chamados (07:30), relatorio de atendimentos (17:00)

### Tratamento de erros
- Quando a API do Claude retorna erro, o bot responde com uma mensagem amigavel em vez de travar
- **Error Trigger global** — qualquer no do workflow que falhe (Whisper, Claude, Evolution, Postgres, etc.) dispara um no `Erro Global (Trigger)` que grava automaticamente em `bot_erros` com o nome do no que falhou e a mensagem tecnica. A configuracao `errorWorkflow` aponta o workflow para ele mesmo, ativando o handler
- Todos os erros sao salvos no banco com detalhes: nome do no que falhou, mensagem de erro, mensagem do usuario que causou o erro, chat_id e timestamp
- Os erros podem ser consultados na dashboard (`/conversas` aba Erros) e aparecem no contador "ERROS HOJE" da visao geral

### Registro de conversas
- Toda interacao (pergunta do colaborador + resposta do bot) e salva no PostgreSQL
- Inclui metadados: remetente, tokens consumidos (input e output), POPs utilizados na resposta, chat_id
- Historico consultavel na dashboard com busca e paginacao

---

## Stack Tecnologica

| Componente | Tecnologia | Detalhes |
|-----------|-----------|----------|
| Automacao | **N8N** (self-hosted) | Orquestra todo o fluxo do bot + agendamento de solicitacoes |
| WhatsApp | **Evolution API v2** | Hospedada no VPS Hostinger |
| Inteligencia Artificial | **Claude Haiku 4.5** (Anthropic) | Modelo `claude-haiku-4-5-20251001`, chamado via API REST. Suporta Vision nativo (texto + imagens) |
| Transcricao de audio | **Groq Whisper-large-v3** | API `api.groq.com/openai/v1/audio/transcriptions`, compativel com formato OpenAI, free tier generoso |
| Banco de dados | **PostgreSQL** | Docker no VPS, armazena mensagens, POPs, regras, conversas, erros, config |
| Cache e historico | **Redis** | Docker no VPS, armazena historico de conversa, chamados importados e configuracoes |
| Tarefas | **Notion API** | Cria paginas automaticamente quando o colaborador solicita uma tarefa ou quando ha pendentes ao fim do dia |
| Dashboard | **Next.js 14** + Tailwind CSS + Lucide React | App Router, React 18, tema dark customizado |
| Deploy dashboard | **PM2** no VPS Hostinger | Build Next.js, processo gerenciado pelo PM2 |
| Repositorio | **GitHub** | `claudezazz-cloud/maluco-dashboard` |

---

## Infraestrutura (Hostinger VPS KVM 2)

| Servico | URL / Endereco | Observacao |
|---------|---------------|-----------|
| Dashboard | `https://dashboard.srv1537041.hstgr.cloud` | PM2, porta 3001 |
| N8N | `https://n8n.srv1537041.hstgr.cloud` | Docker, porta 5678 |
| Evolution API | `https://evolution.srv1537041.hstgr.cloud` | Docker, porta 8080 |
| PostgreSQL | `localhost:5432` (Docker) | Usuario: zazz, banco: zazzdb |
| Redis | `localhost:6379` (Docker) | Auth: ZazzRedis2026! |
| IP do servidor | `195.200.7.239` | SSH: root@195.200.7.239 |

### Caminhos no servidor
- **Docker Compose**: `/docker/n8n/docker-compose.yml`
- **Dashboard (PM2)**: `/opt/zazz/dashboard/`

---

## Banco de Dados — Tabelas PostgreSQL

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
| `tipo_atendimento` | VARCHAR(20) | `solicitacao`, `resolucao` ou NULL |

### `dashboard_pops`
Procedimentos Operacionais Padrao da empresa, consultados pelo bot via busca semantica com prioridade.
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| `id` | SERIAL PK | ID auto-incremento |
| `titulo` | VARCHAR(255) | Nome do procedimento |
| `categoria` | VARCHAR(255) | Categoria (Geral, Atendimento, Tecnico, Financeiro, Comercial, RH, Outro) |
| `conteudo` | TEXT | Conteudo completo do POP |
| `prioridade` | VARCHAR(20) | `sempre` (enviado em toda resposta), `importante` (sempre enviado com conteudo completo), `relevante` (top 5 por palavras-chave) |
| `ativo` | BOOLEAN | Se o POP esta ativo (soft delete) |
| `criado_em` | TIMESTAMP | Data de criacao |
| `atualizado_em` | TIMESTAMP | Ultima atualizacao |

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
| `mensagem` | TEXT | Pergunta do colaborador |
| `resposta` | TEXT | Resposta do bot |
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

### `dashboard_clientes`
Base de clientes importada via XLSX.
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| `cod` | VARCHAR PK | Codigo do cliente |
| `nome` | VARCHAR | Nome do cliente |
| `ativo` | BOOLEAN | Se esta ativo |

### `dashboard_usuarios`
Usuarios da dashboard (admin + colaboradores).
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| `id` | SERIAL PK | ID auto-incremento |
| `nome` | VARCHAR | Nome do usuario |
| `email` | VARCHAR UNIQUE | Email para login |
| `senha_hash` | VARCHAR | Hash bcrypt da senha |
| `role` | VARCHAR | `admin` (acesso total) ou `colaborador` (Dashboard + Chamados/Clientes, leitura) |
| `ativo` | BOOLEAN | Se o usuario esta ativo |
| `criado_em` | TIMESTAMP | Data de criacao |

### `dashboard_skills`
Skills (comandos com /) disponiveis para o bot.
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| `id` | SERIAL PK | ID auto-incremento |
| `nome` | VARCHAR(50) | Nome do comando (ex: `/relatorio`) |
| `descricao` | VARCHAR(255) | Descricao curta da skill |
| `prompt_contexto` | TEXT | Contexto injetado no prompt do Claude quando a skill e acionada |
| `exemplo_uso` | VARCHAR(255) | Exemplo de como usar (ex: `/relatorio chamados`) |
| `ativo` | BOOLEAN | Se esta ativa |
| `criado_em` | TIMESTAMP | Data de criacao |

### `dashboard_solicitacoes_programadas`
Agendamento de execucoes automaticas de comandos.
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| `id` | SERIAL PK | ID auto-incremento |
| `nome` | VARCHAR(100) | Nome descritivo (ex: "Bom Dia") |
| `comando` | TEXT | Comando a executar (ex: "gere a mensagem de bom dia") |
| `chat_id` | VARCHAR(100) | ID do grupo/chat de destino |
| `hora` | VARCHAR(5) | Horario de execucao (ex: "07:30") |
| `dias_semana` | VARCHAR(50) | Dias da semana (ex: "seg,ter,qua,qui,sex" ou "todos") |
| `ativo` | BOOLEAN | Se esta ativo |
| `ultimo_executado` | TIMESTAMP | Ultima execucao (protecao contra duplicatas) |
| `criado_em` | TIMESTAMP | Data de criacao |

### Redis
| Chave | Descricao | TTL |
|-------|-----------|-----|
| `conv:{chatId}` | Historico de conversa (JSON array role/content, ultimas 20 msgs) | Sem TTL |
| `chamados:data` | Chamados importados via XLSX (JSON com ai_context) | 24h |
| `clientes:data` | Clientes importados via XLSX | 24h |
| `config:bom_dia_grupo` | ID do grupo WhatsApp para mensagem de bom dia | Sem TTL |

---

## Arquitetura do Workflow N8N

### Fluxo principal (mensagem de texto)
```
Webhook (WhatsApp via Evolution API)
  |
  v
Extrai Dados Mensagem (Code)
  - Extrai: messageId, remetente, mensagem, chatId, isFromMe
  - Detecta tipo de midia: imagem, video, audio, figurinha, contato, localizacao, documento, reacao
  - Captura contexto de mensagem citada (quoted message)
  - Detecta tipo_atendimento: solicitacao / resolucao / NULL
  |
  v
Salva no Postgres (inclui tipo_atendimento)
  |
  +---> Filter1 (filtra mensagens do proprio bot)
  |
  +---> Detecta Audio ---> [Fluxo de Audio]
  |
  v
Verifica Mencao
  - Verifica se o bot foi mencionado (@Claude, @Maluco, etc)
  - Detecta skills (comandos com /): isSkillCommand, skillName, skillArgs
  |
  +---> E Treinamento? ---> Salva Regra ---> Confirma Aprendizado
  |
  +---> E Relatorio? ---> Busca Historico Postgres (AT TIME ZONE 'America/Sao_Paulo')
  |                        ---> Monta Prompt Relatorio (max_tokens: 8192, historico: 60KB)
  |                        ---> Claude API ---> Envia Relatorio WhatsApp
  |
  +---> E Menu? ---> Busca Skills Menu (Postgres) ---> Formata Menu (Code)
  |                  ---> Envia Menu (WhatsApp) [responde direto, sem chamar Claude]
  |
  v
Busca POPs / Busca System Prompt / Busca Colaboradores / Busca Regras
  |
  v
Busca Historico Redis / Busca Chamados Redis / Busca Clientes
  |
  v
Monta Prompt (inclui contexto de skill se aplicavel) ---> Claude API ---> Parse Resposta
  |
  +--> Envia WhatsApp
  +--> Salva Historico Redis
  +--> Salva Conversa (Postgres)
  +--> E Erro? ---> Salva Erro (Postgres)
  +--> Tem Notion? ---> Cria no Notion
```

### Fluxo de Audio
```
Detecta Audio --> Audio Preloaded? (IF)
  |                   |
  |  false            |  true (dashboard: base64 ja veio no payload)
  v                   |
Baixa Audio           |
  |                   |
  v                   v
Converte p/ Whisper --> Transcreve Audio (Groq whisper-large-v3)
  --> Formata Transcricao --> Salva Transcricao --> Verifica Mencao Audio
  --> [continua no fluxo principal a partir de Busca POPs]
```
O IF `Audio Preloaded?` permite que a dashboard (gravacao via MediaRecorder) envie o base64 direto, pulando a etapa de `Baixa Audio` (que busca no Evolution). WhatsApp continua usando o caminho normal (Baixa Audio -> Evolution API).

### Fluxo de Imagem (Claude Vision) — Single ou Multi-imagem
```
Detecta Imagem --> Imagem Preloaded? (IF)
  |                   |
  |  false            |  true (dashboard: base64 ja veio no payload, ate 10 imagens)
  v                   |
Baixa Imagem          |
  |                   |
  v                   v
Prepara Body Imagem (Code: monta JSON com TODAS as imagens no content array)
  |
  v
Descreve Imagem (HTTP Request -> Anthropic API, Haiku 4.5)
  - 1 imagem: max 300 tokens, prompt "Descreva em 1-3 frases CURTAS..."
  - 2-10 imagens: max 600 tokens, prompt "Analise o conjunto considerando a SEQUENCIA..."
  |
  v
Formata Imagem (Code: monta dbMensagem, carrega allImages[] adiante)
  |
  +--> Salva Imagem (Postgres: INSERT ON CONFLICT DO UPDATE — sobrescreve "[imagem]")
  |
  +--> Verifica Mencao Imagem (IF: isMentioned?)
         |
         true --> E Treinamento? --> [fluxo principal com TODAS as imagens no content array]
```
- **1 webhook = 1 resposta**: mesmo com 10 imagens, o bot faz apenas 1 chamada ao Claude Vision e devolve 1 resposta analisando o conjunto completo.
- **Custo estimado**: ~US$ 0,0015 por imagem individual (Haiku 4.5 Vision). 100 imgs/dia ≈ US$ 4/mês.
- **Caso de uso**: analisar prints de conversas do WhatsApp e receber sugestoes de melhoria em uma unica resposta.

### Error Trigger Global
```
[Qualquer no falha] --> Erro Global (Trigger)
                         --> Salva Erro Global (Postgres: bot_erros)
```
- Node type: `n8n-nodes-base.errorTrigger` — dispara quando qualquer execucao do workflow termina com erro
- Settings: `errorWorkflow = <proprio-id>` + `saveDataErrorExecution = 'all'` (aponta o error workflow pra ele mesmo)
- Insere em `bot_erros`: `no_n8n = $json.execution.lastNodeExecuted`, `mensagem_erro = $json.execution.error.message` (ate 2000 chars)
- A dashboard le essa tabela via `/api/erros` e mostra em `/conversas` (aba Erros) + contador "ERROS HOJE" em `/dashboard`

### Fluxo de Agendamento (Solicitacoes Programadas)
```
Agendamento Trigger (a cada minuto)
  --> Busca Solicitacoes Due (HTTP GET /api/solicitacoes/n8n)
  --> Tem Tarefas? (IF: tasks.length > 0)
       |
       true --> Extrai Tarefas (Code: split array em items individuais)
            --> Prepara Body (Code: monta mensagem sintetica com mentionedJid do bot)
            --> Injeta no Bot (HTTP POST no webhook — dispara o fluxo principal)
            --> Marca Executado (HTTP POST /api/solicitacoes/n8n?id=X)
```
A mensagem sintetica inclui: `event: messages.upsert`, `fromMe: false`, `mentionedJid` do bot e `messageTimestamp` atual — passando por Filter1 e Verifica Mencao normalmente.

O botao "Executar Agora" da dashboard faz exatamente a mesma injecao sintetica (via `/api/solicitacoes/executar`), permitindo testar qualquer comando sem esperar o horario agendado.

---

## Dashboard Web

**URL**: `https://dashboard.srv1537041.hstgr.cloud`

### Paginas

| Pagina | Descricao | Acesso |
|--------|-----------|--------|
| `/login` | Login com email + senha | Publico |
| `/dashboard` | Visao geral: metricas (mensagens/erros/online), cards por filial, execucoes recentes do N8N | Admin + Colaborador |
| `/chamados` | Abas: importar chamados XLSX + importar clientes XLSX (colaborador ve sem botoes de upload/limpeza) | Admin + Colaborador |
| `/chat` | Chat direto com o bot: envio de texto, ate 10 imagens, audio gravado (MediaRecorder/webm-opus) e skills via dropdown. Polling de respostas a cada 2s, historico por usuario | Admin + Colaborador |
| `/treinamento` | 5 abas: Regras, POPs (com prioridade), Colaboradores, Skills, Solicitacoes Programadas | Admin |
| `/system-prompt` | Editor do system prompt com placeholders | Admin |
| `/conversas` | Historico de interacoes + log de erros | Admin |
| `/admin` | 2 abas: Filiais + Usuarios (criar colaboradores, redefinir senhas) | Admin |

### API Routes principais

| Rota | Metodo | Auth | Descricao |
|------|--------|------|-----------|
| `/api/auth/login` | POST | - | Login, retorna cookie JWT |
| `/api/auth/me` | GET | JWT | Dados do usuario logado |
| `/api/pops` | GET/POST | Admin | Listar/criar POPs |
| `/api/pops-n8n` | GET | Token | Endpoint para o N8N buscar POPs |
| `/api/treinamento` | GET/POST | Admin | Listar/criar regras |
| `/api/system-prompt` | GET/PUT | Admin | Ler/atualizar system prompt |
| `/api/colaboradores` | GET/POST | Admin | Listar/criar colaboradores |
| `/api/filiais` | GET/POST | Admin | Listar/criar filiais |
| `/api/conversas` | GET/POST | GET=Admin, POST=aberto | Listar conversas / N8N salva conversa |
| `/api/erros` | GET/POST/DELETE | GET/DELETE=Admin, POST=aberto | Listar/salvar/limpar erros |
| `/api/chamados` | GET/POST/DELETE | Admin | Importar/status/limpar chamados (Redis) |
| `/api/clientes` | GET/POST/DELETE | Admin | Importar/status/limpar clientes (Redis) |
| `/api/historico` | GET/DELETE | Admin | Status/limpar historico Redis |
| `/api/chat/send` | POST | JWT | Envia texto, ate 10 imagens ou audio gravado (`tipo: text/image/audio`) para o bot via webhook N8N |
| `/api/skills/ativas` | GET | JWT | Lista skills ativas (usado pelo dropdown no chat) — endpoint nao-admin |
| `/api/chat/messages` | GET/DELETE | JWT | Lista/limpa historico do chat do usuario logado |
| `/api/skills` | GET/POST | Admin | Listar/criar skills |
| `/api/skills/[id]` | PUT/DELETE | Admin | Atualizar/excluir skill |
| `/api/skills/n8n` | GET | Token | Endpoint para N8N buscar skills ativas |
| `/api/solicitacoes` | GET/POST | Admin | Listar/criar solicitacoes programadas |
| `/api/solicitacoes/[id]` | PUT/DELETE | Admin | Atualizar/excluir solicitacao |
| `/api/solicitacoes/executar` | POST | Admin | Executar uma solicitacao agora (injeta mensagem sintetica no webhook) |
| `/api/solicitacoes/n8n` | GET/POST | Token | N8N busca tarefas due / marca como executada |
| `/api/usuarios` | GET/POST | Admin | Listar/criar usuarios da dashboard |
| `/api/usuarios/[id]` | PUT/DELETE | Admin + self-edit | Atualizar/desativar (colaborador pode editar proprio nome/senha) |
| `/api/status` | GET | JWT | Status de todas as filiais (mensagens/erros hoje, online, ultima execucao) |
| `/api/executions` | GET | JWT | Execucoes recentes do N8N |

---

## Variaveis de Ambiente (Dashboard)

| Variavel | Descricao |
|----------|-----------|
| `PG_URL` | Connection string do PostgreSQL |
| `JWT_SECRET` | Secret para assinar tokens JWT |
| `N8N_URL` | URL do N8N (ex: `https://n8n.srv1537041.hstgr.cloud`) |
| `N8N_API_KEY` | Chave de API do N8N |
| `N8N_POPS_TOKEN` | Token para o endpoint `/api/pops-n8n` (default: `MALUCO_POPS_2026`) |
| `REDIS_URL` | Connection string do Redis |

---

## Deploy

### Dashboard (automatizado)
```bash
bash deploy.sh           # Executa: git pull, npm install, build, pm2 restart
```

### Dashboard (manual)
```bash
ssh root@195.200.7.239
cd /opt/zazz/dashboard
git pull origin main
npm install
npm run build
pm2 restart maluco-dashboard --update-env
```

### Workflow N8N (manual)
1. Editar `workflow_v2.json`
2. No N8N: **Import from file** → selecionar o arquivo
3. Configurar credentials: PostgreSQL e Redis
4. **Importante**: nos campos `x-api-key` dos nos HTTP que chamam a Anthropic, configurar via **Authentication > Generic Credential Type > Header Auth** (nao colocar a chave direto no campo, pois o GitHub bloqueia o push por seguranca)
5. Executar o no **SETUP** uma vez para criar a coluna `tipo_atendimento`
6. Ativar o workflow

### Nodes com configuracoes obrigatorias
Estes nos precisam de `executeOnce: true`:
- Busca POPs, Busca System Prompt, Busca Colaboradores, Busca Historico 10
- Busca Historico Redis, Busca Chamados Redis, Busca Clientes, Busca Regras

**Busca Regras** tambem precisa de `alwaysOutputData: true`.

---

## Estrutura de Arquivos

```
/
├── workflow_v2.json          # Workflow principal do N8N (~50 nos)
├── deploy.sh                 # Script de deploy automatizado (SSH + build + PM2)
├── deploy.bat                # Wrapper Windows para deploy.sh
├── deploy_workflow.json      # Config de deploy do workflow
├── DEPLOY.md                 # Guia de deploy N8N (API) + Dashboard + Docker
├── README.md                 # Este arquivo
├── CLAUDE.md                 # Instrucoes para Claude Code
├── COMO_FUNCIONA_CHAMADOS.md # Documentacao do fluxo XLSX -> Redis -> Bot
├── GUIA_DE_ESTUDO.md         # Guia de estudo do projeto
├── hostinger/                # Docker Compose, Nginx, .env.example do VPS
│
└── dashboard/                # Dashboard web (Next.js 14)
    ├── app/
    │   ├── dashboard/        # Visao geral
    │   ├── chat/             # Chat direto com o bot (texto + imagem)
    │   ├── treinamento/      # 5 abas: Regras, POPs, Colaboradores, Skills, Solicitacoes
    │   ├── system-prompt/    # Editor system prompt
    │   ├── conversas/        # Historico + erros
    │   ├── chamados/         # Importar chamados + clientes (abas)
    │   ├── admin/            # Filiais + usuarios
    │   └── api/
    │       ├── auth/         # Login, logout, me
    │       ├── chat/         # send (POST webhook) + messages (GET/DELETE historico)
    │       ├── pops/         # CRUD POPs
    │       ├── pops-n8n/     # POPs para N8N (token auth)
    │       ├── treinamento/  # CRUD regras
    │       ├── skills/       # CRUD skills + endpoint N8N
    │       ├── solicitacoes/ # CRUD solicitacoes programadas + endpoint N8N
    │       ├── colaboradores/# CRUD colaboradores
    │       ├── conversas/    # Historico de conversas
    │       ├── erros/        # Log de erros
    │       ├── chamados/     # Importar chamados (Redis)
    │       └── ...           # filiais, status, executions, etc.
    ├── components/
    │   ├── Navbar.jsx        # Navegacao com icones Lucide React
    │   ├── Sidebar.jsx       # Sidebar lateral (sobre o projeto)
    │   ├── StatusCard.jsx    # Card de status por filial
    │   └── ExecutionList.jsx # Lista de execucoes N8N
    └── lib/
        ├── db.js             # Pool PostgreSQL
        ├── redis.js          # Singleton Redis
        ├── auth.js           # JWT
        └── n8n.js            # Client API N8N
```

---

## Desenvolvido por

**Franquelin Baldoria de Almeida**
- Instagram: [@Frank_almeida5](https://instagram.com/Frank_almeida5)
- WhatsApp: (43) 99166-3335
