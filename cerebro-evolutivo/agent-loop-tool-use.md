# Agent Loop com tool_use (v3)

**Workflow:** `Pj5SdaxFh9H9EIX4` (Maluco Bot v3 tool_use)
**Modelo:** `claude-haiku-4-5-20251001` (cabe em tier 1 da Anthropic)

## Onde mora

O nó `Claude API` do v3 não é mais HTTP Request — virou **Code node** que roda
o agent loop completo:

1. Lê `claudeBody` do *Monta Prompt* (sistema + mensagens montadas).
2. Adiciona o array `tools` no body.
3. Chama `https://api.anthropic.com/v1/messages` via `this.helpers.httpRequest`.
4. Se `stop_reason === 'tool_use'`, executa a tool, anexa `tool_result`, chama
   de novo. Limite: 5 iterações.
5. Quando o modelo encerra com `end_turn`, devolve `{ content, usage }` no
   mesmo formato que a HTTP devolvia — *Parse Resposta* segue inalterado.

Tem retry automático em 429 (espera 25s — rate limit reseta por minuto).

## 6 tools expostas

| name | Função | Endpoint chamado |
|---|---|---|
| `buscar_cliente(q)` | Lookup lazy de cliente da Zazz por nome ou código. | dashboard `/api/clientes/buscar` |
| `criar_tarefa_notion(...)` | Cria tarefa nova no Notion DB de Tarefas. `tipo` é enum dos tipos válidos. | Notion API direto |
| `resolver_tarefa_notion(page_id)` | PATCH `status=Ok` numa tarefa do Notion. | Notion API direto |
| `listar_tarefas_notion(status?)` | Lista até 50 tarefas do Notion (filtra por status). | Notion API direto |
| `aprender_fato(...)` | Upsert de fato durável em `bot_memoria_longa`. | dashboard `/api/memoria/aprender` |
| `corrigir_fato(...)` | Desativa fato errado (ILIKE no texto) e opcionalmente salva versão correta com `validado_por=user`. | dashboard `/api/memoria/corrigir` |

Schemas completos no código do nó Claude API.

### Regras importantes

- **`criar_tarefa_notion`**:
  - Campo `tipo` é `enum` com a constante `TIPOS_VALIDOS` (case-sensitive,
    bate exato com o multi_select do Notion). Validação no handler antes do
    POST. Atualizar quando criar/remover tipo no Notion.
  - Campo `valor: number` (não string) — preço vai aqui, NÃO em descricao/obs.
    Handler aceita string e parseia ("R$ 90,00" → 90).
  - System prompt instrui: se `tipo=Internet`, chamar `buscar_cliente` antes pra
    pegar `código - nome completo`. Se `tipo=outro` (designer/gráfica), copia
    o nome literal que veio na mensagem.

- **`aprender_fato`**: bot decide proativamente. Idempotente
  (UNIQUE em entidade_tipo+id+fato → incrementa ocorrencias).

- **`resolver_tarefa_notion`**: NÃO envia notificação imediata. O polling do
  workflow `Urf233bK6RqoSlQs` em ≤5min detecta a edição e notifica os grupos
  com filtro de tipo aplicável.

## Por que não usa `fetch` nem `process.env`

Sandbox do task-runner do N8N não expõe `fetch` nem `process`. Workarounds:

- HTTP: `this.helpers.httpRequest(...)` — capturado em `_helpers` no top-level
  pra preservar o `this` dentro de funções.
- API key: hardcoded no código do nó (workflow JSON não vai pro git, mesmo padrão
  do Notion token e DASH_TOKEN).

## Arquitetura de prompt (Monta Prompt)

System prompt segue formato com cache:

```js
system: [
  { type: 'text', text: <bloco estável>, cache_control: { type: 'ephemeral' } },
  { type: 'text', text: <bloco dinâmico (memória, histórico, skill)> }
]
```

Estável = system_prompt + colaboradores + POPs + chamados.
Dinâmico = histórico + memoria_contexto + skill ativada.

Cache da Anthropic (5min TTL): após o 1º hit, repetições leem cache a 0.1× do
custo. Em rate limit, porém, contam ao preço cheio — por isso ainda foi preciso
limitar POPs a top 5 e cortar histórico a 8 msgs.

## Pegadinhas

- Top-level `await` funciona no Code v2 (envelopa em async function).
- O nó precisa **manter o nome `Claude API`** ou todas as conexões quebram
  (N8N referencia por nome).
- Se trocar o schema das tools, atualizar o system prompt na mesma deploy:
  modelo confiando em descrição obsoleta vai escolher tool errada.
- `MAX_ITER = 5`. Se o modelo entrar em loop, devolve mensagem de fallback.
- Vigiar tokens nas primeiras semanas — chamadas múltiplas = mais input_tokens
  (cada round reenvia o histórico).

## Cutover histórico (2026-04-30)

```
1. v2 (DiInHUnddtFACSmj) deactivate
2. UPDATE dashboard_config SET valor = <prompt v3> WHERE chave='system_prompt'
3. v3 (Pj5SdaxFh9H9EIX4) activate
```

Rollback: deactivate v3 + reactivate v2 + restaurar prompt antigo.
