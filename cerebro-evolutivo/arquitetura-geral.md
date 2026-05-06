# Arquitetura Geral — Maluco da IA (Bot WhatsApp Zazz)

Documento de visão geral. Pra detalhes de cada parte, ver notas específicas.

## Stack completa

```
WhatsApp do usuário
        ↓ (mensagem)
Evolution API v2 (envio/recebimento)
        ↓ (POST webhook)
N8N (orquestração) ← workflow Pj5SdaxFh9H9EIX4
        ↓ (chama)
Claude Haiku 4.5 (LLM)
        ↓ (com tools)
   ┌────┴────┬───────────┬──────────┐
PostgreSQL  Redis     Notion API  Dashboard API
(zazz/zazzdb) (cache  (tarefas)  (POPs, clientes,
              hist.)              chamados, fatos)
```

VPS: Hostinger 195.200.7.239 (Ubuntu, Docker, PM2)

## Fluxo completo de uma mensagem

```
1. Usuário manda "/chamados" no grupo via WhatsApp
2. Evolution API recebe e POST → webhook N8N (path /whatsapp)
3. N8N: Filter1 valida payload → Verifica Menção → Extrai Dados
4. Em paralelo: Salva no Postgres (mensagens) + Detecta Resolvido (auto-Ok)
5. N8N busca contexto: POPs, Colaboradores, Histórico, Chamados Redis,
   Tarefas Notion, Memória Longa, Evolutivo, Grupo Atual
6. Monta Prompt monta o claudeBody (system + messages + tools)
7. Claude API node: agent loop com Haiku 4.5
   a. Pode chamar até 5 iterações de tools (buscar_pop, buscar_chamados, etc)
   b. tool_choice forçado quando msg tem /chamados, /relatorio, /lembrete
8. Parse Resposta extrai markdown + markers (|||NOTION|||, |||NOTION_OK|||)
9. Salva conversa em bot_conversas (com tokens, pops_usados)
10. Envia resposta via Evolution API → WhatsApp do usuário
```

## Componentes principais

### N8N Workflows ativos

| ID | Nome | Função |
|---|---|---|
| `Pj5SdaxFh9H9EIX4` | Maluco Bot v3 (tool_use) | Bot principal, recebe webhook, processa msg |
| `Urf233bK6RqoSlQs` | Notificação Tarefa Ok | Polling Notion 5min, alerta tasks Ok/Entrega |
| `tPUy8FowXH8v0skk` | Bot Memória Longa | Extrai fatos das conversas a cada 6h |
| `5qTcBwOdBeoU1l7i` | Bot Memória Dia | Resumo diário por chat ~02h |

### Dashboard Next.js (PM2: maluco-dashboard)

- `/admin` — gerencia POPs, colaboradores, regras, solicitações programadas
- `/treinamento` — adicionar fatos, corrigir, ver memória
- `/conversas` — histórico de mensagens com tokens
- `/chamados` — importação manual de XLSX
- `/api/*` — endpoints HTTP usados pelo bot:
  - `/api/pops/buscar` (tool buscar_pop)
  - `/api/chamados/buscar` (tool buscar_chamados)
  - `/api/clientes/buscar` (tool buscar_cliente)
  - `/api/memoria/aprender` (tool aprender_fato)
  - `/api/memoria/corrigir` (tool corrigir_fato)
  - `/api/memoria/contexto` (Busca Memoria Contexto)
  - `/api/lembretes` (tool criar_lembrete — STANDBY)
  - `/api/chamados/auto-import` (cron routerbox-auto)
  - `/api/solicitacoes/processar` (cron 1min)
  - `/api/mensagens-agendadas/processar` (cron 1min)
  - `/api/notion/sync-snapshot` (cron 5min)

### Tabelas PostgreSQL principais

| Tabela | Pra quê |
|---|---|
| `mensagens` | Log de todas msgs recebidas (chat_id, remetente, mensagem, data) |
| `bot_conversas` | Log de respostas do bot com tokens + pops_usados |
| `bot_erros` | Erros do N8N (raro popular) |
| `dashboard_pops` | POPs ativos (titulo, conteudo, prioridade=sempre/importante/relevante) |
| `dashboard_config` | Config global, inclui chave `system_prompt` |
| `dashboard_colaboradores` | Time da Zazz (nome, cargo, funcoes) |
| `colaboradores_numeros` | Múltiplos JIDs por colaborador (canonização de remetente) |
| `regras` | Regras de comportamento do bot |
| `grupos_whatsapp` | Grupos com toggles bom_dia, alertas, tipos_filtro |
| `bot_memoria_longa` | Fatos duráveis cross-grupo (UNIQUE entidade+id+fato) |
| `bot_memoria_dia` | Resumo diário por chat_id |
| `mensagens_agendadas` | Mensagens programadas (lembretes, cobranças) |
| `dashboard_solicitacoes_programadas` | Cron de comandos / tipo /chamados / /relatorio |
| `chamados_snapshots` | Snapshots históricos pra cálculo de "resolvidos hoje" |

### Redis

```
conv:{chatId}              # histórico últimas 8 msgs (após corte)
chamados:data              # JSON dos chamados importados (TTL 24h)
config:bom_dia_grupo       # JID legado (substituído por grupos_whatsapp)
```

### Crons no VPS (`crontab -l`)

| Cron | Função |
|---|---|
| `* * * * * sync-evolutivo.sh` | Sincroniza cerebro-evolutivo/ pro Postgres |
| `* * * * * .../api/solicitacoes/processar` | Dispara solicitações programadas (bom dia, relatório) |
| `* * * * * .../api/mensagens-agendadas/processar` | Envia lembretes e cobranças programadas |
| `5 * * * * scrape.js` | Importa chamados Routerbox (a cada hora, minuto 5) |
| `*/5 * * * * .../notion/sync-snapshot` | Snapshot Notion pra detectar mudanças |
| `15 11 * * 1-6 .../tarefas/cobrar` | Cobrança automática de tarefas vencidas (8:15 BRT) |
| `0 4 * * *` | Purga chamados_snapshots > 30 dias |

## Cache split do prompt (otimização de tokens)

System prompt dividido em 2 blocos via marker `__CACHE_SPLIT__`:

**Bloco ESTÁVEL (~24k chars):** com `cache_control: ephemeral`
- System prompt template
- Colaboradores
- POPs (apenas TÍTULOS)
- Regras gerais

**Bloco DINÂMICO (~16k chars):** sem cache_control
- Memoria contexto
- Resolvidos hoje
- Tarefas Notion ativas
- Histórico (últimas 10 msgs)
- Skill ativada
- Conhecimento Evolutivo (notas Obsidian via semantic search)

**Por que split:** se dado dinâmico fica no bloco estável, cache invalida toda hora → todos tokens contam como input. Custo explode.

Detalhes em [agent-loop-tool-use.md](agent-loop-tool-use.md).

## 9 tools disponíveis (agent loop)

| Tool | Pra quê |
|---|---|
| `buscar_pop(titulo)` | Lê conteúdo de POP específico |
| `buscar_chamados()` | Lista chamados abertos do Redis |
| `buscar_cliente(q)` | Lookup cliente por nome/código |
| `criar_tarefa_notion(...)` | Cria tarefa no Notion |
| `resolver_tarefa_notion(page_id)` | Marca tarefa Ok |
| `listar_tarefas_notion(status?)` | Lista até 50 tarefas |
| `aprender_fato(...)` | Salva fato durável em bot_memoria_longa |
| `corrigir_fato(...)` | Desativa fato errado + salva versão correta |
| `criar_lembrete(...)` | ⚠️ STANDBY — agendava follow-up |

## Fluxos paralelos secundários

Além do fluxo principal (Webhook → Claude → Resposta), tem:

1. **Detecta Resolvido** (paralelo, dispara após Webhook)
   - Detecta keywords tipo "ficou pronto", "concluído", "resolvido"
   - Pergunta ao Claude qual tarefa Notion bate
   - Se 1 match claro → marca Ok automaticamente
   - **Cuidado:** regex frouxo causa falso-positivo (ex: "avisar quando tiver pronto" não é confirmação)

2. **Detecta Áudio** + **Whisper transcrição**
   - Se mensagem tem áudio → transcreve via Whisper
   - Adiciona transcrição ao text antes do Claude

3. **Detecta Imagem** + **Claude Vision**
   - Se mensagem tem imagem → descreve via Claude Vision
   - Salva descrição no campo `mensagem` do banco
   - Bot vê a imagem como conteúdo na conversa

4. **Workflows de polling** (separados)
   - Notificação Tarefa Ok: detecta tarefas marcadas Ok no Notion → notifica grupo
   - Bot Memória Dia: às ~02h gera resumo diário por chat
   - Bot Memória Longa: a cada 6h extrai fatos das conversas

## Pontos críticos / gotchas

- **N8N v2.14+ usa workflow_history** — editar só workflow_entity NÃO aplica. Ver [deploy-workflow.md](deploy-workflow.md).
- **WhatsApp formatação**: `*negrito*` (1 asterisco), `_itálico_`. NUNCA `**`, NUNCA `##`.
- **executeOnce: true obrigatório** em nós Busca POPs, System Prompt, Colaboradores, Histórico, Clientes, Regras (senão duplica). Ver [workflow-n8n.md](workflow-n8n.md).
- **SplitInBatches v3** — outputs invertidos (out0=done, out1=loop). Pega muita gente.
- **Edição direta no SQLite** — n8n só lê no boot, requer restart. Ver regras de WAL em [workflow-n8n.md](workflow-n8n.md).
- **Postgres queries no n8n** — usar `'{{ $json.campo }}'` direto, NÃO template literal com backtick.

## Como o bot é "treinado"

3 camadas de aprendizado:

1. **POPs** (`/treinamento`): processos formais da empresa, prioridade explícita (sempre/importante/relevante). Bot lê via tool `buscar_pop` quando precisa.

2. **Memória longa** (`bot_memoria_longa`): fatos duráveis sobre clientes/colaboradores/processos. Bot salva via `aprender_fato` quando percebe padrão. Injetado no contexto via `Busca Memoria Contexto`.

3. **Conhecimento Evolutivo** (`dashboard/cerebro-evolutivo/`): notas Obsidian sobre o sistema. Sincronizadas pro postgres via cron, indexadas, injetadas no prompt via `Busca Evolutivo` quando match semântico com a mensagem.

Ver [memoria-evolutiva.md](memoria-evolutiva.md) (se existir) para detalhes.

## Histórico de marcos

- **abr/2026**: v3 do bot lançado com agent loop tool_use. POPs como contexto direto.
- **abr/2026**: cache split implementado pra economia.
- **mai/2026**: chamados/POPs movidos pra tools. Tokens 30k → 7k.
- **mai/2026**: descoberto que workflow_history precisa ser atualizada (6 sessões debugando).
- **mai/2026**: tool_choice forçado pra `/chamados`, `/relatorio` (Haiku preguiçoso).
- **mai/2026**: Detecta Resolvido refatorado (regex frouxo causava falso-positivo).
