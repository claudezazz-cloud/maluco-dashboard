# Índice — Cerebro Evolutivo

Mapa de todas as notas do projeto Maluco da IA. Atualizar quando adicionar/renomear nota.

## 📖 Notas Fundacionais (visão geral do projeto)

- [[Maluco da IA]] — visão geral, objetivo, missão do bot
- [[Objetivo]] — motivação e escopo do projeto
- [[Stack Tecnologica]] — tecnologias usadas (N8N, Claude, Evolution API, etc)
- [[Infraestrutura]] — VPS, Docker, PM2, URLs de acesso
- [[Workflow N8N]] — fluxo do workflow principal, nodes críticos
- [[System Prompt]] — estrutura e placeholders do prompt
- [[Prompt Caching]] — otimização de tokens (blocos estável + dinâmico)
- [[POPs]] — processos operacionais padrão da Zazz
- [[Chamados]] — importação e uso de chamados técnicos
- [[Notion]] — integração de tarefas
- [[Colaboradores]] — time da Zazz
- [[Clientes]] — lookup de clientes
- [[Deploy]] — como fazer deploy do dashboard e do workflow
- [[Banco de Dados]] — tabelas PostgreSQL e Redis
- [[Relatorios]] — relatório diário de chamados
- [[Solicitacoes Programadas]] — bom dia e outros crons
- [[Bom Dia]] — fluxo de mensagem automática matinal
- [[Skills]] — skills ativadas por comandos /
- [[Fluxo de Audio]] — transcrição Whisper
- [[Fluxo de Imagem]] — Claude Vision
- [[Regras de Treinamento]] — como treinamento funciona
- [[Funcionalidades]] — features disponíveis
- [[Custos]] — custos de operação
- [[Resolvidos Hoje]] — ranking de chamados resolvidos

## 🏗️ Arquitetura

- [arquitetura-geral.md](arquitetura-geral.md) — visão geral do sistema, stack, fluxo de mensagens, componentes
- [workflow-n8n.md](workflow-n8n.md) — estrutura do workflow N8N principal, nodes críticos, regras de SQLite/WAL

## 🚀 Deploy & operação

- [dashboard-overview-online.md](dashboard-overview-online.md) — por que o card "BOTS ONLINE" dava 0/1 (workflow_id v2 + N8N_API_KEY vencida + group_chat_id); fix lê do SQLite do n8n
- [backup-custos-conta-rbx.md](backup-custos-conta-rbx.md) — backup diário do Postgres + painel /custos (tokens/$) + conta RBX trocada p/ Luiz
- [deploy-workflow.md](deploy-workflow.md) — método correto de deploy (workflow_entity + workflow_history)
- [deploy-rotas-nos.md](deploy-rotas-nos.md) — **receitas validadas jun/2026**: deploy de rota dashboard (scp+build+restart), nó n8n (deploy_*.py), system prompt (psql), testar sem WhatsApp, mention real Evolution, reindex cerebro
- [repo-git-segredos.md](repo-git-segredos.md) — **estrutura do repo + faxina de segredos**: cerebro top-level vs submódulo, filter-repo, como commitar/pushar sem reintroduzir keys, por que o git pull do VPS trava
- [teste-sintetico-webhook.md](teste-sintetico-webhook.md) — testar bot via curl sem WhatsApp
- [bugs-abertos.md](bugs-abertos.md) — TODO list de problemas conhecidos
- [fix-scripts-historicos.md](fix-scripts-historicos.md) — catálogo dos scripts `fix_*.py` da raiz (todos one-shot, já aplicados)

## 🤖 Bot / IA

- [agent-loop-tool-use.md](agent-loop-tool-use.md) — agent loop, tools, cache split do prompt (cache nos 2 blocos)
- [historico-cliente.md](historico-cliente.md) — tool `historico_cliente` + página /clientes (histórico do cliente sob demanda)
- [extrator-lista-clientes.md](extrator-lista-clientes.md) — scraper diário (20:30) da lista de clientes do Routerbox → dashboard (Cod, CPF, Nome, Grupo)
- [carnes-videos-dashboard.md](carnes-videos-dashboard.md) — aba "Carnês gerados" em /clientes (nome + vídeo da geração, streaming com Range)
- [tool-choice-forcado.md](tool-choice-forcado.md) — anti-alucinação via tool_choice forçado (lembrete, chamados)
- [detecta-resolvido.md](detecta-resolvido.md) — fluxo paralelo de auto-resolução de tarefas no Notion
- [contato-reclamacao-encaminhada.md](contato-reclamacao-encaminhada.md) — reclamação encaminhada + contato compartilhado → atribuir ao CLIENTE (não a quem postou); captura nome do contato
- [lembretes-promessas.md](lembretes-promessas.md) — detector de promessas ("amanhã eu...") → lembrete automático no grupo (cron 30min, LLM por grupo, validação estrita)

## 📚 Skills / Comandos

- (TODO: documentar /menu, /relatorio, /pops, /notion, /chamados quando relevante)

## 🤖 Modelos locais

- [ollama-llama3.md](ollama-llama3.md) — Ollama + Llama 3 8B instalado no VPS (CPU-only, porta 11434)

## 🔀 Multigrupo / Isolamento

- [multigrupo-tipos-implementado.md](multigrupo-tipos-implementado.md) — isolamento de tarefas por grupo (Internet vs Design) via tipos_filtro_entrega

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
