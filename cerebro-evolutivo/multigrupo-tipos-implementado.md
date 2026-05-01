# Multi-Grupo + Filtro de Tipos — Como o bot funciona agora

**Implementado em:** 2026-05-01
**Workflow:** `Pj5SdaxFh9H9EIX4` (Maluco Bot v3 tool_use)

## Visão geral

O bot agora suporta **N grupos do WhatsApp** com regras independentes,
e cada grupo escolhe **quais tipos de tarefa** disparam alertas Notion para ele.
A mesma instância Evolution + mesmo workflow N8N atendem todos.

## Onde tudo vive

### Postgres
- `grupos_whatsapp` — uma linha por grupo:
  - `chat_id` (JID do grupo)
  - `bom_dia`, `alertas_notion_entrega`, `alertas_notion_ok` (boolean)
  - `tipos_filtro_entrega TEXT[]` — tipos que o grupo recebe alerta de Entrega.
    Vazio (`{}`) = todos os tipos.
  - `tipos_filtro_ok TEXT[]` — idem para alertas de OK.
- `mensagens_agendadas` (já existia, sem mudança nesta feature)

### Dashboard `/admin` aba "Grupos"
- Card por grupo. Botão *Editar* abre form com:
  - Nome / chat_id / descrição
  - Toggles **Alerta Entrega** / **Alerta OK**
  - Multi-select de **Tipos de Entrega** e **Tipos de OK**
    (se selecionar zero, é "todos os tipos")
- Tipos do multi-select vêm de `/api/notion/tipos` (cache 5min, lê schema do Notion).

### Bot (agent loop, nó `Claude API` no v3)
- Tool `criar_tarefa_notion` agora tem `tipo` com `enum` da lista oficial de tipos válidos
  (lista hardcoded sincronizada de 2026-05-01 — atualizar quando criar/remover tipos no Notion).
- Handler valida: se o modelo passar tipo fora do enum, retorna erro descritivo
  pra ele tentar de novo com um tipo válido.
- Modelo é instruído: *"escolha SEMANTICAMENTE o mais próximo do pedido. Se não souber, use Outros. NUNCA invente."*

### Workflow N8N — fan-out
1. **Tem Ok?** (IF) → **Explode Oks** (1 item por OK detectado)
2. **Marca Ok no Notion** (PATCH status=Ok) — resposta inclui `properties.Tipo.multi_select`
3. **Busca Config Notif Ok** (Postgres) — `SELECT chat_id, tipos_filtro_ok FROM grupos_whatsapp WHERE ativo AND alertas_notion_ok AND chat_id<>''`
4. **Decide Notif Ok** (Code) — pra cada grupo:
   - Se `tipos_filtro_ok` vazio → manda
   - Se contém o `tipo` da tarefa → manda
   - Se filtro tem itens e tipo não bate → pula
   - Se for o próprio grupo de origem da OK → pula
5. **Envia Notif Ok** (HTTP Evolution) — usa `{{ $json.chat_id }}` do item gerado pelo Decide

Cada item gerado pelo Decide vira uma chamada separada à Evolution = 1 mensagem por grupo aplicável.

## Regras importantes para entender o fluxo

- **A query `Busca Config Notif Ok`** filtra `chat_id <> ''` — grupos cadastrados sem JID
  (ainda não preenchidos pelo usuário) são ignorados, nunca quebram o pipeline.
- **`alwaysOutputData: true`** está ativo nesse Postgres, então 0 grupos não trava o flow.
- **Filtro vazio = todos os tipos.** Isso evita que adicionar um tipo novo no Notion
  (ex: "Bordado") quebre alertas — grupos com filtro vazio continuam recebendo tudo,
  e grupos com filtro restrito ignoram o tipo novo até que admin adicione na lista.
- **Mesmo pipeline serve para Entrega** (não foi alterado nesta v8, vai usar o
  mesmo padrão quando o usuário precisar — basta clonar a lógica trocando `_ok` por `_entrega`).

## Limpezas feitas

- Removido o tipo "teste" do multi_select Tipo no Notion (criado por engano pelo bot
  antes do enum). Ficaram 34 tipos válidos.

## Como adicionar/remover tipos no futuro

1. Criar/remover na UI do Notion (database `d54e5911...`)
2. **Atualizar a constante `TIPOS_VALIDOS`** no nó "Claude API" do workflow v3.
   Está hardcoded, então o bot só conhece os tipos que estão na constante.
   Não dá pra confiar 100% em fetch dinâmico porque task-runner mata o cache rápido.
3. Pra UI da dashboard não precisa mexer — `/api/notion/tipos` lê o schema do Notion direto.

## Como adicionar um novo grupo

1. Criar o grupo no WhatsApp, adicionar o número da Evolution
2. Pegar o JID (formato `120363xxxxx@g.us`)
3. `/admin` → aba Grupos → Adicionar grupo (preenche nome, chat_id)
4. Editar → ativar toggles que quiser → escolher tipos
5. Pronto

Não precisa mexer em nenhum nó do N8N — o fan-out lê do banco a cada execução.

## Pegadinhas

- **Mudou o tipo da `Marca Ok no Notion`?** Se a resposta do PATCH parar de incluir
  `properties.Tipo`, o `Decide Notif Ok` recebe `tipoTarefa=''` e grupos com filtro
  ativo *pulam* (porque sem tipo identificado não há como saber se bate). Então:
  garantir que o PATCH sempre devolve a página atualizada (Notion devolve por padrão).
- **chat_id vazio não dispara mensagem**: filtra na query.
- **Grupo origem da OK não recebe sua própria notificação** (evita duplicar pra quem
  acabou de mandar a mensagem que disparou o OK).

## Validação

Roteiro de teste manual:
1. `/admin` → aba Grupos → 4 grupos pré-cadastrados aparecem
2. Editar "Nego's Sub" (designer): chat_id, ativar Entrega+OK, escolher tipos
   (Carimbo, Adesivo, Fachada, etc.)
3. Pedir ao bot pra criar tarefa "Carimbo da Dr. Ana pra sexta" → tool cria com Tipo=Carimbo
4. Marcar essa tarefa como OK no Notion → notificação chega só no Designer
5. Criar tarefa "Internet caiu para cliente X" → Tipo=Internet → OK chega só no grupo Internet
6. Tentar pedir tipo absurdo "abre tarefa de planeta marte" → tool valida e bot pede
   esclarecimento

## Arquivos relevantes

- `dashboard/app/api/grupos/route.js` — schema (com migrate ALTER TABLE)
- `dashboard/app/api/grupos/[id]/route.js` — PUT aceita `tipos_filtro_*`
- `dashboard/app/api/notion/tipos/route.js` — endpoint que lê schema do Notion
- `dashboard/app/admin/page.jsx` — UI da aba Grupos
- N8N: nó `Claude API` (agent loop, constante `TIPOS_VALIDOS`)
- N8N: nó `Decide Notif Ok` (fan-out)
- N8N: nó `Busca Config Notif Ok` (query atualizada)

## Estado dos custos / rate limits

Bot agora roda com:
- Modelo `claude-haiku-4-5-20251001`
- POPs limitado a top 5 (era todos os relevantes — antes ~24)
- Histórico Redis: últimas 8 mensagens (era 20)
- `chamados.ai_context`: truncado em 8k chars (era 30k)
- Tarefas Notion: removidas do prefetch, viraram tool `listar_tarefas_notion`
- Retry no 429 com 25s de backoff

Por mensagem ~6-8k tokens input. Cabe no tier 1 da Anthropic (50k/min para Haiku).
