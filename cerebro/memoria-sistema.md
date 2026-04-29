# Sistema de Memória em Camadas

Implementado em 2026-04-29. O bot agora aprende e lembra ao longo do tempo através de 3 camadas.

## Camada 1 — Histórico Curto (Redis)

- Key: `conv:{chatId}`, últimas 20 mensagens no formato role/content do Claude
- TTL: **12 horas** (era 4h — aumentado para cobrir turno completo de trabalho)
- Quem escreve: workflow principal após cada resposta (`Salva Histórico Redis`)
- Quem lê: workflow principal antes de cada resposta (`Busca Histórico Redis`)

## Camada 2 — Resumo Diário (Postgres)

- Tabela: `bot_memoria_dia` — `(chat_id, data)` UNIQUE
- Campos: `resumo`, `solicitacoes_abertas`, `solicitacoes_resolvidas`, `decisoes`, `pessoas_ativas`
- **Workflow N8N:** `Bot Memoria Dia` (ID: `5qTcBwOdBeoU1l7i`) — roda a cada 30 minutos
  - Lê mensagens do dia por chat → Claude Haiku extrai JSON → upsert
- **Dashboard:** Aba Admin → Memória → Resumos Diários
  - Botão "Extrair Agora" dispara via API `/api/memoria/extrair-dia`

## Camada 3 — Fatos Longos (Postgres)

- Tabela: `bot_memoria_longa` — `(entidade_tipo, entidade_id, fato)` UNIQUE
- Tipos de entidade: `cliente`, `colaborador`, `regiao`, `equipamento`, `empresa`
- Campos: `peso` (1-10), `ocorrencias`, `ativo`, `validado_por`
- **Workflow N8N:** `Bot Memoria Longa` (ID: `tPUy8FowXH8v0skk`) — roda todo dia às 03:00
  - Lê resumos dos últimos 7 dias + fatos existentes → Claude Haiku extrai padrões → fuzzy match JS + upsert
- **Deduplicação:** Jaccard similarity (tokenização por palavras, threshold 0.7) implementado em JavaScript no N8N Code node (sem pg_trgm)
- **Dashboard:** Aba Admin → Memória → Fatos Aprendidos
  - Editar texto, ajustar peso (1-10), desativar sem deletar, validar com nome

## Injeção no Bot (pendente — configuração manual no N8N)

Para o bot usar a memória nas respostas, adicionar no workflow `DiInHUnddtFACSmj`:

1. Node HTTP Request `Busca Memoria Contexto` antes de `Monta Prompt`:
   - `GET /api/memoria/contexto?chatId=...&texto=...`
   - Header: `x-token: <N8N_POPS_TOKEN>`
   - `continueOnFail: true`

2. No Code node `Monta Prompt`, injetar `bloco_contexto` no system prompt

Ver `docs/n8n-memoria.md` para instruções completas.

## API Routes

| Rota | Auth | Função |
|---|---|---|
| `GET /api/memoria/contexto` | x-token (N8N) | Retorna bloco pronto para injeção |
| `GET /api/memoria/resumos` | session admin | Lista resumos para UI |
| `GET /api/memoria/entidade/:tipo/:id` | session admin | Fatos de uma entidade |
| `PATCH /api/memoria/fato/:id` | session admin | Editar/desativar fato |
| `POST /api/memoria/extrair-dia` | session admin | Dispara workflow N8N dia |
| `POST /api/memoria/extrair-longa` | session admin | Dispara workflow N8N longa |

## Custo estimado

Claude Haiku — < US$0.20/mês para ambos os workflows com 5 grupos ativos.

## Feature Flag

`MEMORIA_ENABLED=true` no `.env` do VPS. Se ausente/false, todos os endpoints retornam vazio e o bot não é afetado.
