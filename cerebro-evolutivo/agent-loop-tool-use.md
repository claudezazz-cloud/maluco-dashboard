# Agent Loop com tool_use (v3)

**Workflow:** `Pj5SdaxFh9H9EIX4` (Maluco Bot v3 tool_use)
**Modelo:** `claude-haiku-4-5-20251001`

## Onde mora

O nó `Claude API` do v3 é um **Code node** que roda o agent loop completo:

1. Lê `claudeBody` do *Monta Prompt* (sistema + mensagens montadas). O input também contém `chatId` (usado pela tool `criar_lembrete`).
2. Adiciona o array `tools` no body.
3. Chama `https://api.anthropic.com/v1/messages` via `this.helpers.httpRequest`.
4. Se `stop_reason === 'tool_use'`, executa **todas** as tools do turno em sequência, anexa os `tool_result`, chama de novo. Limite: 5 iterações.
5. Quando o modelo encerra com `end_turn`, devolve `{ content, usage }` no mesmo formato anterior — *Parse Resposta* segue inalterado.

Retry automático em 429 (espera 25s).

## 7 tools expostas

| # | name | Função | Endpoint |
|---|---|---|---|
| 1 | `buscar_cliente(q)` | Lookup de cliente Zazz por nome ou código. | dashboard `/api/clientes/buscar` |
| 2 | `criar_tarefa_notion(...)` | Cria tarefa no Notion DB de Tarefas. `tipo` é enum dos tipos válidos. `valor` é number. | Notion API direto |
| 3 | `resolver_tarefa_notion(page_id)` | PATCH `status=Ok` numa tarefa do Notion. | Notion API direto |
| 4 | `listar_tarefas_notion(status?)` | Lista até 50 tarefas do Notion (filtra por status). | Notion API direto |
| 5 | `aprender_fato(...)` | Upsert de fato durável em `bot_memoria_longa`. | dashboard `/api/memoria/aprender` |
| 6 | `corrigir_fato(...)` | Desativa fato errado (ILIKE) + salva versão corrigida com `validado_por=user`. | dashboard `/api/memoria/corrigir` |
| 7 | `criar_lembrete(mensagem, agendar_para, criado_por?)` | Agenda mensagem automática no grupo atual para follow-up de promessas. | dashboard `/api/lembretes` |

Schemas completos no código do nó Claude API (`v3_dump/agent_loop_code.js` no VPS em `/opt/zazz/dashboard/v3_dump/`).

### Regras importantes

- **`criar_tarefa_notion`**:
  - `tipo` é enum com `TIPOS_VALIDOS` (case-sensitive). Atualizar quando criar/remover tipo no Notion.
  - `valor: number` — preço vai aqui, NÃO em descricao/obs.
  - Se `tipo=Internet` → chamar `buscar_cliente` antes. Se outro tipo (designer/loja) → nome literal do WhatsApp.

- **`aprender_fato`**: bot decide proativamente. Idempotente (UNIQUE entidade_tipo+id+fato → incrementa ocorrencias). Aprende proativamente sobre clientes internet (quedas, equipamento, inadimplência, preferência de técnico).

- **`corrigir_fato`**: dois modos — (1) usuário aponta explicitamente; (2) autônomo: bot detecta contradição entre mensagem e memória e corrige silenciosamente ANTES de responder. Não lista o que corrigiu.

- **`criar_lembrete`**: usa `chatId` do input para resolver o grupo via `/api/lembretes` → insere em `mensagens_agendadas`. Disparado quando bot detecta promessa ("amanhã faço", "deixa comigo", etc.).

- **`resolver_tarefa_notion`**: NÃO envia notificação imediata. Polling do workflow `Urf233bK6RqoSlQs` (≤5min) detecta e notifica grupos com filtro de tipo.

- **Tools em paralelo**: o modelo pode chamar múltiplas tools no mesmo turno. O loop processa todas antes de chamar Claude de novo. System prompt instrui explicitamente a paralelizar quando as tools não dependem uma da outra.

## Deploy do agent_loop_code.js

⚠️ O arquivo contém API keys hardcoded — **não vai pro git** (está em `.gitignore`).

Fluxo de deploy:
```bash
# No VPS: atualiza o código no SQLite do N8N
VOLUME=/var/lib/docker/volumes/n8n_data/_data
docker stop n8n-n8n-1
cp /opt/zazz/dashboard/v3_dump/agent_loop_code.js /tmp/new_code.js
python3 /opt/zazz/dashboard/v3_dump/update_n8n_node.py  # se existir
# OU: editar direto no N8N UI → nó "Claude API" → colar o código
docker start n8n-n8n-1
```

Método alternativo (usado em 2026-05-02): copiar SQLite para host, editar via Python + sqlite3, substituir no volume com `chown ubuntu:ubuntu`, reiniciar N8N.

## Deploy do system prompt

N8N API key expira (JWT com exp ~3 meses). Quando expirar, usar deploy direto via psql:

```bash
ssh root@195.200.7.239 "python3 - <<'PYEOF'
import subprocess
with open('/opt/zazz/dashboard/v3_dump/sysprompt_v3.txt', 'r') as f:
    prompt = f.read()
escaped = prompt.replace(\"'\", \"''\")
sql = f\"UPDATE dashboard_config SET valor = '{escaped}' WHERE chave = 'system_prompt';\"
subprocess.run(['docker', 'exec', '-i', 'n8n-postgres-1', 'psql', '-U', 'zazz', '-d', 'zazzdb'],
    input=sql.encode(), capture_output=True, timeout=30)
print('ok')
PYEOF
"
```

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

Cache da Anthropic (5min TTL): após o 1º hit, repetições a 0.1× do custo.

## Pegadinhas

- Top-level `await` funciona no Code v2 (envelopa em async function).
- O nó precisa **manter o nome `Claude API`** ou todas as conexões quebram.
- Se trocar o schema das tools, atualizar o system prompt na mesma deploy.
- `MAX_ITER = 5` (rodadas de tool_use, não calls individuais). Se entrar em loop, devolve fallback.
- `this.helpers.httpRequest` — não usar `fetch` (sandbox não expõe). Capturado em `_helpers = this.helpers` no top-level.
- API keys hardcoded no código do nó (NOTION_TOKEN, DASH_TOKEN, API_KEY).
- `chatId` vem em `$input.first().json.chatId` (output do Monta Prompt confirmado).
