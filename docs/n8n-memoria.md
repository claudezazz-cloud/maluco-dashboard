# Integração N8N — Sistema de Memória em Camadas

## Visão Geral

O sistema de memória tem 3 camadas:

| Camada | Onde vive | TTL / Frequência | O que guarda |
|---|---|---|---|
| Curta | Redis `conv:{chatId}` | 12h, últimas 20 msgs | Histórico role/content da conversa |
| Média | `bot_memoria_dia` | Gerado a cada 30min | Resumo executivo do dia por chat |
| Longa | `bot_memoria_longa` | Gerado às 03:00 diário | Padrões e fatos por entidade |

---

## Workflows N8N criados automaticamente

| Workflow | ID | Trigger |
|---|---|---|
| Bot Memoria Dia | `5qTcBwOdBeoU1l7i` | Cron `*/30 * * * *` |
| Bot Memoria Longa | `tPUy8FowXH8v0skk` | Cron `0 3 * * *` |

Ambos estão ativos. Para desativar, use a interface do N8N ou:
```bash
curl -X POST https://n8n.srv1537041.hstgr.cloud/api/v1/workflows/<ID>/deactivate \
  -H "X-N8N-API-KEY: <sua_chave>"
```

---

## Como injetar o bloco de memória no bot (Monta Prompt)

### Passo 1 — Adicionar node HTTP Request antes de "Monta Prompt"

No workflow principal (`DiInHUnddtFACSmj`), adicionar um node **HTTP Request** entre `Busca Grupo Atual` e `Monta Prompt`:

```
Nome: Busca Memoria Contexto
Tipo: HTTP Request
Método: GET
URL: https://dashboard.srv1537041.hstgr.cloud/api/memoria/contexto
Headers:
  x-token: <valor de N8N_POPS_TOKEN>
Query params (expressões N8N):
  chatId  = {{ $('Verifica Menção').first().json.chatId }}
  texto   = {{ $('Verifica Menção').first().json.textMessage }}
  incluirOntem = true
Options:
  continueOnFail: true  ← importante: não travar o bot se a memória falhar
```

### Passo 2 — Injetar em "Monta Prompt"

No Code node `Monta Prompt`, adicionar logo após a seção de POPs (`evolutivoSection`):

```js
// MEMÓRIA DAS CAMADAS 2 e 3
let memoriaContext = '';
try {
  const memResp = $('Busca Memoria Contexto').first().json;
  if (memResp?.bloco_contexto) {
    memoriaContext = '\n\n' + memResp.bloco_contexto;
  }
} catch(e) {}
```

E incluir `memoriaContext` no `systemContent`, logo antes do `historicoSection`:

```js
// Substituir a linha que tem __CACHE_SPLIT__ por:
.replace(/\{\{HISTORICO\}\}/g, '__CACHE_SPLIT__')
// E antes de montar os blocks, adicionar memoriaContext ao dynamic:
const dynamic = (memoriaContext + historicoSection + (afterMarker || '') + skillContext).trim();
```

### Passo 3 — Adicionar Schedules para os jobs (já criados)

Os dois workflows já estão rodando automaticamente. Para disparar manualmente pelo admin, use a aba **Memória** → botão "Extrair Agora" / "Extrair Fatos".

---

## Variáveis de ambiente necessárias no dashboard (VPS)

Adicionar em `/opt/zazz/dashboard/.env`:

```env
# Feature flag — habilita o sistema de memória
MEMORIA_ENABLED=true

# IDs dos workflows N8N de extração
N8N_MEMORIA_DIA_WF_ID=5qTcBwOdBeoU1l7i
N8N_MEMORIA_LONGA_WF_ID=tPUy8FowXH8v0skk

# Já devem existir (usados para disparar workflows via API):
N8N_URL=https://n8n.srv1537041.hstgr.cloud
N8N_API_KEY=<chave da API do N8N>
N8N_POPS_TOKEN=<token compartilhado>
```

---

## Tabelas criadas

### `bot_memoria_dia`
Resumo executivo por chat por dia.

| Campo | Tipo | Descrição |
|---|---|---|
| chat_id | VARCHAR(100) | JID do grupo/privado |
| data | DATE | Data do resumo |
| resumo | TEXT | Parágrafo descritivo |
| total_mensagens | INT | Quantidade de mensagens no dia |
| solicitacoes_abertas | JSONB | `[{cliente, descricao, hora}]` |
| solicitacoes_resolvidas | JSONB | `[{cliente, descricao, hora, resolvido_por}]` |
| decisoes | JSONB | `["string"]` |
| pessoas_ativas | JSONB | `["nome"]` |

### `bot_memoria_longa`
Fatos duráveis por entidade.

| Campo | Tipo | Descrição |
|---|---|---|
| entidade_tipo | VARCHAR(30) | `cliente\|colaborador\|regiao\|equipamento\|empresa` |
| entidade_id | VARCHAR(100) | Nome/código da entidade |
| fato | TEXT | Frase descritiva do padrão |
| peso | INT 1-10 | Relevância para decisões |
| ocorrencias | INT | Quantas vezes confirmado |
| ativo | BOOLEAN | Desativar sem deletar |
| validado_por | VARCHAR | Nome do humano que validou |

Fatos com `peso >= 7` ou `ocorrencias >= 3` são injetados no contexto automaticamente quando a entidade é mencionada na mensagem.

---

## Custo estimado (Claude Haiku)

- Resumo dia: ~2k tokens input + ~500 output por chat/rodada. Com 5 grupos ativos: ~12.5k tokens/30min = ~1.2M tokens/mês ≈ US$0.15/mês
- Fatos longos: ~5k tokens input + ~1k output por dia = ~180k tokens/mês ≈ US$0.02/mês

Total: < US$0.20/mês para o sistema de memória completo.
