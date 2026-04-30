# Agent Loop com tool_use (v3)

A partir do workflow **Maluco Bot v3 (tool_use)** (id: `Pj5SdaxFh9H9EIX4`), o bot
deixou de emitir blocos `|||NOTION|||` / `|||NOTION_OK|||` em texto e passou a
chamar **ferramentas reais** (tool_use) durante a resposta.

## Onde mora

O nó *Claude API* do v3 deixou de ser HTTP Request e virou um **Code node** que
roda o agent loop completo:

1. Lê `claudeBody` do *Monta Prompt* (sistema + mensagens montadas).
2. Adiciona o array `tools` no body.
3. Chama `https://api.anthropic.com/v1/messages`.
4. Se `stop_reason === 'tool_use'`, executa a tool, anexa `tool_result`,
   chama de novo. Limite: 5 iterações.
5. Quando o modelo encerra com `end_turn`, devolve `{ content, usage }` no
   mesmo formato que a HTTP devolvia — *Parse Resposta* segue inalterado.

## Tools expostas

| name | função |
|---|---|
| `buscar_cliente(q)` | bate em `https://dashboard.../api/clientes/buscar` (lazy lookup, 0 prefetch). |
| `criar_tarefa_notion(...)` | POST direto na API do Notion (DB `d54e591...`). |
| `resolver_tarefa_notion(page_id)` | PATCH `status=Ok`. |

A chave Anthropic vive em `ANTHROPIC_API_KEY` no env do container N8N
(adicionada via `/docker/n8n/docker-compose.yml`). O Notion token e o
DASH_TOKEN ficam *hardcoded* no Code (mesma prática do antigo
*Cria no Notion1*).

## Por que mudou

- **Lazy load de clientes**: `{{CLIENTES}}` saiu do system prompt.
  Antes prefetchava centenas de linhas a cada mensagem; agora só busca quando
  precisa.
- **Notion via tool**: o modelo confirma a criação na hora (recebe
  `page_id` no `tool_result`) e pode encadear (criar + responder + perguntar).
- **Cache do prompt**: a parte estável continua em
  `cache_control: ephemeral` (Monta Prompt monta o array `system` com bloco
  estável + dinâmico).

## System prompt (dashboard_config.system_prompt)

O prompt v3 (`v3_dump/sysprompt_v3.txt`) substituiu a seção CLIENTES e os
blocos JSON `|||NOTION|||` / `|||NOTION_OK|||` por instruções de tool_use.
A seção 🛠️ FERRAMENTAS DISPONÍVEIS lista as três tools com regras de uso.

## Cutover (2026-04-30)

```
1. v2 (DiInHUnddtFACSmj) deactivate
2. UPDATE dashboard_config SET valor = pg_read_file('/tmp/sysprompt_v3.txt')
3. v3 (Pj5SdaxFh9H9EIX4) activate
```

Rollback: deactivate v3 + reactivate v2 + restaurar o prompt antigo
(o anterior está em `v3_dump/sysprompt_v2.txt`).

## Pegadinhas para futuras edições

- *Top-level await* funciona no Code v2 do N8N — ele envelopa em async function.
- `fetch` global está disponível (Node 20+).
- O nó precisa **manter o nome `Claude API`** ou todas as conexões vão quebrar
  (o N8N referencia por nome).
- Se mudar o schema das tools, ajuste o system prompt na mesma deploy:
  modelo confiando em descrição obsoleta vai escolher tool errada.
- O loop tem `MAX_ITER = 5`. Se o modelo entrar em loop, devolve mensagem de
  fallback. Em produção, vigiar tokens nas primeiras semanas — chamadas múltiplas
  = mais input_tokens (cada round reenvia o histórico).
