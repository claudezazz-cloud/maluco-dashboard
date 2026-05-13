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

## 9 tools expostas (mai/2026)

| # | name | Função | Endpoint |
|---|---|---|---|
| 1 | `buscar_pop(titulo)` | Busca conteúdo completo de um POP da Zazz. Usa exact→ILIKE→ts_rank. | dashboard `/api/pops/buscar` |
| 2 | `buscar_chamados()` | Busca status dos chamados técnicos (suporte de internet). Sem parâmetros. | dashboard `/api/chamados/buscar` |
| 3 | `buscar_cliente(q)` | Lookup de cliente Zazz por nome ou código. Busca por palavras individuais (AND). | dashboard `/api/clientes/buscar` |
| 4 | `criar_tarefa_notion(...)` | Cria tarefa no Notion DB. `tipo` é enum. `valor` é number. | Notion API direto |
| 5 | `resolver_tarefa_notion(page_id)` | PATCH `status=Ok` numa tarefa do Notion. | Notion API direto |
| 6 | `listar_tarefas_notion(status?)` | Lista até 50 tarefas do Notion (filtra por status). | Notion API direto |
| 7 | `aprender_fato(...)` | Upsert de fato durável em `bot_memoria_longa`. | dashboard `/api/memoria/aprender` |
| 8 | `corrigir_fato(...)` | Desativa fato errado (ILIKE) + salva versão corrigida com `validado_por=user`. | dashboard `/api/memoria/corrigir` |
| 9 | `criar_lembrete(...)` | ⚠️ EM STANDBY desde 04/05/2026. | dashboard `/api/lembretes` |

Schemas completos no código do nó Claude API (`v3_dump/agent_loop_code.js` no VPS em `/opt/zazz/dashboard/v3_dump/`).

## Arquitetura: contextos como tools (mai/2026)

Para evitar 429 por excesso de tokens (o N8N estava injetando 62k tokens/request), migramos contextos grandes para tools sob demanda:

| Contexto | Antes | Agora |
|---|---|---|
| POPs | ~45k chars injetados (todos os POPs) | Só títulos (~500 chars) + tool `buscar_pop` |
| Chamados | ~30k chars injetados sempre | Removido do prompt + tool `buscar_chamados` |

**Monta_Prompt.js e Monta_Prompt_Relatorio (mai/2026 → mai/2026):**

**Isolamento de tarefas por grupo (13/05/2026):**
- `Busca Grupo Atual` SQL atualizado → inclui `tipos_filtro_entrega`
- `Monta_Prompt.js` faz chamada HTTP ao endpoint `/api/grupos/tipos?chatId=...` via `this.helpers.httpRequest` no início do código (antes de montar tarefasContext)
- Filtra `results` do Notion para só incluir tarefas cujo tipo está em `grupos_whatsapp.tipos_filtro_entrega` do grupo atual
- `listar_tarefas_notion` TOOL no agent_loop também filtra pelo mesmo endpoint
- Endpoint: `GET /api/grupos/tipos?chatId=...` → `{tipos: ['Internet', ...]}` (autenticado com `x-token`)
- **Pegadinha:** `_vM_early` não existe na linha 40 onde o código roda — usar `$('Verifica Menção').first().json?.chatId` diretamente

**Monta_Prompt.js e Monta_Prompt_Relatorio (mai/2026):**
- `chamadosContext` = vazio — tool `buscar_chamados` sob demanda
- `tarefasContext` = bloco DINÂMICO (não invalida cache)
- `resolvidosContext` = bloco DINÂMICO (não invalida cache)
- `evolutivoSection` = bloco DINÂMICO (notas Obsidian variam por mensagem via semantic search)
- POPs = APENAS TÍTULOS para TODOS os POPs (incluindo LEIA SEMPRE)
  - LEIA SEMPRE marcados com ⚠️ → bot chama buscar_pop obrigatoriamente antes de responder
  - Outros POPs → bot chama buscar_pop antes de orientar qualquer processo
- `popsUsados = todosOsPops.map(p => p.titulo).join(', ')` — não vazio (era bug que zerava o campo no dashboard)
- `redisHistory.slice(-10)` (era -20)
- Ambos os nós usam o MESMO código — `deploy_workflow.py` atualiza os 2 juntos

**Por que o cache importa:** bloco estável vai com `cache_control: ephemeral`. Se dados dinâmicos (tarefas Notion, chamados resolvidos, EVOLUTIVO) ficam no estável, o cache invalida a cada request → todos os tokens contam como input (era 30k-60k). Com cache funcionando: só ~4-6k tokens_input no primeiro hit, ~1-2k em hits subsequentes.

**Bloco estável (cacheable):** system prompt template + POPs títulos + colaboradores = ~24k chars
**Bloco dinâmico (input real):** evolutivo + memoria + resolvidosHoje + tarefas + histórico + regras + skill = ~16k chars

**Regra:** qualquer dado que muda entre requests NÃO deve ficar no bloco estável. Mover para dinâmico ou tool.

**Resultado mai/2026 (após fix workflow_history + popsUsados + EVOLUTIVO dinâmico):**
| Métrica | Antes | Depois |
|---|---|---|
| tokens_input "oi" | 30.866 | 6.822 |
| Modelo executado | claude-sonnet-4-6 | claude-haiku-4-5-20251001 |
| System size | 79.990 | 40.789 |
| chamadosCarregados | SIM (7398 chars) | NAO |
| pops_usados (DB) | vazio (bug) | titles list ✓ |

## Regras importantes das tools

### `criar_tarefa_notion`
- `tipo` é enum com `TIPOS_VALIDOS` (case-sensitive). Atualizar quando criar/remover tipo no Notion.
- `valor: number` — preço vai aqui, NÃO em descricao/obs.
- Se `tipo=Internet` → chamar `buscar_cliente` antes. Se outro tipo (designer/loja) → nome literal do WhatsApp.

### `aprender_fato`
- Bot decide proativamente. Idempotente (UNIQUE entidade_tipo+id+fato → incrementa ocorrencias).
- **REGRA OBRIGATÓRIA:** ao criar tarefa de Internet para cliente identificado, chamar `aprender_fato` em paralelo com `criar_tarefa_notion`. Exemplo: tarefa "Sem internet - Sergio Carlos de Sousa" → também `aprender_fato('cliente','30829 - Sergio Carlos de Sousa','já relatou sem internet em chamados anteriores',5,'problema')`.
- Fatos NÃO devem conter datas hardcoded (ex: NÃO usar `'relatou sem internet em 03/05/2026'`). Fatos são duráveis — datas os tornam únicos a cada chamado, inflando a memória com ruído.
- Usar `entidade_id` no formato `'código - nome completo'` quando tiver o código.
- Aprende sobre: quedas, lentidão, equipamento, inadimplência, preferência de técnico.

### `corrigir_fato`
- Modo 1: usuário aponta erro explicitamente.
- Modo 2: autônomo — bot detecta contradição entre mensagem atual e memória → corrige ANTES de responder, SEM listar o que corrigiu em texto.
- Corrigir SOMENTE o que foi explicitamente contradito. Máximo 2-3 chamadas. NÃO inventar correções.

### `criar_lembrete`
- Usa `chatId` do input para resolver o grupo via `/api/lembretes` → insere em `mensagens_agendadas`.
- Cron de 1 em 1 minuto no VPS processa e envia via Evolution API.
- Disparado quando bot detecta promessa ("amanhã faço", "deixa comigo", etc.).

### `resolver_tarefa_notion`
- NÃO envia notificação imediata. Polling do workflow `Urf233bK6RqoSlQs` (≤5min) detecta e notifica.

### Tools em paralelo
- O modelo pode chamar múltiplas tools no mesmo turno. O loop processa todas antes de chamar Claude de novo.
- System prompt instrui explicitamente a paralelizar quando as tools não dependem uma da outra.
- Exemplo: criar tarefa + aprender_fato podem ser disparadas juntas no mesmo turno.

## Calendário de datas relativas (Monta Prompt)

O nó *Monta Prompt* gera `proximosDias` — array dos próximos 8 dias com dia da semana e data — e injeta via placeholder `{{PROXIMOS_DIAS}}` no system prompt. Isso evita que o bot calcule datas manualmente e erre (ex: achar que segunda = dia+1).

Formato injetado no system prompt:
```
CALENDÁRIO — próximos 8 dias:
domingo = 03/05/2026
segunda-feira = 04/05/2026
...
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

Placeholders do system prompt: `{{DATA}}` `{{ANO}}` `{{TODAY}}` `{{PROXIMOS_DIAS}}` `{{COLABORADORES}}` `{{CLIENTES}}` `{{POPS}}` `{{HISTORICO}}` `{{REGRAS}}`

## Deploy do agent_loop_code.js

⚠️ O arquivo contém API keys hardcoded — **não vai pro git** (está em `.gitignore`).

Método via SQLite (quando API key N8N expirada):
```bash
VOLUME=/var/lib/docker/volumes/n8n_data/_data
docker stop n8n-n8n-1
# editar /opt/zazz/dashboard/v3_dump/agent_loop_code.js
python3 -c "
import json, sqlite3
with open('/opt/zazz/dashboard/v3_dump/agent_loop_code.js') as f: code = f.read()
con = sqlite3.connect('$VOLUME/database.sqlite')
cur = con.cursor()
cur.execute(\"SELECT nodes FROM workflow_entity WHERE id='Pj5SdaxFh9H9EIX4'\")
nodes = json.loads(cur.fetchone()[0])
for n in nodes:
    if n.get('name') == 'Claude API': n['parameters']['jsCode'] = code
cur.execute(\"UPDATE workflow_entity SET nodes=? WHERE id='Pj5SdaxFh9H9EIX4'\", (json.dumps(nodes),))
con.commit(); con.close(); print('ok')
"
chown ubuntu:ubuntu $VOLUME/database.sqlite
docker start n8n-n8n-1
```

## Deploy do system prompt

N8N API key expira (JWT com exp ~3 meses). Quando expirar, usar deploy direto via psql (copiar script para o VPS e rodar):

```python
import subprocess
with open('/opt/zazz/dashboard/v3_dump/sysprompt_v3.txt', 'r') as f:
    prompt = f.read()
escaped = prompt.replace("'", "''")
sql = f"UPDATE dashboard_config SET valor = '{escaped}' WHERE chave = 'system_prompt';"
subprocess.run(['docker', 'exec', '-i', 'n8n-postgres-1', 'psql', '-U', 'zazz', '-d', 'zazzdb'],
    input=sql.encode(), capture_output=True, timeout=30)
```

## Pegadinhas

- Top-level `await` funciona no Code v2 (envelopa em async function).
- O nó precisa **manter o nome `Claude API`** ou todas as conexões quebram.
- Se trocar o schema das tools, atualizar o system prompt na mesma deploy.
- `MAX_ITER = 5` (rodadas de tool_use, não calls individuais). Se entrar em loop, devolve fallback.
- `this.helpers.httpRequest` — não usar `fetch` (sandbox não expõe). Capturado em `_helpers = this.helpers` no top-level.
- API keys hardcoded no código do nó (NOTION_TOKEN, DASH_TOKEN, API_KEY).
- `chatId` vem em `$input.first().json.chatId` (output do Monta Prompt confirmado).
- Modificar o Monta Prompt requer editar o SQLite do N8N e reiniciar o container (`docker restart n8n-n8n-1`).

---

**Ver também:** [[Workflow N8N]] · [[Prompt Caching]] · [[System Prompt]] · [[POPs]] · [[Chamados]] · [[Notion]] · [[deploy-workflow]] · [[tool-choice-forcado]]
