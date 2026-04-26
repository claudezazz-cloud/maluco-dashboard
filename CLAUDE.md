# Maluco da IA — Claude Code Guide

## Projeto
Bot WhatsApp interno da Zazz Internet (fibra óptica, Lunardelli-PR).
- N8N workflow `DiInHUnddtFACSmj` (`workflow_v2.json`) — orquestra o bot
- Dashboard Next.js 14 (App Router) — painel admin

## Stack rápido
N8N · Claude Sonnet 4.6 · Whisper (áudio) · Evolution API v2 · PostgreSQL · Redis · Notion API · Next.js/React/Tailwind · JWT · PM2 no VPS

## Comandos essenciais
```bash
npm run dev          # dashboard local :3001
npm run build && pm2 restart maluco-dashboard --update-env  # deploy (no VPS)
docker exec -it n8n-postgres-1 psql -U zazz -d zazzdb
docker exec -it n8n-redis-1 redis-cli -a ZazzRedis2026!
```

## Deploy obrigatório

**Regra:** sempre que alterar qualquer arquivo do dashboard (`.jsx`, `.js`, `.css`, componentes, rotas API), fazer deploy no VPS ao final da tarefa:

```bash
ssh root@195.200.7.239 "cd /opt/zazz/dashboard && git pull origin main && npm run build && pm2 restart maluco-dashboard --update-env"
```

Não esperar o usuário pedir — deploy faz parte da entrega.

## Infra (Hostinger VPS 195.200.7.239)
- N8N: https://n8n.srv1537041.hstgr.cloud
- Evolution: https://evolution.srv1537041.hstgr.cloud
- Dashboard: https://dashboard.srv1537041.hstgr.cloud
- PM2 name: `maluco-dashboard`

## Editar workflow N8N
Scripts Python `fix_*.py` — padrão: GET workflow → editar nodes[] → PUT → deactivate → activate.
N8N avalia `{{ }}` nos campos — nunca coloque placeholders do sistema neles diretamente.
Após PUT sempre fazer deactivate+activate para invalidar cache de jsCode.

## Nodes críticos (executeOnce: true obrigatório)
Busca POPs, Busca System Prompt, Busca Colaboradores, Busca Histórico 10, Busca Histórico Redis, Busca Chamados Redis, Busca Clientes, Busca Regras.
**Busca Regras** também precisa `alwaysOutputData: true`.

## System Prompt placeholders
`{{DATA}}` `{{ANO}}` `{{TODAY}}` `{{COLABORADORES}}` `{{CLIENTES}}` `{{POPS}}` `{{HISTORICO}}` `{{REGRAS}}`
Deploy via `deploy_system_prompt.py` (cria wf temporário Webhook→Code→Postgres, executa, deleta).

## Banco PostgreSQL — tabelas principais
- `mensagens` — message_id UNIQUE, remetente, mensagem, chat_id
- `dashboard_pops` — titulo, categoria, conteudo, ativo
- `dashboard_config` — chave UNIQUE, valor (armazena system_prompt)
- `dashboard_colaboradores` — nome, cargo, funcoes, ativo
- `regras` — regra TEXT
- `bot_conversas` — log de interações com tokens
- `bot_erros` — erros do N8N

## Redis keys
- `conv:{chatId}` — histórico (20 msgs)
- `chamados:data` — chamados importados (TTL 24h)
- `config:bom_dia_grupo` — JID do grupo WhatsApp

## POPs — convenção de título
- Começa com `LEIA SEMPRE:` → incluído em TODAS as respostas
- Normal → incluído por relevância semântica (ts_rank)

## Dashboard — padrões de código
- Auth: `getSession()` + `requireAdmin()` de `lib/auth.js`
- DB: `query(sql, params)` de `lib/db.js` (sempre parametrizado)
- Tema: bg `#0f0f13`, cards `#1a1a24`, brand `#071DE3`

## WhatsApp — formatação
- Negrito: `*texto*` — NUNCA `**`
- Itálico: `_texto_`
- PROIBIDO: `##`, blocos de código markdown

## Idioma
UI, banco e variáveis em Português (BR). Código: mix PT/EN conforme existente.

## Notas do Obsidian (cerebro-evolutivo/)

**Regra obrigatória:** ao implementar qualquer alteração significativa no projeto (nova feature, correção de bug importante, mudança de arquitetura, novo padrão), criar ou atualizar o arquivo `.md` correspondente em `cerebro-evolutivo/`.

Essas notas são indexadas automaticamente e injetadas como contexto no bot — é a memória evolutiva do sistema.

Pastas/arquivos existentes:
- `workflow-n8n.md` — estrutura do workflow, nodes, padrões de edição, bugs conhecidos
- `dashboard-admin.md` — páginas, padrões de código, deploy, configurações
- `treinamento-evolutivo.md` — como funciona o sistema de notas Obsidian
- `metricas-notion.md` — feature de métricas de tarefas do Notion

Ao adicionar uma nota nova, fazer commit e push — o cron do VPS sincroniza automaticamente (a cada minuto).
