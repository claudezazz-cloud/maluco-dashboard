# Auditoria de Bugs — Maio 2026

Auditoria completa do projeto realizada em 03/05/2026. Foram identificados e corrigidos 16 bugs (P0 críticos + P1 médios). Esta nota registra o que foi feito, por quê, e onde.

---

## Bugs Corrigidos - Final de Maio 2026

### Bug 17 — Claude API 400 (Extra inputs are not permitted) & Falso Deploy
**Arquivo:** `Parse_Resposta.js` e `deploy_fix_ts.py` (Novo)
**Problema:** A Anthropic bloqueou a injeção do campo `ts` que estava sendo enviado no histórico de conversas (`messages.0.ts`). O erro permanecia porque o script de deploy anterior (`deploy_full.py`) tinha a linha de atualização da tabela `workflow_history` comentada, resultando num "falso deploy" na VPS (o n8n roda o código dessa tabela).
**Fix:** Criado script `deploy_fix_ts.py` garantindo que o SQLite seja atualizado na `workflow_entity` e `workflow_history`. Limpeza das chaves no Redis afetadas (`conv:*`).

### Bug 18 — Claude API 401 (invalid x-api-key)
**Arquivo:** `agent_loop_code.js`
**Problema:** A chave da API da Anthropic usada hardcoded havia sido invalidada/bloqueada, gerando um erro 401 que quebrava o fluxo.
**Fix:** Substituída pela nova chave gerada pelo usuário, após teste local bem-sucedido com a plataforma Anthropic. Atualizado na VPS via o novo script de deploy.

### Bug 19 — Erro 'Cannot read properties of undefined (reading text)' em Parse Resposta
**Arquivo:** `Parse_Resposta.js`
**Problema:** Quando as mensagens do usuário eram muito diretas (e.g., pedindo criação de tarefa sem chat prévio), o Claude emitia um bloco *tool_use* imediatamente, não retornando nenhum bloco do tipo `text`. O parser quebrava ao tentar acessar `response.content[0].text`.
**Fix:** Alteração para iteração segura (`Array.isArray(response.content)`) que concatena apenas os blocos `type === 'text'`, e atribui texto vazio sem gerar erro (TypeError) caso só exista o *tool_use*.

### Bug 20 — AxiosError Status 400 'Text is required' (Webhook Whatsapp Vazio)
**Arquivo:** `Parse_Resposta.js`
**Problema:** Na consequência do Bug 19, quando o Claude emite apenas um `tool_use`, a string `whatsappMessage` ficava vazia (`""`). O node "Envia no whatsapp" enviava esse conteúdo nulo para a Evolution API, recebendo o erro `400 Bad Request: Text is required`.
**Fix:** Inclusão de fallback. Se `whatsappMessage` estiver nulo ou vazio após o parser, o sistema atribui automaticamente a mensagem "✅ Operação processada.", enviando feedback visual pro usuário no WhatsApp e evitando o crash da API de envio.

### Bug 21 — Ferramenta (Notion) ignorada devido a stop_reason = end_turn (Maluco Bot v3)
**Arquivo:** `agent_loop_code.js`
**Problema:** Quando a IA decidia chamar a ferramenta `criar_tarefa_notion`, a API da Anthropic às vezes retornava `stop_reason: end_turn` em vez de `tool_use`, embora ainda incluísse o bloco de ferramenta na resposta. Como a validação antiga no loop era estritamente `if (resp.stop_reason === 'tool_use')`, o sistema ignorava o bloco da ferramenta, quebrava o loop e não executava a ação no Notion (resultando no feedback "✅ Operação processada" falso).
**Fix:** Refatorado o loop interno para ser mais resiliente (`if (resp.stop_reason === 'tool_use' || teveToolUse)`), forçando a execução da ferramenta sempre que um bloco `tool_use` for detectado, independente do `stop_reason` retornado. Adicionada defesa para evitar encerramento silencioso caso o loop exceda o `MAX_ITER`.

### Bug 22 — Falso positivo na detecção de "hallucination" de ferramentas
**Arquivo:** `agent_loop_code.js`
**Problema:** O bot estava acusando o próprio Claude de "alucinar" (dizendo: *Você afirmou que criou um lembrete mas não chamou a tool*). Isso ocorria porque a variável `teveToolUse` era reavaliada em cada turno. Se o Claude usasse a ferramenta no turno 1 e no turno 2 apenas respondesse dizendo "Lembrete criado com sucesso", o código via a palavra "criado", via que no turno 2 não tinha bloco de ferramenta (`teveToolUse = false`), e disparava a bronca injustamente.
**Fix:** Adicionadas variáveis globais ao loop (`chamouLembrete` e `chamouTarefa`) que rastreiam se a ferramenta foi chamada em **qualquer** turno da iteração atual, impedindo que o bot brigue com a IA por apenas estar confirmando uma ação que já foi concluída.

---

## P0 — Críticos (todos corrigidos)

### Bug 1 — Race condition em mensagens-agendadas/processar
**Arquivo:** `dashboard/app/api/mensagens-agendadas/processar/route.js`

**Problema:** Cron executava a cada 1 minuto. Se envio de 50 mensagens levasse mais de 60s, o próximo cron lia os mesmos itens com `status='pendente'` e duplicava o envio no WhatsApp.

**Fix:** Atomic claim via `FOR UPDATE SKIP LOCKED`:
```sql
UPDATE mensagens_agendadas
SET status = 'processando'
WHERE id IN (
  SELECT id FROM mensagens_agendadas
  WHERE status = 'pendente' AND agendar_para <= NOW()
  ORDER BY agendar_para ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 50
)
RETURNING *
```
Cada worker pega somente itens que não estão sendo processados por outro. Após sucesso: `status='enviado'`. Após erro: se `tentativas < 3`, volta a `pendente` com `agendar_para = NOW() + interval '5 minutes'`; se `>= 3`, marca `erro` permanente.

Nova coluna: `tentativas INT DEFAULT 0` (adicionada via `ADD COLUMN IF NOT EXISTS`).

---

### Bug 2 — tarefas/cobrar não-idempotente
**Arquivo:** `dashboard/app/api/tarefas/cobrar/route.js`

**Problema:** Cron das 8h15 + chamada manual no mesmo dia criava múltiplas mensagens duplicadas em `mensagens_agendadas` para o mesmo grupo.

**Fix:** Nova coluna `dedup_key VARCHAR(255)` com `UNIQUE CONSTRAINT` (não partial index — partial index não funciona com `ON CONFLICT (column)`):
```sql
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uk_mensagens_dedup'
  ) THEN
    ALTER TABLE mensagens_agendadas ADD CONSTRAINT uk_mensagens_dedup UNIQUE (dedup_key);
  END IF;
END $$
```
Chave: `'cobrar:YYYY-MM-DD:grupo_id'`. Insert usa `ON CONFLICT (dedup_key) DO NOTHING` — segunda execução no mesmo dia não insere nada.

---

### Bug 3 — Snapshot órfão no notion_tarefas_snapshot
**Arquivo:** `dashboard/app/api/notion/sync-snapshot/route.js`

**Problema:** Tarefa arquivada/deletada no Notion sumia do resultset, mas linha permanecia no snapshot para sempre. Snapshot crescia indefinidamente; se a tarefa fosse re-aberta, comparação contra snapshot stale gerava falsos positivos.

**Fix:** Após o loop principal, coleta todos os `page_id` vistos naquela rodada e deleta os ausentes:
```js
if (pageIdsVistos.size > 0) {
  const ids = [...pageIdsVistos]
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(',')
  await query(`DELETE FROM notion_tarefas_snapshot WHERE page_id NOT IN (${placeholders})`, ids)
}
```
Guard `pageIdsVistos.size > 0` protege contra Notion API retornando 200 vazio (o que deletaria tudo).

---

### Bug 4 — Race em sync-snapshot (re-notificação)
**Arquivo:** `dashboard/app/api/notion/sync-snapshot/route.js`

**Problema:** UPDATE do snapshot acontecia DEPOIS do envio para Evolution API. Se envio de 5 grupos × N mudanças levasse mais de 5 minutos, o próximo cron achava as mesmas mudanças e renotificava.

**Fix:** Snapshot é atualizado ANTES de enviar. As notificações são acumuladas em `notificacoesPendentes[]`, snapshot atualizado no DB, depois o array é enviado para a Evolution API.

---

### Bug 5 — Lembrete em horário errado por timezone
**Arquivo:** `dashboard/app/api/lembretes/route.js`

**Problema:** System prompt instruía o bot a passar `"2026-05-03T09:00:00"` sem offset. VPS está em UTC → `new Date("2026-05-03T09:00:00")` = 09:00 UTC = 06:00 BRT. Lembrete saía 3h antes.

**Fix duplo:**

1. **Handler defensivo** — se `agendar_para` não tem offset/Z, trata como BRT:
```js
const hasOffset = /[Zz]|[+-]\d{2}:\d{2}$/.test(agendarRaw)
const agendar_para = hasOffset ? agendarRaw : `${agendarRaw}-03:00`
```

2. **System prompt** — exemplos agora incluem `-03:00`:
```
agendar_para: "2026-05-03T09:00:00-03:00"
```

---

### Bug 6 — Default de responsável conflitante
**Arquivo:** `v3_dump/agent_loop_code.js` (no VPS via N8N SQLite)

**Problema:** 3 fontes discordantes: prompt dizia "atribua por tipo", schema dizia "default franquelin", handler usava `'franquelin, victor'` em um path e só `'franquelin'` em outro. Bot atribuía errado quando nada era especificado.

**Fix:** Handler padronizado para `default 'franquelin'` em todos os paths. System prompt atualizado para explicar regra de atribuição por tipo sem contradições. Removido `'franquelin, victor'` como default.

Deploy: `python3 /tmp/patch_responsavel.py` → SQLite N8N → `docker restart n8n-n8n-1`.

---

## P1 — Médios (todos corrigidos)

### Bug 7 — sync-snapshot sem filtro por tipo de tarefa
**Arquivo:** `dashboard/app/api/notion/sync-snapshot/route.js`

**Problema:** Notificava todos os grupos com `alertas_notion_entrega=true` sem considerar `tipos_filtro_entrega`. O workflow `Urf233bK6RqoSlQs` filtrava por tipo — comportamento divergente.

**Fix:** Ao detectar mudança, resolve grupos destinatários com intersecção de tipos:
```js
const tiposTarefa = t.tipo ? t.tipo.split(', ').map(s => s.trim()) : []
const gruposDestino = grupos.filter(g => {
  const filtros = g.tipos_filtro_entrega || []
  return filtros.length === 0 || tiposTarefa.some(tt => filtros.includes(tt))
})
// Fallback: se sem destino, vai para grupos bom_dia=true
const chatIdsDestino = gruposDestino.length > 0
  ? gruposDestino.map(g => g.chat_id)
  : gruposBomDia.rows.map(g => g.chat_id)
```

---

### Bug 8 — Mensagens com erro nunca retentadas
**Arquivo:** `dashboard/app/api/mensagens-agendadas/processar/route.js`

**Problema:** Erro transitório (Evolution API 502/timeout) marcava `status='erro'` permanente — mensagem nunca mais era enviada.

**Fix:** Coluna `tentativas INT DEFAULT 0`. Em erro: se `tentativas < 3`, volta a `pendente` com backoff de 5 minutos. Só marca `erro` definitivo na 3ª falha.

---

### Bug 9 — Paginação Notion ausente
**Arquivos:** `tarefas/cobrar/route.js`, `notion/sync-snapshot/route.js`

**Problema:** Ambos usavam `page_size: 100` sem loop de paginação. Tarefas além do limite sumiam silenciosamente.

**Fix:** Loop `while (hasMore)` com `start_cursor`:
```js
let hasMore = true
let startCursor = undefined
while (hasMore) {
  if (startCursor) body.start_cursor = startCursor
  const data = await res.json()
  results.push(...(data.results || []))
  hasMore = data.has_more || false
  startCursor = data.next_cursor
}
```
Implementado em `fetchAllTarefas()` e `fetchTarefasVencidas()`.

---

### Bug 10 — buscar_cliente sem normalização de acento
**Arquivo:** `dashboard/app/api/clientes/buscar/route.js`

**Problema:** `"sergio"` não encontrava `"Sérgio"`. ILIKE só faz case-insensitive, não acento-insensitive. Busca por nome composto também não funcionava (ex: "sergio carlos sousa" não achava "Sergio Carlos de Sousa").

**Fix:**
- Extensão `unaccent` habilitada no Postgres: `CREATE EXTENSION IF NOT EXISTS unaccent`
- Split por palavras para AND match: cada word vira uma cláusula `AND unaccent(LOWER(nome)) LIKE '%' || unaccent(LOWER($N)) || '%'`
- Guard contra query vazia: `if (words.length === 0) return NextResponse.json({ resultados: [], total: 0 })`

---

### Bug 11 — Timezone hardcoded em solicitacoes/n8n
**Arquivo:** `dashboard/app/api/solicitacoes/n8n/route.js`

**Problema:** `new Date(Date.now() - 3*3600*1000)` assume servidor sempre em UTC e Brasil sempre UTC-3 (quebra com horário de verão ou mudança de TZ do servidor).

**Fix:** `Intl.DateTimeFormat` com `timeZone: 'America/Sao_Paulo'` — robusto e correto em qualquer TZ do servidor:
```js
const fmtParts = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  weekday: 'short', hour: '2-digit', minute: '2-digit'
}).formatToParts(new Date())
```

---

### Bug 12 — dias_semana LIKE com matches falsos
**Arquivo:** `dashboard/app/api/solicitacoes/n8n/route.js`

**Problema:** `dias_semana LIKE '%seg%'` podia casar com qualquer substring inesperada.

**Fix:** `$2 = ANY(string_to_array(dias_semana, ','))` — match exato de elemento em lista CSV.

---

### Bug 13 — Tools numeradas fora de ordem no system prompt
**Arquivo:** `v3_dump/sysprompt_v3.txt`

**Problema:** "Você tem 7 ferramentas" mas numeração era 1, 2, 3, 5, 6, 4, 7 — pulava o 4 e usava fora de ordem.

**Fix:** Renumeradas sequencialmente 1-7. Deploy via psql direto no banco.

---

### Bug 14 — aprender_fato inflando memória com datas dinâmicas
**Arquivos:** `v3_dump/sysprompt_v3.txt`, `cerebro-evolutivo/agent-loop-tool-use.md`

**Problema:** Exemplo mostrava `'relatou sem internet em 03/05/2026'`. Como UNIQUE inclui o campo `fato`, cada chamado com data diferente virava um fato novo — memória do cliente virava ruído com dezenas de entradas idênticas.

**Fix:** Exemplo trocado para `'já relatou sem internet em chamados anteriores'` — idempotente, incrementa `ocorrencias` em vez de criar duplicata. Regra documentada: fatos duráveis NÃO devem conter datas hardcoded.

---

### Bug 15 — Bot calculava datas erradas ("segunda = 03/05" em vez de 04/05)
**Arquivos:** `v3_dump/sysprompt_v3.txt`, N8N Monta Prompt (SQLite)

**Problema:** Bot recebia `{{DATA}} = sábado, 02/05/2026` e tentava calcular "próxima segunda-feira" somando dias — resultava em data errada.

**Fix:** Monta Prompt gera calendário de 8 dias e injeta como `{{PROXIMOS_DIAS}}`:
```
Seg 04/05, Ter 05/05, Qua 06/05, ...
```
Bot consulta a tabela em vez de calcular. System prompt atualizado para instruir uso de `{{PROXIMOS_DIAS}}` ao referenciar dias futuros.

---

### Bug 16 — Tarefa sem destino silenciosamente perdida
**Arquivo:** `dashboard/app/api/tarefas/cobrar/route.js`

**Problema:** Tarefa com `tipos=[]` sem grupo `bom_dia=true` era simplesmente ignorada — ninguém sabia.

**Fix:** Array `tarefas_sem_destino` retornado no JSON da resposta. Log no cron VPS captura e exibe quando `> 0`.

---

## toDateOnly — função crítica

Bugfix transversal ao `sync-snapshot`. Notion retorna datetime ISO (`"2025-03-24T16:00:00.000Z"`), snapshot armazena `DATE` no Postgres (que o driver JS devolve como objeto `Date`). Comparação direta sempre resultava em diff falso, gerando spam de notificação a cada 5 minutos.

**Fix:** Função `toDateOnly(d)` que trata ambos os casos:
```js
function toDateOnly(d) {
  if (!d) return null
  if (d instanceof Date) return d.toISOString().split('T')[0]
  return String(d).split('T')[0]
}
```
Usado em todos os pontos de comparação de datas no sync-snapshot.

---

---

## Bugs pós-auditoria (03/05/2026 — sessão contínua)

### Bug 17 — Tabela mensagens_agendadas nunca criada
**Descoberto em:** 03/05/2026 durante teste de criar_lembrete

**Problema:** A tabela `mensagens_agendadas` não existia no banco de produção. Toda chamada à tool `criar_lembrete` fazia POST em `/api/lembretes`, que tentava INSERT e recebia erro 500. O bot recebia o erro, hallucinava "✅ Lembrete criado" ou dizia "a ferramenta não está disponível", nunca criando de verdade.

**Fix:** Tabela criada manualmente via psql:
```sql
CREATE TABLE mensagens_agendadas (
  id SERIAL PRIMARY KEY,
  grupo_id INTEGER REFERENCES grupos_whatsapp(id),
  mensagem TEXT NOT NULL,
  agendar_para TIMESTAMP WITH TIME ZONE NOT NULL,
  status VARCHAR(20) DEFAULT 'pendente',
  criado_por VARCHAR(100) DEFAULT 'bot',
  tentativas INTEGER DEFAULT 0,
  dedup_key VARCHAR(255),
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT uk_mensagens_dedup UNIQUE (dedup_key)
);
CREATE INDEX idx_msg_agendadas_status ON mensagens_agendadas(status, agendar_para);
```

**Sintomas de hallucinação:** o bot via histórico Redis com 3 tentativas fracassadas e em cada nova tentativa adotava comportamento diferente: fingir sucesso → admitir falha → usar criar_tarefa_notion como workaround. Limpar o Redis (`DEL conv:{chatId}`) resolveu o contexto corrompido.

---

### Bug 18 — sysprompt: criar_lembrete sem instrução anti-hallucination
**Arquivo:** `v3_dump/sysprompt_v3.txt`

**Problema:** O bot alegava "a ferramenta não está disponível" e oferecia alternativas (criar tarefa no Notion) em vez de chamar `criar_lembrete`. Também não sabia que o lembrete vai para o grupo (não DM), então ficava travado quando pediam lembrete "pros dois".

**Fix:** Adicionado ao prompt:
- `NUNCA diga que a tool não está disponível — ela sempre funciona. Chame criar_lembrete e ponto.`
- `O lembrete é sempre enviado neste mesmo grupo. Se precisar cobrar duas pessoas, mencione os dois na mensagem.`

---

### Feature: Solicitações Temporárias no painel admin
**Arquivos:** `dashboard/app/api/mensagens-agendadas/route.js` (novo), `dashboard/app/admin/page.jsx`

**O que faz:** Seção abaixo dos Agendamentos na aba Solicitações do admin. Lista todas as mensagens `pendente`/`processando` da tabela `mensagens_agendadas` com horário (BRT), grupo, criado_por, tentativas e preview da mensagem. Botão Cancelar por item (muda status para `cancelado`).

**Auth:** `getSession()` + `requireAdmin(session)` — padrão do projeto. IMPORTANTE: `requireAdmin` recebe a session, não o `req`. Erro comum ao criar novas rotas admin.

---

### Melhoria: comandos dos relatórios automáticos
**Tabela:** `dashboard_solicitacoes_programadas` (IDs 3 e 5)

**Antes:** "caso haja pendencias, marque no notion sem exitar e sem perguntar para o usuário" — ambíguo, bot podia chamar `resolver_tarefa_notion` (marcar Ok) em vez de criar lembrete.

**Depois:**
- 11:40: cria tarefa no Notion + lembrete para daqui 2 horas cobrando o responsável
- 17:20: cria tarefa no Notion + lembrete para amanhã 08:15 cobrando o responsável

---

## Deploy realizado

- Dashboard (Next.js): `git pull && npm run build && pm2 restart maluco-dashboard`
- System prompt: `psql UPDATE dashboard_config SET valor=...`
- agent_loop_code.js: `python3 patch_responsavel.py` + SQLite N8N + docker restart
- Monta Prompt (PROXIMOS_DIAS): `python3 patch_monta_prompt.py` + SQLite N8N + docker restart
- Extensão unaccent: `CREATE EXTENSION IF NOT EXISTS unaccent` via psql no VPS

---

### Bug 19 — Redis contamination loop em criar_lembrete (2026-05-04)
**Arquivo:** `v3_dump/sysprompt_v3.txt`

**Problema:** Bot estava falhando em `criar_lembrete` e respondendo "a ferramenta de lembretes não tá funcionando". Redis do grupo Claudebot2 acumulou histórico das falhas anteriores — Claude lia suas próprias mensagens de erro anteriores no contexto e copiava o padrão sem sequer chamar a tool (`stop_reason: end_turn` sem `tool_use_block`). Efeito auto-reforçante: cada falha piorava o histórico.

**Fix:**
1. Adicionada regra no sysprompt: `IGNORE qualquer mensagem anterior sua dizendo "ferramenta não funciona / indisponível"` — isso era erro antigo já corrigido.
2. Redis do grupo limpo: `DEL conv:120363409735124488@g.us`

**Causa secundária:** sysprompt atualizado (linhas 165-167 com "lembrete pessoal") nunca tinha sido deployado ao DB. Deploy realizado em 2026-05-04 via psql.

**Reincidência (2026-05-04 11h):** Mesmo após o fix do sysprompt, o bug voltou. A regra textual no prompt não foi suficiente — Haiku continuou copiando o padrão "ferramenta tá fora" do histórico de mensagens do grupo (`Busca Histórico 10` puxa do PostgreSQL `mensagens`, não só do Redis).

**Fix definitivo:** scrub no `Monta_Prompt.js` — qualquer linha do histórico que contenha o regex `/(ferramenta|tool).{0,40}(fora do ar|indisponível|não respond|offline)/i` é substituída por `[resposta antiga do bot removida — bug de ferramenta corrigido]` antes de ser injetada no prompt. Defesa em profundidade: prompt + filtro de contexto. Deploy via SQLite do N8N (`docker stop` → patch nodes → `docker start`).

**Reincidência 2 (2026-05-04 11h18):** scrub do histórico em texto não bastou — o vetor real é o `redisHistory` indo como turnos `assistant` reais nas `messages` da API. Aplicado mesmo scrub no `redisHistory` (Monta_Prompt.js).

**Reincidência 3 / Bug 21 (2026-05-04 11h18 também):** após limpar contaminação de erro, surgiu hallucination de **sucesso** — Sonnet escreveu "📌 Lembrete criado para terça-feira 05/05 às 10:00" com `stop_reason: end_turn` e ZERO `tool_use` no turno. Confirmado via inspeção do `execution_data` no SQLite (execution 50641). O modelo copiou o padrão de resposta de turnos passados em vez de chamar a tool.

**Fix tripla camada (agent_loop_code.js):**
1. **`tool_choice` forçado** — regex `/me lembr|me avis|lembra eu|lembrete|fa[çc]a um lembret/` na última msg do user → injeta `tool_choice: { type: 'tool', name: 'criar_lembrete' }` na 1ª iteração. Sonnet obrigado a chamar a tool.
2. **Detector de hallucination** — se `end_turn` com texto "Lembrete criado/agendado/marcado" e sem `tool_use` no turno, reinjeta como user `"Você afirmou que criou um lembrete mas não chamou a tool"` e re-itera.
3. Scrub do `redisHistory` mantido como defesa upstream.

---

### Bug 22 — n8n não recarrega Code node após patch direto no SQLite (2026-05-04)
**Arquivo:** procedimento de deploy (CLAUDE.md, deploy_system_prompt scripts)

**Problema:** Ao patchar `nodes` JSON em `workflow_entity` via SQLite + `docker stop`/`docker start`, n8n inicia mas continua executando o código antigo do Code node. Verificado: SQLite tem o código novo (lido de volta), mas execution_data mostra comportamento velho. Os 3 fixes anteriores do Bug 19/21 ficaram inertes por isso — `tool_choice` nunca chegou no Anthropic API.

**Causa:** n8n só recompila Code nodes quando o workflow é (re)ativado. `updatedAt` é o sinal canônico de mudança; um UPDATE só na coluna `nodes` não dispara invalidação. Além disso, o WAL do SQLite pode reter alterações se n8n estava com a connection aberta no momento do patch.

**Fix (novo procedimento de deploy):**
1. `docker stop n8n-n8n-1`
2. `rm -f /var/lib/docker/volumes/n8n_data/_data/database.sqlite-{shm,wal}` — força flush
3. UPDATE atualiza `nodes`, `updatedAt=now()`, `active=0`
4. UPDATE separado: `active=1`
5. `docker start n8n-n8n-1`

Com toggle 0→1 + bump de `updatedAt` + WAL limpo, n8n re-registra triggers e recompila Code nodes. Confirmado nos logs: `Activated workflow "Maluco Bot v3 (tool_use)"`.

---

### Bug 23 — Caminho legacy `|||NOTION|||` no Parse_Resposta criava tarefa sem tool_use (2026-05-04)
**Arquivo:** `v3_dump/Parse_Resposta.js`

**Problema:** Bot estava criando tarefas Notion mesmo quando o usuário pedia lembrete. Inspeção mostrou que era um path totalmente paralelo ao agent loop: Sonnet emitia marcador `|||NOTION|||{json}|||FIM|||` no texto, e Parse_Resposta extraía o JSON e POSTava no Notion API direto. Bypass total das tools. Sysprompt v3 nem menciona o marcador, mas Sonnet o copiava por padrão histórico/treino.

**Fix:** Removido o bloco que parseava `|||NOTION|||` e chamava `buildNotionBody`. Agora o marcador é só removido do texto (caso Sonnet ainda emita) e logado como warning. Criação de tarefa Notion passa a ser **exclusivamente** via tool `criar_tarefa_notion` no agent loop. Marcador `|||NOTION_OK|||` (resolve) preservado por enquanto, será migrado depois.

Ganho colateral: Sonnet tem um caminho a menos pra confundir lembrete/tarefa.

---

### Bug 24 — Decisão: `criar_lembrete` desativada (STANDBY) em 2026-05-04
**Arquivos:** `v3_dump/agent_loop_code.js`, `v3_dump/sysprompt_v3.txt`

**Decisão:** Após 5h tentando consertar a sequência de bugs 19→21→22→23, quando finalmente o `tool_choice` rodou com o código certo (Bug 22 fixed), bati no rate limit `429: 30k input tokens/min` da org Anthropic — o detector de hallucination re-iterava com sysprompt de 22k chars, multiplicando custo. Insustentável no plano atual.

**Standby ativado:**
- Tool `criar_lembrete` removida do array `TOOLS` no agent loop
- Handler `if (name === 'criar_lembrete')` removido
- Lógica `forceLembrete` / `tool_choice` / `hallucinaLembrete` removida
- Sysprompt instruído a oferecer "anote no Notion como tarefa" como alternativa

**O que NÃO foi tocado:** endpoint `/api/lembretes` no dashboard (continua funcionando), tabela `mensagens_agendadas` (usada pelo cron de cobrança), cron de envio. Reativação é só restaurar o código removido + plano de redesign.

**Plano de reativação:** ver [lembretes-standby.md](lembretes-standby.md). TL;DR: rotear lembretes pro Haiku (rate limit maior, custo menor) via classifier de 1 stage antes do agent loop, em vez de usar Sonnet pra decisão simples.

---

### Bug 20 — Bot resolve no Notion a tarefa que acabou de criar (2026-05-04)
**Arquivo:** `v3_dump/sysprompt_v3.txt`

**Problema:** Usuário disse "Marcar no notion" (= criar tarefa). Bot chamou `criar_tarefa_notion` E `resolver_tarefa_notion` na mesma resposta — tarefa foi criada e imediatamente fechada como "Ok" antes de qualquer trabalho ser feito.

**Causa:** Ambiguidade de keyword. Sysprompt linha 149 listava "pode marcar" como trigger de `resolver_tarefa_notion`. "Marcar no Notion" foi interpretado como criação + resolução simultânea.

**Fix:**
- `resolver_tarefa_notion`: clarificado que "marcar no Notion" SEM "como Ok" = criar tarefa. Só resolver quando "Ok"/"resolvido" explícito.
- Adicionada regra: NUNCA chamar criar_tarefa_notion + resolver_tarefa_notion da mesma tarefa na mesma resposta.
- Seção de respostas curtas: removido "pode marcar" da lista de triggers ambíguos.

---

### Bug 25 — Resolvido por ANTIGRAVITY / GEMINI - Reativação de `criar_lembrete` e fix de hallucination XML (2026-05-23)
**Arquivo:** `v3_dump/sysprompt_v3.txt`

**Problema:** O cron de relatório automático (11:40 / 17:20) instruía o bot a criar lembretes de cobrança. O workflow forçava a execução nativa da tool com sucesso inicial, mas o `sysprompt_v3.txt` ainda dizia que `criar_lembrete` estava "EM MANUTENÇÃO / STANDBY". Para tentar justificar ou complementar os próximos comandos, o bot sofria um conflito de regras e vazava a tag `<invoke name="criar_lembrete">` (XML legacy) diretamente no texto do WhatsApp para o usuário, ao invés de prosseguir silenciosamente.

**Fix:**
- Removido o alerta de STANDBY/MANUTENÇÃO da `criar_lembrete` no `sysprompt_v3.txt`.
- Adicionada a instrução correta de uso com os parâmetros (`mensagem`, `agendar_para`) para o bot ter segurança e coerência de usar a tool quando instruído, resolvendo a contradição entre os comandos de relatórios (N8N) e as restrições do prompt.
- Deploy da nova configuração atualizada no banco de dados do N8N (`dashboard_config`).

---

### Bug 26 — Ferramenta `gerar_relatorio_excel_notion` omitida no loop de execução (05/06/2026)
**Arquivo:** `v3_dump/agent_loop_code.js`

**Problema:** O schema da nova tool `gerar_relatorio_excel_notion` foi adicionado ao prompt, permitindo que o Claude solicitasse a ferramenta. Porém, a implementação interna (`executarTool`) não tinha o bloco de `if (name === 'gerar_relatorio_excel_notion')` para lidar com a solicitação, fazendo com que a operação retornasse um erro silencioso (ignorando o payload) e a planilha não fosse gerada nem enviada ao WhatsApp, mesmo com o Claude respondendo positivamente.

**Fix:** Alteração da função `executarTool` para processar a tool de Excel tanto no nome base quanto no contexto do Notion: `if (name === 'gerar_relatorio_excel' || name === 'gerar_relatorio_excel_notion')`. Propagação da `fonte` no payload permitindo roteamento dinâmico. Deploy manual realizado no DB.

---

### Bug 27 — PostgreSQL Timeout na geração de memória (`bot_memoria_dia`) por conta de restart de pool (05/06/2026)
**Arquivo:** `dashboard_solicitacoes_programadas` / Next.js DB Pool

**Problema:** Um deploy simultâneo da API de Next.js (`pm2 restart`) e restart do N8N corrompeu o pool de conexões com o PostgreSQL local temporariamente. Exatamente naquele segundo, o recebimento de uma mensagem do Webhook engatou a requisição na query de memória do dia. A requisição ficou em "hang", gerando `timeout exceeded when trying to connect`, o que dropava o payload silenciosamente sem chamar o Claude.

**Fix:** Foi realizado um reset de serviço na `maluco-dashboard` para liberar e reconstruir o connection pool com o PostgreSQL, devolvendo a latência à normalidade.

---

### Bug 28 — Disparo Triplicado de Tarefas Programadas Agendadas Lentas (05/06/2026)
**Arquivo:** `dashboard/app/api/solicitacoes/n8n/route.js`

**Problema:** O gatilho de execução (Relatório Diário das Mensagens Tarde) que processa as planilhas agendadas às 17:20 demorava mais que 60 segundos para concluir por completo o ciclo do N8N (ler memórias, extrair via LLM, baixar APIs do Notion, gerar arquivo, etc). Como a rota `GET /api/solicitacoes/n8n` só atualizava o `ultimo_executado` quando o fluxo N8N finalizava via POST, a mesma tarefa ficava disponível por múltiplos ciclos do relógio interno de polling. Como resultado, o N8N re-acionava a tarefa por 3 vezes seguidas (17:20, 17:21, 17:22), gerando mensagens triplicadas.

**Fix:** A rota de busca GET foi alterada para atualizar IMEDIATAMENTE a marcação de `ultimo_executado = NOW()` no ato da extração da tarefa agendada via SQLite, prevenindo que o próximo polling reative o mesmo gatilho enquanto o processo assíncrono executa o primeiro ciclo.

---

### Bug 29 — Disparo Duplicado de Agendamentos por Competição de Múltiplos Workflows Ativos (06/06/2026)
**Arquivo:** `dashboard/app/api/solicitacoes/n8n/route.js`

**Problema:** Foi notado que as mensagens diárias de "Bom dia" estavam sendo entregues repetidas (`2x`). A investigação detectou que existem múltiplos fluxos do N8N ativos (ex: `Maluco da IA v7.12 -hostinguer` e `Maluco Bot v3 (tool_use)`). Como ambos os robôs pesquisam agendamentos e rodam o gatilho simultaneamente no milissegundo de virada do relógio (ex: 07:30:00), o banco lia a mesma tarefa para ambos antes que qualquer um deles conseguisse dar o `UPDATE` informando que a tarefa havia sido capturada. Isso criava uma colisão e gerava 2 chamadas paralelas e textos diferentes para a mesma tarefa.

**Fix:** A query do Next.js foi reestruturada de um formato não-bloqueante (`SELECT` seguido de `UPDATE`) para uma transação atômica (`UPDATE ... RETURNING *` operando junto com `FOR UPDATE SKIP LOCKED`). Isso impede que qualquer fluxo paralelo consiga enxergar ou capturar a mesma tarefa pendente no exato instante em que outro já assumiu o gatilho.

---

### Bug 30 — Falha no Monitoramento ICMP (Ping) gerando Falso Positivo de VPS Offline (06/06/2026)
**Local:** VPS Hostinger (`195.200.7.239`) / Ambiente de Monitoramento da IA

**Problema:** Durante testes de conectividade, a IA interpretou incorretamente que o servidor VPS da Hostinger estava totalmente inacessível ou reiniciando repetidamente. Isso ocorreu porque a rotina de monitoramento se baseou apenas na resposta de requisições `ping` (ICMP Echo Request), que estavam recebendo `Request timed out`. Diante das falhas consecutivas de Ping, a IA assumiu que a máquina estava offline e instruiu o usuário a fazer um hard reboot na Hostinger.

**A Causa Real:** O painel da Hostinger demonstrou que a máquina estava online (`uptime` de mais de 3 horas). A perda de pacotes ocorria devido ao bloqueio da porta ICMP (firewall do provedor ou rotas de rede que silenciosamente derrubavam requisições de Ping oriundas do bot). A porta `22` (SSH) estava perfeitamente funcional, permitindo conexão apesar do ping falhar. 

**Lição Aprendida:** O robô foi re-condicionado a nunca decretar a queda da VPS dependendo unicamente de Ping (ICMP). Caso o ping falhe, é obrigatório testar o socket da porta vital (`SSH -p 22` ou `HTTP -p 3000`) antes de sugerir que a máquina está morta.

---

### Bug 31 — Ferramenta de PDF Falhando Silenciosamente e Caindo para Planilha Excel (07/06/2026)
**Arquivos:** `agent_loop_found.js`, `dashboard/app/api/report-pdf/route.js`

**Problema:** O usuário pediu a geração de um relatório em PDF via `/goal`. O Claude tentou usar a tool `gerar_relatorio_pdf` enviando o JSON no formato exigido, mas o N8N (via `http` wrapper) estava transformando a string do Markdown, resultando em erro `500` no backend Next.js devido a `JSON.parse` inválido. O Claude, ao ver que a tool de PDF falhou, proativamente chamava o `gerar_relatorio_excel_notion` como plano B ("fallback"), entregando uma planilha ao invés do PDF solicitado sem avisar que o PDF falhou.

**Fix:** A rota `/api/report-pdf` foi alterada para aceitar `text/plain` em vez de `application/json`. A chamada no `agent_loop_found.js` também foi atualizada para enviar o `markdown` bruto no `body` com `Content-Type: text/plain`. 

**Lição Aprendida (Deploy N8N):** A correção demorou a entrar em produção pois edições diretas na tabela `workflow_entity` do SQLite não alteram o workflow ao vivo devido ao cache em memória do N8N. Foi criado o `deploy_agent_loop.py` para injetar a atualização simultaneamente em `workflow_history`, reiniciar o N8N, e rodar o `n8n publish:workflow` via CLI. NUNCA editar SQLite do N8N na mão esperando que a mudança seja refletida.

---

### Bug 32 — Relatório PDF com Caracteres Interrogação '?' em Textos Tipográficos (07/06/2026)
**Arquivo:** `generate_pdf.py`

**Problema:** O PDF gerado pelo N8N continha caracteres de interrogação `?` (ex: `06/06 ? VENCIDO` e `Franquelin ? Notion`). Isso ocorreu pois o Markdown enviado pelo Claude continha travessões longos (`—`, `–`) e aspas tipográficas (`“`, `”`) que não existem na tabela ASCII/Latin-1 (formato suportado pela fonte padrão Helvetica da biblioteca `fpdf2`), causando o fallback do sanitizer da ferramenta para o char `?`.

**Fix:** A função `sanitize(text)` no `generate_pdf.py` foi atualizada com um mapa de substituição `replace` explícito para converter travessões para hifens simples (`-`) e aspas tipográficas para aspas normais (`"`, `'`) *antes* de executar a conversão Latin-1. O deploy foi finalizado via `scp` e `pm2 restart maluco-dashboard`.
