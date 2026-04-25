# Filiais

← volta para [[Maluco da IA]] | gerenciamento em [[Dashboard]] | infraestrutura em [[Infraestrutura]]

Sistema **multi-tenant** — uma instância da [[Dashboard]] pode gerenciar múltiplas filiais (ex: Lunardelli, futuramente outras cidades), cada uma com seu próprio bot, grupo de WhatsApp e config independente.

## Tabelas

### `dashboard_filiais`

| Campo | Uso |
|-------|-----|
| `nome` | Nome da filial (ex: "Lunardelli") |
| `n8n_workflow_id` | ID do workflow N8N (ex: "DiInHUnddtFACSmj") |
| `evolution_instance` | Nome da instância na Evolution API (ex: "ZazzClaude") |
| `group_chat_id` | ID do grupo WhatsApp da filial |
| `ativo` | Soft-delete |

### `dashboard_filiais_config`

Key-value por filial (FK em `filial_id`). Permite override de qualquer config (system prompt customizado, tokens, URLs, etc).

## Fluxo de criação

`/admin/filiais/page` (wizard de 4 passos, admin only):

1. **Dados básicos** — nome, cidade
2. **Conexão N8N + Evolution** — testa via `/api/filiais/test-connection`
3. **Setup do banco** — chama `/api/filiais/setup-db` (cria tabelas separadas se necessário)
4. **Duplicar workflow** — `/api/filiais/duplicate-workflow` clona o workflow N8N base com novo `evolution_instance`

## Cuidado

A versão atual (v5) ainda **não roda multi-filial em produção** — só Lunardelli ativo. A infraestrutura foi preparada mas não testada com 2+ filiais simultâneas.

Pontos a validar antes:
- Cada filial precisa do próprio número WhatsApp (instância Evolution separada)
- O `chat_id` no Postgres já distingue mensagens, mas o [[System Prompt]] hoje é único — precisa virar per-filial via `dashboard_filiais_config`
- Os [[POPs]] também — provavelmente precisa coluna `filial_id` em `dashboard_pops`

## Quando ativar

Quando a Zazz expandir pra 2ª cidade. Hoje toda complexidade extra é especulativa.

## Endpoints

- `GET/POST /api/filiais` — list/create
- `GET/PUT/DELETE /api/filiais/[id]` — detail/edit/soft-delete
- `POST /api/filiais/test-connection` — valida N8N + Evolution
- `POST /api/filiais/setup-db` — provisiona tabelas
- `POST /api/filiais/duplicate-workflow` — clona workflow N8N
