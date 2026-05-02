# Memória Evolutiva do Bot

**Status:** em produção desde 2026-05-02
**Workflows:** `5qTcBwOdBeoU1l7i` (Memoria Dia), `tPUy8FowXH8v0skk` (Memoria Longa)

## Filosofia

Bot funciona como funcionário novo: vai acumulando contexto sobre clientes,
colaboradores, processos da empresa. Não esquece de uma semana pra outra.
Conhecimento aprendido em qualquer grupo serve em todos os grupos.

## Camadas de memória

```
1) HISTÓRICO IMEDIATO (Redis)         conv:{chatId}      últimas 8 msgs
   - escopo: por chat                                    TTL implícito (overwrite)
   - uso: contexto direto da conversa atual

2) RESUMO DO DIA (Postgres)           bot_memoria_dia    1 row por chat por dia
   - escopo: por chat
   - gerado: workflow Bot Memoria Dia (cron ~02h)
   - uso: bot lê "hoje" e "ontem" desse chat em cada msg

3) FATOS DURÁVEIS (Postgres)          bot_memoria_longa  N rows por entidade
   - escopo: GLOBAL (cross-grupo)
   - gerado: 1) extração batch a cada 6h (Bot Memoria Longa) 2) tool aprender_fato em tempo real
   - uso: bot recebe fatos relevantes (peso≥7 OU ocorrencias≥3) em cada msg
```

## Schema das tabelas

```sql
bot_memoria_dia (
  id, chat_id, data DATE,
  resumo TEXT,
  total_mensagens INT,
  solicitacoes_abertas    JSONB,
  solicitacoes_resolvidas JSONB,
  decisoes                JSONB,
  pessoas_ativas          JSONB,
  gerado_em TIMESTAMP,
  UNIQUE (chat_id, data)
)

bot_memoria_longa (
  id, entidade_tipo, entidade_id, fato TEXT,
  categoria, peso INT (1-10), ocorrencias INT,
  fonte_message_ids JSONB,
  primeira_ocorrencia, ultima_ocorrencia, ativo, validado_por,
  UNIQUE (entidade_tipo, entidade_id, fato)
)
```

`entidade_tipo` ∈ {cliente, colaborador, empresa, equipamento, processo, regiao, outro}

## Como o bot aprende

### Caminho A — extração batch (6h)

Workflow `tPUy8FowXH8v0skk` roda `0 */6 * * *`:

```
Agendamento  →  Busca Resumos Semana (bot_memoria_dia últimos 7 dias)
             →  Busca Fatos Existentes (bot_memoria_longa, alwaysOutputData=true)
             →  Prepara Prompt Longa (junta resumos + fatos conhecidos)
             →  Claude Extrai Fatos (HTTP) — devolve JSON com fatos novos
             →  Parse Fatos e Deduplica (compara com existentes, mescla por similaridade)
             →  Salva Fatos Longos (INSERT ON CONFLICT incrementa ocorrencias)
```

⚠️ **`Busca Fatos Existentes` PRECISA de `alwaysOutputData: true`.** Sem isso,
quando a tabela está vazia (1ª execução) o flow morre antes do Claude e a
memória nunca enche — catch-22 perfeito.

### Caminho B — tool em tempo real (`aprender_fato`)

Adicionada como 5ª ferramenta no agent loop. Bot decide salvar mid-conversa
quando perceber padrão útil:

```
"Dra. Maria sempre pede carimbo entrega segunda" →
  aprender_fato({
    entidade_tipo: 'cliente',
    entidade_id: 'Dra. Maria',
    fato: 'sempre pede carimbo entrega segunda',
    peso: 6,
    categoria: 'preferencia'
  })
```

Endpoint `POST /api/memoria/aprender` faz upsert idempotente: se o fato
(entidade_tipo, entidade_id, fato) já existe, incrementa `ocorrencias` e
atualiza `ultima_ocorrencia` em vez de duplicar.

## Como o bot usa

A cada mensagem, o nó **Busca Memoria Contexto** chama
`GET /api/memoria/contexto?chatId=X&texto=Y` que devolve um bloco pronto
pra injeção no system prompt:

```
🧠 MEMÓRIA DA EMPRESA (use como contexto, não como regra absoluta):

📅 HOJE no grupo:
  <resumo do dia>
  Solicitações ainda abertas hoje:
    - <cliente>: <descricao>

📅 ONTEM no grupo:
  <resumo de ontem>

📌 FATOS CONHECIDOS RELEVANTES:
  [cliente:Dra. Maria] sempre pede carimbo entrega segunda (visto 4x)
  [colaborador:Junior] cobre região do bairro alto (visto 7x)
  [empresa:Zazz Internet] pratica não-uso do RBX em momentos de venda (visto 2x)
```

Cap de 3000 chars no bloco. Critério de seleção:
- Resumo HOJE/ONTEM do **chat atual**
- Fatos com **peso ≥ 7 OU ocorrencias ≥ 3** (cross-grupo, todos os tipos)
- Fatos cuja `entidade_id` aparece literalmente no texto da mensagem
- Fatos `entidade_tipo IN (empresa, regiao)` sempre relevantes

## UI — `/admin` aba "Memória"

3 sub-abas:
- **Resumos Diários** — lista de `bot_memoria_dia` por chat e data
- **Fatos Aprendidos** — lista de `bot_memoria_longa` agrupados por tipo
- **Por Cliente** — busca livre por nome de cliente

Botão "Extrair Fatos" dispara o workflow Memoria Longa via webhook
(`/webhook/memoria-longa`).

## Pegadinhas

- **`bot_memoria_dia` é por chat, `bot_memoria_longa` é global.** Quando o bot
  responde no Designer, ele vê resumo diário SÓ do Designer mas fatos globais
  (que podem ter sido aprendidos no grupo Internet).
- **Postgres `date` no JSON vira ISO `'YYYY-MM-DDT00:00:00.000Z'` (UTC).** Em
  BRT (UTC-3) puxa pro dia anterior se renderizado com `new Date(s)`. Use
  extração literal por regex (já tá no `MemoriaTab.fmtData`).
- **Cron a cada 6h é arbitrário.** Se ficar caro com Haiku/Sonnet, voltar pra
  1×/dia — o tool `aprender_fato` cobre o tempo real.
- **`peso` é guidance**, não regra. Modelo escolhe 1-10 ao chamar `aprender_fato`,
  mas pode errar. Critério "peso≥7 OU ocorrencias≥3" do filtro de contexto evita
  vazamento de fatos triviais.

## Endpoints

| Rota | Quem chama | Função |
|---|---|---|
| `GET /api/memoria/resumos?chatId=X&limit=N` | UI dashboard | lista `bot_memoria_dia` |
| `GET /api/memoria/entidade/{tipo}/{id}` | UI (id=`_all_` lista todos do tipo) | fatos de uma entidade |
| `PUT /api/memoria/fato/{id}` | UI | edita peso/ativo/validado_por |
| `POST /api/memoria/extrair-dia` | UI botão | dispara Bot Memoria Dia |
| `POST /api/memoria/extrair-longa` | UI botão | dispara Bot Memoria Longa |
| `GET /api/memoria/contexto?chatId&texto` | N8N (bot) | bloco pronto pra system prompt |
| `POST /api/memoria/aprender` | bot (tool) | upsert de fato (idempotente) |

## Configuração

`.env` no VPS:
```
MEMORIA_ENABLED=true
N8N_MEMORIA_DIA_WF_ID=5qTcBwOdBeoU1l7i
N8N_MEMORIA_LONGA_WF_ID=tPUy8FowXH8v0skk
N8N_POPS_TOKEN=...                    # auth do contexto
MALUCO_INTERNAL_TOKEN=MALUCO_POPS_2026 # auth da tool aprender_fato
```

## Arquivos

- `dashboard/app/api/memoria/contexto/route.js` — montagem do bloco
- `dashboard/app/api/memoria/aprender/route.js` — POST upsert (consumo da tool)
- `dashboard/app/api/memoria/entidade/[tipo]/[id]/route.js` — listagem (suporta `_all_`)
- `dashboard/components/MemoriaTab.jsx` — UI 3 sub-abas
- N8N `tPUy8FowXH8v0skk` — workflow Memoria Longa
- N8N `5qTcBwOdBeoU1l7i` — workflow Memoria Dia
- N8N `Pj5SdaxFh9H9EIX4` nó **Claude API** — tool `aprender_fato` no schema
- N8N `Pj5SdaxFh9H9EIX4` nó **Busca Memoria Contexto** — chama o endpoint
