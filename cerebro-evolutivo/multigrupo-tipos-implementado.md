# Multi-Grupo + Filtro por Tipo de Tarefa

**Status:** em produção desde 2026-05-01
**Workflows envolvidos:**
- `Pj5SdaxFh9H9EIX4` — Maluco Bot v3 (tool_use)
- `Urf233bK6RqoSlQs` — Notificação Tarefa Ok — Notion (polling 5min)

## O problema que isso resolve

Antes: bot atendia 1 grupo só (Nego's Internet), e alertas Notion (OK / Entrega)
iam pra esse grupo único independente do tipo da tarefa. Quando expandiu pra
grupo do designer (Carimbo, Adesivo, Fachada…) começou a vazar alerta entre
grupos.

Agora: cada grupo configura na dashboard quais *tipos de tarefa* dispara alerta
pra ele. Filtro vazio = "todos os tipos".

## Schema (Postgres)

```sql
grupos_whatsapp (
  id, nome, chat_id UNIQUE, descricao, ativo,
  bom_dia                BOOLEAN,
  alertas_notion_entrega BOOLEAN,
  alertas_notion_ok      BOOLEAN,
  tipos_filtro_entrega   TEXT[],   -- vazio/null = todos os tipos
  tipos_filtro_ok        TEXT[],   -- idem
  criado_em, atualizado_em
)
```

Migração roda no `ensureTable()` do `dashboard/app/api/grupos/route.js`
(idempotente via `ALTER TABLE … ADD COLUMN IF NOT EXISTS`).

## API

| Rota | Método | Função |
|---|---|---|
| `/api/grupos` | GET / POST | lista (auto-seed) / cria |
| `/api/grupos/[id]` | PUT / DELETE | edita / remove |
| `/api/notion/tipos` | GET | lista tipos válidos da DB Notion (cache 5min) |

Auth: `getSession()` + `requireAdmin()` (ou `x-token: MALUCO_POPS_2026` para o bot).

## UI — `/admin` aba "Grupos"

- Card por grupo com nome, chat_id, descrição.
- Toggles **Alerta Entrega** / **Alerta OK**.
- Pra cada toggle ativo, multi-select com os 34+ tipos do Notion.
- Botão indica resumo: `OK · todos` ou `OK · 4 tipos`.

## Bot — onde o tipo entra

A tool `criar_tarefa_notion` tem `tipo` com `enum` da lista oficial de tipos
válidos (constante `TIPOS_VALIDOS` no nó Claude API do v3). Handler valida
antes de chamar o Notion: tipo fora do enum → retorna erro pro modelo escolher
um válido.

⚠️ **Case-sensitive**: `Crachá` vs `crachá` são opções DIFERENTES no Notion. A
constante `TIPOS_VALIDOS` precisa bater EXATAMENTE com o case do Notion. Caso
contrário, o bot cria opções duplicadas silenciosamente (já aconteceu uma vez
— removido manualmente).

Pra atualizar o enum:
```bash
curl -sS "https://api.notion.com/v1/databases/d54e5911e8af43dfaed8f2893e59f6ef" \
  -H "Authorization: Bearer $NOTION_TOKEN" -H "Notion-Version: 2022-06-28" \
  | jq -r '.properties.Tipo.multi_select.options[].name'
```
…e copia pro `TIPOS_VALIDOS` no nó Claude API.

## Workflow N8N — alertas (fluxo definitivo)

**Fonte única de alertas Ok/Entrega:** workflow `Urf233bK6RqoSlQs` (polling
5min do Notion).

```
A cada 5 min  →  Busca Ok Notion (HTTP)
              →  Busca Visto Redis        ┐
              →  Busca Grupos OK (Postgres)│ → Filtra e Decide (fan-out por grupo + filtro de tipo)
                                          ┘                ↓
                                                          Tem Novas? → Envia WhatsApp Notif (1x por grupo aplicável)
                                                                    → Salva Visto Redis (dedup)
```

Mesmo pipeline pra `Entrega` (nodes `Busca Tarefas Vencendo`, `Filtra Entrega`,
`Busca Grupos Entrega`, `Envia Alerta Entrega`).

### Lógica do `Filtra e Decide`
1. Pega tarefas Notion editadas nos últimos 12 min com status Ok.
2. Pra cada grupo (Busca Grupos OK):
   - filtro vazio → recebe tudo
   - filtro com itens → só recebe tarefas cujo `Tipo` está no filtro
   - tipo da tarefa não identificado + filtro ativo → pula (conservador)
3. Emite N items (um por grupo aplicável); cada item dispara 1 chamada Evolution.

### Por que polling e não webhook do Notion?

Notion não tem webhook gratuito. Polling 5min cobre dois caminhos:
- bot marca via `resolver_tarefa_notion` → Notion atualiza → polling vê em ≤5min
- usuário marca direto na UI do Notion → mesmo flow

### Por que `Decide Notif Ok` do v3 virou no-op?

Antes ele enviava notificação imediata ao bot marcar via tool. Mas o polling em
≤5min cobre o mesmo caso. Ter as duas fontes = duplicação. Centralizado no
polling pra ter consistência.

## Como adicionar/configurar um grupo novo

1. Adicionar o número da Evolution no grupo do WhatsApp (admin do grupo).
2. Pegar o JID (formato `120363xxxxx@g.us` para grupos novos, `xxxxx-yyyyy@g.us`
   para grupos antigos).
3. `/admin` → aba **Grupos** → *Adicionar grupo* → nome, chat_id, descrição.
4. Editar → ligar toggles → escolher tipos no multi-select.
5. Pronto. Não precisa mexer em nó N8N — o fan-out lê do banco a cada execução.

## Pegadinhas conhecidas

- **`chat_id` vazio** filtra na query (`AND chat_id <> ''`) — grupos
  recém-cadastrados sem JID não disparam erro, são silenciosamente ignorados.
- **`alwaysOutputData: true`** está em `Busca Grupos OK` e `Busca Grupos Entrega`
  pra não travar o flow se 0 grupos.
- **`tipos_filtro_*` ARRAY[] no PUT**: node-postgres aceita JS array nativamente.
  COALESCE com `[]` (vazio) trata como "todos", não como null.
- **Grupo origem da OK não recebe sua própria notificação** quando vinha do
  `Decide Notif Ok` do v3 (lógica anti-eco). No polling Urf233 essa lógica não
  existe (não tem como saber qual grupo originou a marcação) — aceitável porque
  o polling não roda imediato após a marcação, então não há eco perceptível.

## Limpezas históricas

- 2026-05-01: removida opção `teste` do multi_select Tipo no Notion (criada
  por engano pelo bot antes da validação enum). Restaram 34 tipos válidos.

## Arquivos relevantes

- `dashboard/app/api/grupos/route.js` — schema + seed inicial + GET/POST
- `dashboard/app/api/grupos/[id]/route.js` — PUT/DELETE
- `dashboard/app/api/notion/tipos/route.js` — proxy cacheado pro schema do Notion
- `dashboard/app/admin/page.jsx` — UI da aba Grupos
- N8N `Pj5SdaxFh9H9EIX4` nó **Claude API** — constante `TIPOS_VALIDOS`, tool
  `criar_tarefa_notion` com enum
- N8N `Urf233bK6RqoSlQs` nós **Filtra e Decide**, **Filtra Entrega**,
  **Busca Grupos OK/Entrega**
