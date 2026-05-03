# Maluco da IA — Claude Code Guide

## Projeto
Bot WhatsApp interno da Zazz Internet (fibra óptica, Lunardelli-PR).
- N8N workflow `Pj5SdaxFh9H9EIX4` (Maluco Bot v3 tool_use) — orquestra o bot
- Dashboard Next.js 14 (App Router) — painel admin em `/opt/zazz/dashboard`
- v2 legacy: `DiInHUnddtFACSmj` (desativado)

## Stack
N8N · Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) · Whisper (áudio) · Evolution API v2 · PostgreSQL · Redis · Notion API · Next.js/React/Tailwind · JWT · PM2 no VPS

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

## Deploy do system prompt

N8N API key expira (~3 meses). `deploy_system_prompt.py` usa JWT que pode estar vencido. Usar sempre o método direto via psql:

```bash
ssh root@195.200.7.239 "cd /opt/zazz/dashboard && git pull origin main -q && python3 - <<'PYEOF'
import subprocess
with open('/opt/zazz/dashboard/v3_dump/sysprompt_v3.txt', 'r') as f:
    prompt = f.read()
escaped = prompt.replace(\"'\", \"''\")
sql = f\"UPDATE dashboard_config SET valor = '{escaped}' WHERE chave = 'system_prompt'; SELECT length(valor) FROM dashboard_config WHERE chave='system_prompt';\"
r = subprocess.run(['docker', 'exec', '-i', 'n8n-postgres-1', 'psql', '-U', 'zazz', '-d', 'zazzdb'],
    input=sql.encode(), capture_output=True, timeout=30)
print(r.stdout.decode()[:200])
PYEOF
"
```

## Deploy do agent_loop_code.js (nó Claude API)

O arquivo `v3_dump/agent_loop_code.js` contém API keys hardcoded — **não vai pro git**.
O arquivo fica no VPS em `/opt/zazz/dashboard/v3_dump/agent_loop_code.js` (não sincronizado via git).

Para atualizar o nó no N8N via SQLite (quando API key N8N estiver expirada):
```bash
# 1. Editar o arquivo local e copiar via SCP
scp v3_dump/agent_loop_code.js root@195.200.7.239:/opt/zazz/dashboard/v3_dump/

# 2. No VPS: parar N8N, substituir SQLite, reiniciar
VOLUME=/var/lib/docker/volumes/n8n_data/_data
docker stop n8n-n8n-1
python3 -c "
import json, sqlite3
with open('/opt/zazz/dashboard/v3_dump/agent_loop_code.js') as f: code = f.read()
con = sqlite3.connect('$VOLUME/database.sqlite')
cur = con.cursor()
cur.execute(\"SELECT nodes FROM workflow_entity WHERE id='Pj5SdaxFh9H9EIX4'\")
nodes = json.loads(cur.fetchone()[0])
for n in nodes:
    if n.get('name') == 'Claude API': n['parameters']['jsCode'] = code
cur.execute(\"UPDATE workflow_entity SET nodes=? WHERE id='Pj5SdaxFh9H9EIX4'\", (json.dumps(nodes),))
con.commit(); con.close(); print('ok')
"
chown ubuntu:ubuntu $VOLUME/database.sqlite
docker start n8n-n8n-1
```

## Infra (Hostinger VPS 195.200.7.239)
- N8N: https://n8n.srv1537041.hstgr.cloud
- Evolution: https://evolution.srv1537041.hstgr.cloud
- Dashboard: https://dashboard.srv1537041.hstgr.cloud
- PM2 name: `maluco-dashboard`
- SQLite N8N: `/var/lib/docker/volumes/n8n_data/_data/database.sqlite`

## Workflows N8N principais

| ID | Nome | Função |
|---|---|---|
| `Pj5SdaxFh9H9EIX4` | Maluco Bot v3 (tool_use) | Bot principal — recebe mensagens e processa com agent loop |
| `Urf233bK6RqoSlQs` | Alertas Notion | Polling Notion a cada 5min — envia alertas OK/Entrega por grupo+tipo |
| `tPUy8FowXH8v0skk` | Bot Memoria Longa | Extração batch de fatos a cada 6h |
| `5qTcBwOdBeoU1l7i` | Bot Memoria Dia | Resumo diário por chat (~02h) |

## 7 tools do agent loop

| Tool | Função |
|---|---|
| `buscar_cliente(q)` | Lookup cliente Zazz por nome/código |
| `criar_tarefa_notion(...)` | Cria tarefa no Notion |
| `resolver_tarefa_notion(page_id)` | Marca tarefa como Ok |
| `listar_tarefas_notion(status?)` | Lista tarefas (Parado/Ok/Todas) |
| `aprender_fato(...)` | Salva fato em bot_memoria_longa |
| `corrigir_fato(...)` | Corrige fato errado (manual ou autônomo) |
| `criar_lembrete(mensagem, agendar_para)` | Agenda follow-up no grupo atual |

## Nodes críticos (executeOnce: true obrigatório)
Busca POPs, Busca System Prompt, Busca Colaboradores, Busca Histórico 10, Busca Histórico Redis, Busca Chamados Redis, Busca Clientes, Busca Regras.
**Busca Regras** também precisa `alwaysOutputData: true`.
**Busca Fatos Existentes** (Bot Memoria Longa) precisa `alwaysOutputData: true`.

## System Prompt placeholders
`{{DATA}}` `{{ANO}}` `{{TODAY}}` `{{COLABORADORES}}` `{{CLIENTES}}` `{{POPS}}` `{{HISTORICO}}` `{{REGRAS}}`

Arquivo local: `v3_dump/sysprompt_v3.txt` (vai pro git via `git add -f`).

## Banco PostgreSQL — tabelas principais
- `mensagens` — message_id UNIQUE, remetente, mensagem, chat_id
- `dashboard_pops` — titulo, categoria, conteudo, ativo
- `dashboard_config` — chave UNIQUE, valor (armazena system_prompt)
- `dashboard_colaboradores` — nome, cargo, funcoes, ativo
- `regras` — regra TEXT
- `bot_conversas` — log de interações com tokens
- `bot_erros` — erros do N8N
- `grupos_whatsapp` — grupos internos com toggles bom_dia, alertas, tipos_filtro_entrega[], tipos_filtro_ok[]
- `mensagens_agendadas` — mensagens programadas por grupo (status: pendente/enviado/erro/cancelado)
- `bot_memoria_dia` — resumos diários por chat_id
- `bot_memoria_longa` — fatos duráveis cross-grupo (UNIQUE: entidade_tipo+entidade_id+fato)

## Redis keys
- `conv:{chatId}` — histórico (últimas 8 msgs após corte de tokens)
- `chamados:data` — chamados importados (TTL 24h)
- `config:bom_dia_grupo` — JID legado (substituído por grupos_whatsapp)

## Crons no VPS
- `15 8 * * 1-6` — `/api/tarefas/cobrar` (cobrança automática de tarefas vencidas)
- `* * * * *` — `sync-evolutivo.sh` (sincroniza cerebro-evolutivo/)
- `0 4 * * *` — purge chamados_snapshots > 30 dias

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

**Regra obrigatória:** ao implementar qualquer alteração significativa (nova feature, bug importante, mudança de arquitetura), criar ou atualizar o `.md` correspondente em `cerebro-evolutivo/`.

Essas notas são indexadas e injetadas como contexto no bot — é a memória evolutiva do sistema.

Arquivos existentes:
- `agent-loop-tool-use.md` — 7 tools, agent loop, deploy do nó Claude API, deploy do system prompt
- `memoria-evolutiva.md` — 3 camadas de memória (Redis/dia/longa), caminhos A/B/C de aprendizado
- `dashboard-admin.md` — páginas, APIs, tabelas, crons, padrões de código
- `multigrupo-tipos-implementado.md` — multi-grupo com filtro por tipo de tarefa
- `workflow-n8n.md` — estrutura do workflow, nodes, padrões de edição
- `metricas-notion.md` — feature de métricas de tarefas do Notion
- `treinamento-evolutivo.md` — como funciona o sistema de notas Obsidian
- `README.md` — índice de navegação

Ao adicionar nota nova: commit e push — cron do VPS sincroniza a cada minuto.
