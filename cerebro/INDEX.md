# Índice — Cerebro Evolutivo

Mapa de todas as notas técnicas do projeto Maluco da IA. Atualizar quando adicionar/renomear nota.

## 🏗️ Arquitetura

- [arquitetura-geral.md](arquitetura-geral.md) — visão geral do sistema, stack, fluxo de mensagens, componentes
- [workflow-n8n.md](workflow-n8n.md) — estrutura do workflow N8N principal, nodes críticos, regras de SQLite/WAL

## 🚀 Deploy & operação

- [deploy-workflow.md](deploy-workflow.md) — método correto de deploy (workflow_entity + workflow_history)
- [teste-sintetico-webhook.md](teste-sintetico-webhook.md) — testar bot via curl sem WhatsApp
- [bugs-abertos.md](bugs-abertos.md) — TODO list de problemas conhecidos
- [fix-scripts-historicos.md](fix-scripts-historicos.md) — catálogo dos scripts `fix_*.py` da raiz (todos one-shot, já aplicados)

## 🤖 Bot / IA

- [agent-loop-tool-use.md](agent-loop-tool-use.md) — agent loop, 9 tools, cache split do prompt
- [tool-choice-forcado.md](tool-choice-forcado.md) — anti-alucinação via tool_choice forçado (lembrete, chamados)
- [detecta-resolvido.md](detecta-resolvido.md) — fluxo paralelo de auto-resolução de tarefas no Notion

## 📚 Skills / Comandos

- (TODO: documentar /menu, /relatorio, /pops, /notion, /chamados quando relevante)

## 🛠️ Vibecoding / Claude Code

- [dicas-claude-code-vibecoding.md](dicas-claude-code-vibecoding.md) — dicas pra orquestrar projeto via Claude Code

## 📝 Convenções

### Quando criar nota nova

- Aprendizado complexo que vale documentar (>5 min de leitura)
- Bug que afeta arquitetura, não fix pontual
- Sistema/feature nova
- Decisão de arquitetura

### Quando atualizar nota existente

- Bug fix em sistema já documentado
- Mudança em padrão estabelecido
- Detalhe técnico novo descoberto

### Onde NÃO documentar

- Em CLAUDE.md (deve ficar curto, com pointers pra cá)
- Em comentários de código (marca aqui no Obsidian e cita no commit message)

## 📊 Notas mais consultadas (top 5 por bug recorrente)

1. **deploy-workflow.md** — toda vez que mexer em nó Code do workflow
2. **agent-loop-tool-use.md** — toda vez que mexer no prompt ou em tool
3. **bugs-abertos.md** — antes de começar debug
4. **teste-sintetico-webhook.md** — pra testar sem mandar msg real
5. **workflow-n8n.md** — quando algo no fluxo geral quebrar

## 🔗 Links externos importantes

- N8N Editor: https://n8n.srv1537041.hstgr.cloud
- Dashboard: https://dashboard.srv1537041.hstgr.cloud
- Evolution API: https://evolution.srv1537041.hstgr.cloud
- VPS: `ssh root@195.200.7.239`
- Repo GitHub: https://github.com/claudezazz-cloud/maluco-dashboard

## 📌 Comandos de diagnóstico recorrentes

```bash
# Última execução webhook do bot
ssh root@195.200.7.239 "python3 -c \"
import sqlite3
con = sqlite3.connect('/var/lib/docker/volumes/n8n_data/_data/database.sqlite', timeout=5)
cur = con.cursor()
cur.execute(\\\"SELECT id, status, startedAt FROM execution_entity WHERE workflowId='Pj5SdaxFh9H9EIX4' AND mode='webhook' ORDER BY id DESC LIMIT 5\\\")
for r in cur.fetchall(): print(r)
\""

# Últimas mensagens / tokens
ssh root@195.200.7.239 "docker exec n8n-postgres-1 psql -U zazz -d zazzdb -c \"SELECT id, remetente, LEFT(mensagem, 40), tokens_input, tokens_output FROM bot_conversas ORDER BY id DESC LIMIT 5\""

# Inspeção detalhada de execução
ssh root@195.200.7.239 'python3 /tmp/check_exec.py <ID>'

# Redis chamados
ssh root@195.200.7.239 'docker exec n8n-redis-1 redis-cli -a REDACTED-REDIS-PW GET "chamados:data" | head -c 200'

# Logs do bot N8N (últimas 50 linhas)
ssh root@195.200.7.239 'docker logs n8n-n8n-1 --tail 50 2>&1'

# Logs do auto-import de chamados
ssh root@195.200.7.239 'tail -50 /var/log/routerbox-auto.log'

# Status PM2 do dashboard
ssh root@195.200.7.239 'pm2 list && pm2 logs maluco-dashboard --lines 30 --nostream'
```

## 🚨 Troubleshooting rápido

| Sintoma | Provável causa | Onde olhar |
|---|---|---|
| Bot não responde | n8n down ou Evolution API com problema | `docker ps`, logs n8n |
| Tokens explodiram (>15k) | Cache prompt quebrado ou config errada | [agent-loop-tool-use.md](agent-loop-tool-use.md) |
| Bot inventa info (alucina) | Tool não foi chamada quando deveria | [tool-choice-forcado.md](tool-choice-forcado.md) |
| Edição em código não aplica | workflow_history não atualizado | [deploy-workflow.md](deploy-workflow.md) |
| Mensagens duplicadas | Race condition em cron `/api/solicitacoes/processar` | [bugs-abertos.md](bugs-abertos.md) |
| Tarefa marcada Ok sem motivo | Detecta Resolvido false-positive | [detecta-resolvido.md](detecta-resolvido.md) |
| Webhook 404 | `workflow_published_version` corrompido | restart + `n8n publish:workflow --id=X` |
| `pops_usados` vazio no dashboard | bug `Monta_Prompt.js` linha 262 | já corrigido mai/2026 |
