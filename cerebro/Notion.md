# Notion

← volta para [[Maluco da IA]] | tarefas em [[Solicitacoes Programadas]] e [[Workflow N8N]]

Integração com Notion pra criar tarefas automaticamente e consultar status.

## Três direções

### 1. Bot CRIA tarefas no Notion

Quando o Claude identifica que a mensagem do usuário pede pra abrir uma tarefa/chamado, retorna no output um marcador `|||NOTION|||{...json...}|||FIM|||` (um por tarefa).

No fluxo:
1. `Parse Resposta` extrai TODOS os blocos `|||NOTION|||` via `matchAll` → array `notionBodies`
2. `Tem Notion?` (IF, condição `hasNotion === true`) desvia pro ramo
3. `Explode Notions` (Code) recebe 1 item com array → emite N items, um por tarefa
4. `Cria no Notion1` (HTTP Request) → POST `https://api.notion.com/v1/pages` com Bearer token

### 2. Bot ATUALIZA tarefa pra "Ok" (status change)

Quando alguém confirma no chat que uma tarefa foi resolvida ("Sim, pode marcar", "tá feito", etc), o Claude emite `|||NOTION_OK|||{"page_id":"<id>","titulo":"...","cliente":"..."}|||FIM|||`.

Pré-requisito: o `Monta Prompt` envia `[id:<hash>]` no início de cada linha de tarefa pro Claude saber qual ID usar. O `tarefasContext` traz instruções explícitas sobre como emitir `NOTION_OK`.

No fluxo:
1. `Parse Resposta` extrai blocos `|||NOTION_OK|||` separadamente → array `notionOks`
2. `Tem Ok?` (IF, condição `hasOk === true`) desvia pro ramo
3. `Explode Oks` (Code) emite N items, um por OK
4. `Marca Ok no Notion` (HTTP PATCH) → `PATCH /v1/pages/{page_id}` com body `{"properties":{"status":{"select":{"name":"Ok"}}}}`

### 3. Bot LÊ tarefas do Notion

Nó `Busca Tarefas Notion` faz POST `/v1/databases/{db_id}/query` a cada execução, trazendo tarefas com status específicos (ex: "Em andamento", "Parado"). Resultado vai como `tarefasContext` pro [[System Prompt]].

Isso permite perguntar no WhatsApp: "tem tarefa parada?" ou "quais tarefas em andamento?" e o bot responde sem precisar ir no Notion.

## Configuração

| Variável | Valor |
|----------|-------|
| Token | Bearer token da integração Notion (precisa ter acesso à DB) |
| Database ID | ID da database onde criar/ler tarefas |
| Notion-Version | Header `2022-06-28` |

Token fica diretamente no nó (headers do HTTP Request). **Regenerar** em https://www.notion.so/profile/integrations se expirar.

## Problema conhecido

Token anterior (`ntn_401906...`) retornou 401 "API token is invalid". Gerar um novo na página de integrações do Notion e atualizar os nós `Cria no Notion1` e `Busca Tarefas Notion`.

## Cache

`tarefasContext` entra no **bloco cacheado** (ver [[Prompt Caching]]) — mudança de status é lenta (minutos/horas), então cache de 5min vale a pena.
