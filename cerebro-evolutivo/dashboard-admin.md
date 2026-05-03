# Dashboard Admin — Estrutura

Painel Next.js 14 (App Router) rodando em `dashboard.srv1537041.hstgr.cloud` (PM2: `maluco-dashboard`).

## Páginas principais

- `/` — login
- `/admin` — painel principal com abas: Filiais, Usuários, Configurações, Solicitações, Grupos, Métricas
- `/treinamento` — abas: Regras, POPs, Colaboradores, Skills, Tools (7), Memória, Evolutivo
- `/admin/filiais/[id]` — editar configurações de filial (tokens, IDs externos)

**Nota:** a aba Memória foi movida de /admin para /treinamento em 2026-05-02.

## Padrões de código

- Auth: `getSession()` + `requireAdmin()` de `lib/auth.js`
- DB: `query(sql, params)` de `lib/db.js` — sempre parametrizado com `$1`, `$2`...
- Schema auto-gerenciado: `ensureTable()` chamado dentro da rota API
- Tema: bg `#0f0f13`, cards `#1a1a24`, brand `#071DE3`

## Deploy

```bash
ssh root@195.200.7.239 "cd /opt/zazz/dashboard && git pull origin main && npm run build && pm2 restart maluco-dashboard --update-env"
```

## Aba Grupos (/admin → Grupos)

Gerencia grupos WhatsApp internos. Tabela `grupos_whatsapp`:
- `nome`, `chat_id` (JID ex: `120363xxxxx@g.us`), `descricao`
- `bom_dia BOOLEAN` — recebe mensagem automática 7h30
- `alertas_notion_entrega BOOLEAN` — recebe alertas de nova tarefa criada e edições de tarefa
- `alertas_notion_ok BOOLEAN` — recebe alertas de tarefa marcada Ok
- `tipos_filtro_entrega TEXT[]` — filtra por tipo de tarefa nos alertas de entrega
- `tipos_filtro_ok TEXT[]` — filtra por tipo de tarefa nos alertas de ok
- Seed automático na 1ª abertura: Nego's Internet, Nego's Sub, Migra e Instalação, Diário

API: `/api/grupos` (GET + POST) e `/api/grupos/[id]` (PUT + DELETE).

Solicitações (mensagens agendadas): campo "Grupos" permite múltiplos grupos simultaneamente.

## Aba Memória (/treinamento → Memória)

Componente `MemoriaTab.jsx`. 3 sub-abas:

**Resumos Diários** — lista `bot_memoria_dia` por chat/data. Botão "Extrair Agora" dispara workflow `5qTcBwOdBeoU1l7i`.

**Fatos Aprendidos** — lista `bot_memoria_longa` com filtro por tipo e busca. Edição inline de peso/fato. Toggle ativo/inativo. Botão "Extrair Fatos" dispara workflow `tPUy8FowXH8v0skk`.

**Por Cliente** — busca ILIKE em `entidade_id` via `/api/memoria/cliente?q=`. Exibe perfil rico agrupado por categoria:
- 🔴 Problemas, 💰 Financeiro, 🟡 Preferências, 🟠 Equipamento, 🟣 Processo, 🔵 Histórico
- Badge "⚠ Atenção" se problemas frequentes (ocorrências ≥ 2 ou peso ≥ 7)

## APIs de memória

| Rota | Método | Função |
|---|---|---|
| `/api/memoria/resumos` | GET | lista `bot_memoria_dia` |
| `/api/memoria/entidade/[tipo]/[id]` | GET | fatos de entidade |
| `/api/memoria/fato/[id]` | PATCH | edita peso/ativo/validado_por |
| `/api/memoria/extrair-dia` | POST | dispara Bot Memoria Dia |
| `/api/memoria/extrair-longa` | POST | dispara Bot Memoria Longa |
| `/api/memoria/contexto` | GET | bloco pronto para system prompt (usado pelo N8N) |
| `/api/memoria/aprender` | POST | upsert de fato (tool aprender_fato) |
| `/api/memoria/corrigir` | POST | desativa fato + salva corrigido (tool corrigir_fato) |
| `/api/memoria/cliente` | GET | busca ILIKE por cliente, retorna perfil agrupado |

## APIs de automação

| Rota | Método | Função |
|---|---|---|
| `/api/lembretes` | POST | cria mensagem agendada a partir de chat_id (tool criar_lembrete) |
| `/api/mensagens-agendadas/processar` | POST | lê `mensagens_agendadas` pendentes com `agendar_para <= NOW()`, envia via Evolution API, marca enviado/erro. Chamado a cada minuto via cron. |
| `/api/tarefas/cobrar` | POST | busca tarefas Notion vencidas e insere notificações por grupo. Chamado via cron VPS 8h15 seg-sáb. |
| `/api/notion/sync-snapshot` | POST | compara tarefas ativas do Notion com snapshot; detecta edições de responsável/entrega/status; notifica grupos via WhatsApp; atualiza `notion_tarefas_snapshot`. Cron a cada 5 min. |
| `/api/clientes/buscar` | GET | lookup de clientes — busca por palavras individuais (AND), encontra "Sergio Carlos de Sousa" buscando "sergio carlos sousa" |
| `/api/notion/tipos` | GET | lista tipos do Notion DB (cache 5min) |

## Crons no VPS

```
# Cobrança automática de tarefas vencidas (seg-sáb 8h15)
15 8 * * 1-6 curl -s -X POST https://dashboard.srv1537041.hstgr.cloud/api/tarefas/cobrar -H "x-token: MALUCO_POPS_2026" >> /var/log/cobrar-tarefas.log 2>&1

# Envio de mensagens agendadas (a cada minuto)
* * * * * curl -s -X POST https://dashboard.srv1537041.hstgr.cloud/api/mensagens-agendadas/processar -H "x-token: MALUCO_POPS_2026" >> /var/log/mensagens-processar.log 2>&1

# Sync/diff de edições no Notion (a cada 5 min)
*/5 * * * * curl -s -X POST https://dashboard.srv1537041.hstgr.cloud/api/notion/sync-snapshot -H "x-token: MALUCO_POPS_2026" >> /var/log/notion-snapshot.log 2>&1

# Sync cerebro-evolutivo (a cada minuto)
* * * * * /opt/zazz/dashboard/sync-evolutivo.sh

# Purge chamados_snapshots > 30 dias (04h)
0 4 * * * docker exec n8n-postgres-1 psql -U zazz -d zazzdb -c "DELETE FROM chamados_snapshots ..."
```

## Banco PostgreSQL — tabelas principais

- `mensagens` — message_id UNIQUE, remetente, mensagem, chat_id
- `dashboard_pops` — titulo, categoria, conteudo, ativo
- `dashboard_config` — chave UNIQUE, valor (armazena system_prompt)
- `dashboard_colaboradores` — nome, cargo, funcoes, ativo
- `regras` — regra TEXT
- `bot_conversas` — log de interações com tokens
- `bot_erros` — erros do N8N
- `grupos_whatsapp` — grupos internos com toggles de automação e filtros por tipo
- `mensagens_agendadas` — mensagens programadas (grupo_id FK, status: pendente/enviado/erro/cancelado)
- `bot_memoria_dia` — resumos diários por chat_id
- `bot_memoria_longa` — fatos duráveis cross-grupo (entidade_tipo, entidade_id, fato UNIQUE)
- `notion_tarefas_snapshot` — snapshot das tarefas ativas do Notion (page_id PK, titulo, status, responsavel, entrega, tipo, snapshot_em)

## Aba Evolutivo (Treinamento)

Visível apenas para admins. Configura e monitora a sincronização das notas `cerebro-evolutivo/` com o banco de vetores que alimenta o contexto do bot.
