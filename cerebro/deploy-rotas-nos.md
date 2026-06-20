# Deploy & Testes — rotas, nós n8n, system prompt (métodos validados jun/2026)

Receitas **prontas e testadas** desta sessão pra deployar e testar SEM mandar mensagem real. Evita re-descobrir. Complementa [[deploy-workflow]] (workflow_entity+history) e [[teste-sintetico-webhook]].

## 1. Rotas do dashboard (`.js`/`.jsx`)
Edita local → **scp** → **build** → **restart**. NÃO é git pull (o pull do VPS trava — ver [[repo-git-segredos]]).
```bash
scp app/api/<rota>/route.js root@195.200.7.239:/opt/zazz/dashboard/app/api/<rota>/route.js
ssh root@195.200.7.239 "cd /opt/zazz/dashboard && npm run build && pm2 restart maluco-dashboard --update-env"
```
- App Router **exige `npm run build`** (não tem hot-reload em prod). `--update-env` recarrega `.env`.
- `node --check app/api/<rota>/route.js` ANTES do scp (mas `@/lib/...` imports não resolvem em `node --check` puro — confirma só sintaxe).
- PM2: `maluco-dashboard` (dashboard) e `maluco-fila` (worker de carnê). `pm2 list` pra saúde.

## 2. Nós Code do n8n (workflow `Pj5SdaxFh9H9EIX4`)
⚠️ Editar SQLite direto **não basta** — precisa `workflow_entity` + `workflow_history` com **mesmo versionId** + republish. Detalhe e porquê em [[deploy-workflow]]. Dois padrões de script (ficam em `v3_dump/`, gitignored):
- **Nó inteiro** (`agent_loop_code.js` / "Claude API"): scp do jsCode pra `v3_dump/agent_loop_current.js` → `python3 v3_dump/deploy_agentloop.py` (injeta no nó, grava entity+history+republish, backup `BK_*`).
- **String-replace cirúrgico** num nó (quando muda 1 trecho): script `deploy_<no>.py` que faz `jsCode.replace(OLD, NEW)` com **pré-checagem** (`assert jsCode.count(OLD)==1` e aborta se já aplicado), depois `docker stop n8n` → `PRAGMA wal_checkpoint(TRUNCATE)` → update entity+history mesmo vid → start → `n8n republish`. Exemplos desta sessão: `deploy_detecta_resolvido.py` (nó "Detecta Resolvido" — anexa `[em resposta a: "..."]`), `deploy_relatorio_hoje.py` (nó "Monta Prompt Relatório" — filtra histórico pelo dia BRT).
- Validar sintaxe do jsCode: envolver em `async function __w(){ <code> }` e `node --check`.

## 3. System prompt (Postgres `dashboard_config`, chave `system_prompt`)
**Live na hora** — o nó "Busca System Prompt" lê do banco a cada request, NÃO precisa deploy de workflow. Padrão `update_sysprompt*.py`:
1. Lê `valor` via psql (use sentinela tipo `\x01` pra não quebrar em newline).
2. `str.replace` com **assert de âncora** (aborta se o texto-alvo sumiu OU se já foi aplicado — idempotente).
3. **Backup** pra `v3_dump/sysprompt_backup_<ts>.txt`.
4. Escreve de volta escapando `'`→`''`.
- Os prompts das **rotinas programadas** ("pendência", relatório, etc.) ficam em `dashboard_solicitacoes_programadas.comando` — editar via psql (mesmo padrão).

## 4. Testar SEM WhatsApp real
- **Webhook sintético** (bot completo): POST no webhook n8n com payload Evolution `messages.upsert`. Resposta citada → `message.extendedTextMessage.contextInfo.quotedMessage.conversation`. Detalhe em [[teste-sintetico-webhook]].
- **Cobrança / lembrete agendado:** `INSERT INTO mensagens_agendadas (grupo_id, mensagem, agendar_para='passado', status='pendente', dedup_key)` → `POST /api/mensagens-agendadas/processar -H 'x-token: MALUCO_POPS_2026'` → confere `status`. Use **grupo interno de teste** (não um grupo de cliente). Limpar pelo `dedup_key`, **nunca por range de `id`** (já apaguei jobs reais por isso).
- **Gate de feriado/expediente:** insere HOJE na tabela `feriados` (ou testa `janelaForaExpediente(new Date('...'))`) → chama a rota → confere `motivo` → remove o registro de teste.
- **Notion:** `POST api.notion.com/v1/databases/d54e5911e8af43dfaed8f2893e59f6ef/query` filtro `status=Parado` pra ver pendências reais sem tocar no bot.
- ⛔ **NUNCA chamar endpoint com efeito colateral só pra "testar o gate"** — `/api/tarefas/cobrar` (hoje desativado) chegou a DISPARAR cobrança real (22 tarefas, 2 grupos) num teste meu. Testa a função/condição isolada, não o endpoint que envia.

## 5. Mention real no WhatsApp (Evolution v2)
Pra `@fulano` renderizar como marcação de verdade (não `@5543...` cru): no `sendText` mande o campo **`mentioned`** = array de números (só dígitos, com DDI 55).
```json
{ "number": "<chat_id>", "text": "... @5543999999999 ...", "mentioned": ["5543999999999"] }
```
Evolution converte em `contextInfo.mentionedJid`. **Confirmado HTTP 201.** Implementado em `extrairMentions()` no processar de mensagens-agendadas.

## 6. Reindexar o cerebro pro bot
```bash
ssh root@195.200.7.239 "curl -s -X POST localhost:3001/api/treinamento-evolutivo/sync -H 'x-token: EVOLUTIVO_SYNC_2026'"
```
Retorna `{atualizados:N, pulados:M}`. Fazer depois de scp dos `.md` pro `/opt/zazz/dashboard/cerebro/`.

## Tokens/portas úteis
`MALUCO_POPS_2026` (token interno das rotas) · `EVOLUTIVO_SYNC_2026` (reindex) · dashboard em `localhost:3001` no VPS · VPS `root@195.200.7.239`.

Ver: [[repo-git-segredos]] · [[deploy-workflow]] · [[teste-sintetico-webhook]] · [[feriados-calendario]]
