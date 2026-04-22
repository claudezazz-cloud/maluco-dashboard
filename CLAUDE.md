# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Maluco da IA** is an internal WhatsApp AI assistant for Zazz Internet, a fiber optic ISP in Lunardelli-PR, Brazil. The system has two main components:

1. **N8N Workflow** (`workflow_v2.json`) — Orchestrates the bot: receives WhatsApp messages, processes text/audio, queries databases, calls Claude API, sends responses, creates Notion tasks
2. **Next.js Dashboard** — Admin panel to manage POPs (Standard Operating Procedures), training rules, system prompt, employees, branches, ticket imports, conversation history, and error logs

## Stack

| Component | Technology |
|-----------|-----------|
| Bot orchestration | N8N (workflow_v2.json, 41 nodes) |
| AI model | Claude Sonnet 4.6 (`claude-sonnet-4-6`) via Anthropic API |
| Audio transcription | OpenAI Whisper API |
| WhatsApp | Evolution API v2 |
| Database | PostgreSQL |
| Cache/history | Redis (ioredis) |
| Task management | Notion API |
| Dashboard | Next.js 14 (App Router) + React 18 + Tailwind CSS |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| Deploy | Hostinger VPS (Docker Compose) or PM2 |

## Development Commands

```bash
npm run dev          # Start dashboard locally on port 3001
npm run build        # Build Next.js for production
npm run start        # Start production server
```

### Deploy (Hostinger VPS)
```bash
ssh root@195.200.7.239
cd /opt/zazz/dashboard
git pull origin main
npm run build
pm2 restart dashboard --update-env
```

### Database Access
```bash
docker exec -it n8n-postgres-1 psql -U zazz -d zazzdb
```

### Redis Access
```bash
docker exec -it n8n-redis-1 redis-cli -a ZazzRedis2026!
```

## Architecture

### Dashboard (Next.js 14 App Router)

```
app/
├── page.js                    # Root redirect (→ /dashboard or /login)
├── layout.js                  # Root layout with footer
├── globals.css                # Tailwind base + dark theme (#0f0f13)
├── login/page.jsx             # Login form (email + password)
├── dashboard/page.jsx         # Overview: metrics, filial cards, executions
├── pops/page.jsx              # CRUD POPs (procedures)
├── treinamento/page.jsx       # Training rules + employees management
├── system-prompt/page.jsx     # System prompt editor with placeholders
├── conversas/page.jsx         # Conversation history + error log
├── chamados/page.jsx          # XLSX ticket import → Redis
├── admin/
│   ├── page.jsx               # Branch management
│   └── filiais/
│       ├── page.jsx           # New branch wizard (4 steps)
│       └── [id]/page.jsx      # Branch detail + config editing
└── api/
    ├── auth/                  # login, logout, me
    ├── pops/                  # CRUD + [id] route
    ├── pops-n8n/              # Endpoint for N8N (token auth via x-token header)
    ├── treinamento/           # CRUD rules + [id] route
    ├── system-prompt/         # GET/PUT system prompt
    ├── colaboradores/         # CRUD employees + [id] route
    ├── filiais/               # CRUD branches + [id] + test-connection, setup-db, duplicate-workflow
    ├── chamados/              # Import/status/clear tickets (Redis)
    ├── historico/             # Status/clear conversation history (Redis)
    ├── conversas/             # List conversations (Postgres) + POST from N8N
    ├── erros/                 # List/save/clear errors
    ├── status/                # Bot status per branch
    ├── executions/            # N8N execution history
    ├── n8n/workflows/         # Proxy to N8N API
    ├── setup/                 # Initial DB setup + admin user creation
    └── debug/                 # DB diagnostics

lib/
├── db.js                      # PostgreSQL pool (pg), uses PG_URL env var
├── redis.js                   # Redis singleton (ioredis), uses REDIS_URL env var
├── auth.js                    # JWT sign/verify/getSession, cookie: auth_token
└── n8n.js                     # N8N API client (getWorkflow, getExecutions, duplicateWorkflow)

components/
├── Navbar.jsx                 # Navigation bar with admin-only links
├── StatusCard.jsx             # Branch status card (online/offline, metrics)
└── ExecutionList.jsx          # N8N execution table
```

### N8N Workflow (workflow_v2.json)

**Main flow (text messages):**
```
Webhook → Filter1 → Extrai Dados Mensagem → Salva no Postgres
                   → Verifica Menção → É Treinamento? → Salva Regra → Confirma
                                     → Busca Regras → É Relatório? → (report flow)
                                                                    → Busca Histórico 10
                   → Busca POPs → Busca System Prompt → Busca Colaboradores
                   → Busca Histórico Redis → Busca Chamados Redis → Busca Clientes
                   → Monta Prompt → Claude API → Parse Resposta
                   → Envia WhatsApp / Salva Histórico Redis / Salva Conversa / Tem Notion? / É Erro?
```

**Audio flow:**
```
Filter1 → Detecta Áudio → Baixa Áudio → Converte p/ Whisper → Transcreve Áudio
        → Formata Transcrição → Salva Transcrição → Verifica Menção Áudio → (joins main flow at Busca POPs)
```

**Bom Dia flow (scheduled: Mon-Sat 7:30 AM):**
```
Bom Dia Trigger → Busca Chamados Bom Dia (Redis) → Gera Bom Dia (Claude) → Extrai Mensagem → Busca Config Grupo (Redis) → Envia Bom Dia
```

## Database Schema

### PostgreSQL Tables
- `mensagens` — All WhatsApp group messages (message_id UNIQUE, remetente, mensagem, chat_id, data_hora)
- `dashboard_pops` — Standard Operating Procedures (titulo, categoria, conteudo, ativo)
- `regras` — AI behavior rules (regra TEXT)
- `dashboard_config` — Key-value config (chave UNIQUE, valor) — stores system_prompt
- `dashboard_colaboradores` — Team members (nome, cargo, funcoes, ativo)
- `dashboard_filiais` — Branches (nome, n8n_workflow_id, evolution_instance, group_chat_id, ativo)
- `dashboard_filiais_config` — Per-branch config (filial_id FK, chave, valor)
- `dashboard_usuarios` — Dashboard users (email, senha_hash, nome, role, ativo)
- `bot_conversas` — Bot interaction log (chat_id, remetente, mensagem, resposta, pops_usados, tokens_input, tokens_output)
- `bot_erros` — Error log (no_n8n, mensagem_erro, mensagem_usuario, chat_id)
- `dashboard_clientes` — Client database (cod, nome, ativo)

### Redis Keys
- `conv:{chatId}` — Conversation history (JSON array of role/content, last 20 messages)
- `chamados:data` — Imported tickets (JSON with ai_context, TTL 24h)
- `config:bom_dia_grupo` — WhatsApp group ID for morning message

## Important Conventions

### POP Naming Convention
- Title starts with **"LEIA SEMPRE:"** → Included in ALL responses (mandatory)
- Normal title → Included only when semantically relevant (ts_rank search)
- Category: "Cliente"/"Banco"/"Base"/"CRM" → Used for client search

### System Prompt Placeholders
`{{DATA}}`, `{{ANO}}`, `{{TODAY}}`, `{{COLABORADORES}}`, `{{CLIENTES}}`, `{{POPS}}`, `{{HISTORICO}}`, `{{REGRAS}}`

### WhatsApp Formatting Rules
- Bold: `*text*` (single asterisk) — NEVER `**text**`
- Italic: `_text_`
- FORBIDDEN: `**`, `##`, `###`, code blocks
- Steps: use `1. 2. 3.`

### Auth Pattern
- All admin pages check `fetch('/api/auth/me')` → redirect to `/login` if 401
- Admin-only pages also check `d.role !== 'admin'` → redirect to `/dashboard`
- API routes use `getSession()` + `requireAdmin(session)` from `lib/auth.js`

### N8N Workflow Node Settings
These nodes MUST have `executeOnce: true`:
- Busca POPs, Busca System Prompt, Busca Colaboradores, Busca Histórico 10
- Busca Histórico Redis, Busca Chamados Redis, Busca Clientes, Busca Regras

**Busca Regras** also needs `alwaysOutputData: true` (prevents flow from stopping when table is empty).

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PG_URL` | PostgreSQL connection string |
| `JWT_SECRET` | JWT signing secret |
| `N8N_URL` | N8N instance URL |
| `N8N_API_KEY` | N8N API key |
| `N8N_POPS_TOKEN` | Token for /api/pops-n8n endpoint (default: MALUCO_POPS_2026) |
| `REDIS_URL` | Redis connection string |

## Infrastructure

### Current (Hostinger VPS KVM 2)
- **IP**: 195.200.7.239
- **N8N**: https://n8n.srv1537041.hstgr.cloud (port 5678)
- **Evolution API**: https://evolution.srv1537041.hstgr.cloud (port 8080)
- **Dashboard**: https://dashboard.srv1537041.hstgr.cloud (port 3001)
- **PostgreSQL**: localhost:5432 (Docker)
- **Redis**: localhost:6379 (Docker)
- **Docker Compose**: /docker/n8n/docker-compose.yml
- **Dashboard (PM2)**: /opt/zazz/dashboard/

## Design Patterns

### UI Theme
- Background: `#0f0f13` (dark)
- Cards: `#1a1a24` with `border-gray-800`
- Brand color: `#071DE3` (buttons, active states)
- Brand hover: `#0516B0`
- All pages use dark theme, monospace font for code/IDs

### API Route Pattern
All API routes follow this structure:
1. Check auth with `getSession()` / `requireAdmin(session)`
2. Call `ensureTable()` to auto-create table if missing
3. Use parameterized queries with `query(sql, params)` from `lib/db.js`
4. Return `NextResponse.json()`

### Workflow Editing
The workflow is in `workflow_v2.json`. After editing:
1. Import in N8N panel via "Import from file"
2. Verify credentials (PostgreSQL, Redis) are linked
3. Activate the workflow

**IMPORTANT**: Never remove `executeOnce` or `alwaysOutputData` settings from nodes listed above.

## Language

The project UI, documentation, database columns, and variable names are in **Portuguese (Brazilian)**. Code comments and logic are a mix of Portuguese and English. Always maintain consistency with existing naming.
