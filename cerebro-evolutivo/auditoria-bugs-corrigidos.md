# Auditoria de Bugs — Maio 2026

Auditoria completa do projeto realizada em 03/05/2026. Foram identificados e corrigidos 16 bugs (P0 críticos + P1 médios). Esta nota registra o que foi feito, por quê, e onde.

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

---

### Bug 20 — Bot resolve no Notion a tarefa que acabou de criar (2026-05-04)
**Arquivo:** `v3_dump/sysprompt_v3.txt`

**Problema:** Usuário disse "Marcar no notion" (= criar tarefa). Bot chamou `criar_tarefa_notion` E `resolver_tarefa_notion` na mesma resposta — tarefa foi criada e imediatamente fechada como "Ok" antes de qualquer trabalho ser feito.

**Causa:** Ambiguidade de keyword. Sysprompt linha 149 listava "pode marcar" como trigger de `resolver_tarefa_notion`. "Marcar no Notion" foi interpretado como criação + resolução simultânea.

**Fix:**
- `resolver_tarefa_notion`: clarificado que "marcar no Notion" SEM "como Ok" = criar tarefa. Só resolver quando "Ok"/"resolvido" explícito.
- Adicionada regra: NUNCA chamar criar_tarefa_notion + resolver_tarefa_notion da mesma tarefa na mesma resposta.
- Seção de respostas curtas: removido "pode marcar" da lista de triggers ambíguos.
