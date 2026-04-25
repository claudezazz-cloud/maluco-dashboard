# Error Trigger Global

← volta para [[Workflow N8N]] | [[Funcionalidades]]

Captura **qualquer erro** do workflow e grava em `bot_erros` (ver [[Banco de Dados]]).

## Como funciona

```
[Qualquer nó falha]
   ↓
Erro Global (Trigger)            ← node type: n8n-nodes-base.errorTrigger
   ↓
Salva Erro Global (Postgres)     ← INSERT em bot_erros
```

## Configuração crítica

Em `workflow.settings`:
- `errorWorkflow = <próprio-id>` — faz o workflow apontar pra ele mesmo como handler de erro
- `saveDataErrorExecution = 'all'` — persiste dados das execuções de erro

Isso é auto-referência: o workflow monitora a si mesmo.

## O que é salvo

| Campo | Fonte |
|-------|-------|
| `no_n8n` | `$json.execution.lastNodeExecuted` |
| `mensagem_erro` | `$json.execution.error.message` (truncado em 2000 chars) |
| `mensagem_usuario` | `''` (vazio no handler global) |
| `chat_id` | `$json.workflow.id` |

## Interface

A [[Dashboard]] lê via `/api/erros` e exibe:
- `/conversas` → aba **Erros** com lista completa
- `/dashboard` → contador **ERROS HOJE** na visão geral

## Cobertura

Captura falhas de:
- Whisper (transcrição) → ver [[Fluxo de Audio]]
- Claude API (texto e Vision) → ver [[Fluxo de Imagem]]
- Evolution API (envio WhatsApp)
- Postgres / Redis
- Notion

Basicamente qualquer HTTP Request ou operação de banco que explode.
