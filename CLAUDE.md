# Maluco da IA — Claude Code Guide

## Projeto
Bot WhatsApp interno da Zazz Internet (fibra óptica, Lunardelli-PR).
- N8N workflow `Pj5SdaxFh9H9EIX4` (Maluco Bot v3 tool_use) — orquestra o bot
- Dashboard Next.js 14 (App Router) — painel admin em `/opt/zazz/dashboard`
- v2 legacy: `DiInHUnddtFACSmj` (desativado)

## Stack
N8N · Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) · Whisper (áudio) · Evolution API v2 · PostgreSQL · Redis · Notion API · Next.js/React/Tailwind · JWT · PM2 no VPS

## 👤 Quem é o dono do projeto (LEIA SEMPRE)
O Franquelin **não é programador** — ele conhece o negócio (Zazz, provedor de internet), não o código. Ele depende de você pra enxergar o que ele não enxerga. Por isso, em TODA tarefa:

1. **Explique em português simples.** Nada de jargão sem traduzir. Ao terminar, diga o que mudou, por que, e o que ele deve testar — em 2-3 linhas, linguagem de leigo.
2. **Seja proativo com ideias.** Ao final de cada tarefa, sugira (curto, opcional) 1-3 melhorias que VOCÊ percebeu mas ele não pediria: novas features que fazem sentido pro bot, simplificações, automações, riscos. Marque como sugestão — ele decide. Ex: "💡 Notei que X — quer que eu faça?".
3. **Cuide da organização do projeto (ele não percebe bagunça).** Se durante a tarefa você notar: arquivos lixo/duplicados na raiz, scripts one-shot já aplicados poluindo, README/docs desatualizados, segredo hardcoded, código morto, dependência sem uso → **aponte e ofereça arrumar**. Não precisa esperar ele pedir faxina; ele confia em você pra manter a casa limpa. Antes de **apagar** algo irreversível, confirme ou **arquive** (mover pra pasta gitignored) em vez de deletar.
4. **Proteja contra erros que ele não veria.** Custo de API explodindo, faturar cliente errado, mandar mensagem real num teste, vazar chave — você é a última linha de defesa. Em dúvida, pare e pergunte.
5. **Documente no cérebro** (ver seção Obsidian abaixo) — é o que evita re-descobrir tudo na próxima sessão.

> Resumo: aja como um sócio técnico que cuida do projeto, não só como executor de pedidos. Ele quer ser **guiado**.

## Comandos essenciais
```bash
npm run dev          # dashboard local :3001
npm run build && pm2 restart maluco-dashboard --update-env  # deploy (no VPS)
npm run setup-db     # cria/migra tabelas do PostgreSQL (node scripts/setup-db.js)
docker exec -it n8n-postgres-1 psql -U zazz -d zazzdb
docker exec -it n8n-redis-1 redis-cli -a REDACTED-REDIS-PW
```

## Deploy obrigatório

**Regra:** sempre que alterar qualquer arquivo do dashboard (`.jsx`, `.js`, `.css`, componentes, rotas API), fazer deploy no VPS ao final da tarefa:

```bash
ssh root@195.200.7.239 "cd /opt/zazz/dashboard && git pull origin main && npm run build && pm2 restart maluco-dashboard --update-env"
```

Não esperar o usuário pedir — deploy faz parte da entrega.

## Deploy do system prompt

N8N API key expira (~3 meses). `deploy_system_prompt.py` usa JWT que pode estar vencido. Usar sempre o método direto via psql:

```bash
ssh root@195.200.7.239 "cd /opt/zazz/dashboard && git pull origin main -q && python3 - <<'PYEOF'
import subprocess
with open('/opt/zazz/dashboard/v3_dump/sysprompt_v3.txt', 'r') as f:
    prompt = f.read()
escaped = prompt.replace(\"'\", \"''\")
sql = f\"UPDATE dashboard_config SET valor = '{escaped}' WHERE chave = 'system_prompt'; SELECT length(valor) FROM dashboard_config WHERE chave='system_prompt';\"
r = subprocess.run(['docker', 'exec', '-i', 'n8n-postgres-1', 'psql', '-U', 'zazz', '-d', 'zazzdb'],
    input=sql.encode(), capture_output=True, timeout=30)
print(r.stdout.decode()[:200])
PYEOF
"
```

## Deploy do workflow N8N (PADRÃO — atualizado mai/2026)

⚠️ **REGRA CRÍTICA**: editar `workflow_entity` direto no SQLite **NÃO BASTA**. O n8n carrega o workflow ativo da tabela `workflow_history` (versão publicada), não da `workflow_entity` (rascunho). Sem atualizar `workflow_history` E sincronizar o `versionId` entre as duas, qualquer edição **será ignorada em runtime**.

**Use SEMPRE o script `/opt/zazz/dashboard/v3_dump/deploy_workflow.py`** — ele faz o ciclo completo:

```bash
# 1. Edita Monta_Prompt.js localmente, faz scp:
scp v3_dump/Monta_Prompt.js root@195.200.7.239:/opt/zazz/dashboard/v3_dump/

# 2. Roda o deploy script no VPS:
ssh root@195.200.7.239 "python3 /opt/zazz/dashboard/v3_dump/deploy_workflow.py"
```

O script (`deploy_workflow.py`):
1. Stop n8n (`docker stop n8n-n8n-1`)
2. `PRAGMA wal_checkpoint(TRUNCATE)` (consolida WAL)
3. Atualiza `workflow_entity.nodes` (Monta Prompt + Monta Prompt Relatório) + novo `versionId` + `updatedAt`
4. Atualiza `workflow_history.nodes` com o **mesmo `versionId`** (CRÍTICO — sem isso n8n não acha a versão)
5. Checkpoint TRUNCATE de novo
6. Start n8n + chown 1000:1000

Se mudar o **agent_loop_code.js** (Claude API), o mesmo script funciona — basta adicionar `"Claude API"` à lista `NODES_TO_UPDATE` ou estender o script.

**Verificação pós-deploy**: enviar mensagem teste via webhook e checar `bot_conversas.tokens_input` (alvo: 5–8k para "oi", não mais 30k+).

### Por que o método antigo (só `workflow_entity` + restart) não funcionava

n8n v2.14+ usa modelo de versionamento: `workflow_published_version` aponta para uma `versionId` em `workflow_history`. Em runtime, o n8n carrega o workflow da `workflow_history` correspondente — `workflow_entity` é só o rascunho do editor. Edições direto na `workflow_entity` ficam invisíveis até serem "publicadas".

O script `deploy_workflow.py` simula publish replicando o conteúdo nos dois lugares com o mesmo `versionId`. Confirmado em mai/2026 após 5 sessões debugando "por que minhas edições não aplicam".

⚠️ **NÃO APAGAR** linhas em `workflow_published_version` — se a tabela ficar vazia, o webhook responde 404 ("Active version not found"). Se precisar resetar, usar `n8n unpublish:workflow` + `n8n publish:workflow` via CLI dentro do container.

## Deploy do agent_loop_code.js (nó Claude API)

O arquivo `v3_dump/agent_loop_code.js` contém API keys hardcoded — **não vai pro git**. Fica no VPS em `/opt/zazz/dashboard/v3_dump/agent_loop_code.js`.

Mesma lógica acima: usar `deploy_workflow.py` adaptado (adicionar `"Claude API"` à lista de nós), ou rodar com workflow_entity + workflow_history simultaneamente.

## Infra (Hostinger VPS 195.200.7.239)
- N8N: https://n8n.srv1537041.hstgr.cloud
- Evolution: https://evolution.srv1537041.hstgr.cloud
- Dashboard: https://dashboard.srv1537041.hstgr.cloud
- PM2 name: `maluco-dashboard`
- SQLite N8N: `/var/lib/docker/volumes/n8n_data/_data/database.sqlite`
- Ollama (Llama 3 8B, CPU-only): porta `11434` — ver `cerebro/ollama-llama3.md`

## Workflows N8N principais

| ID | Nome | Função |
|---|---|---|
| `Pj5SdaxFh9H9EIX4` | Maluco Bot v3 (tool_use) | Bot principal — recebe mensagens e processa com agent loop |
| `Urf233bK6RqoSlQs` | Alertas Notion | Polling Notion a cada 5min — envia alertas OK/Entrega por grupo+tipo |
| `tPUy8FowXH8v0skk` | Bot Memoria Longa | Extração batch de fatos a cada 6h |
| `5qTcBwOdBeoU1l7i` | Bot Memoria Dia | Resumo diário por chat (~02h) |

## 9 tools do agent loop

| Tool | Função |
|---|---|
| `buscar_cliente(q)` | Lookup cliente Zazz por nome/código |
| `buscar_chamados(q)` | Busca nos chamados importados via XLSX (Redis) |
| `buscar_pop(q)` | Busca POP por query semântica |
| `criar_tarefa_notion(...)` | Cria tarefa no Notion |
| `resolver_tarefa_notion(page_id)` | Marca tarefa como Ok |
| `listar_tarefas_notion(status?)` | Lista tarefas (Parado/Ok/Todas) |
| `aprender_fato(...)` | Salva fato em bot_memoria_longa |
| `corrigir_fato(...)` | Corrige fato errado (manual ou autônomo) |
| `criar_lembrete(mensagem, agendar_para)` | Agenda follow-up no grupo atual |

## v3_dump/ — arquivos críticos do workflow

Diretório local com os arquivos-fonte dos nós Code do N8N. **Não vão pro git** (contêm API keys).

| Arquivo | Conteúdo |
|---|---|
| `Monta_Prompt.js` | Nó "Monta Prompt" — monta o array de messages para o Claude |
| `agent_loop_code.js` | Nó "Claude API" — agent loop com as 9 tools (tem `ANTHROPIC_API_KEY` hardcoded) |
| `Parse_Resposta.js` | Nó "Parse Resposta" |
| `Parse_Match_Resolvido.js` | Nó "Parse Match Resolvido" |
| `sysprompt_v3.txt` | System prompt atual (vai pro git via `git add -f`) |
| `deploy_workflow.py` | Script de deploy do workflow (ciclo completo com workflow_history) |

Ao editar um nó Code: editar o arquivo local → `scp` para o VPS → `deploy_workflow.py`.

## Nodes críticos (executeOnce: true obrigatório)
Busca POPs, Busca System Prompt, Busca Colaboradores, Busca Histórico 10, Busca Histórico Redis, Busca Chamados Redis, Busca Clientes, Busca Regras.
**Busca Regras** também precisa `alwaysOutputData: true`.
**Busca Fatos Existentes** (Bot Memoria Longa) precisa `alwaysOutputData: true`.

## System Prompt placeholders
`{{DATA}}` `{{ANO}}` `{{TODAY}}` `{{COLABORADORES}}` `{{CLIENTES}}` `{{POPS}}` `{{HISTORICO}}` `{{REGRAS}}`

Arquivo local: `v3_dump/sysprompt_v3.txt` (vai pro git via `git add -f`).

## Banco PostgreSQL — tabelas principais
- `mensagens` — message_id UNIQUE, remetente, mensagem, chat_id
- `dashboard_pops` — titulo, categoria, conteudo, ativo
- `dashboard_config` — chave UNIQUE, valor (armazena system_prompt)
- `dashboard_colaboradores` — nome, cargo, funcoes, ativo
- `regras` — regra TEXT
- `bot_conversas` — log de interações com tokens
- `bot_erros` — erros do N8N
- `grupos_whatsapp` — grupos internos com toggles bom_dia, alertas, tipos_filtro_entrega[], tipos_filtro_ok[]
- `mensagens_agendadas` — mensagens programadas por grupo (status: pendente/enviado/erro/cancelado)
- `bot_memoria_dia` — resumos diários por chat_id
- `bot_memoria_longa` — fatos duráveis cross-grupo (UNIQUE: entidade_tipo+entidade_id+fato)

## Redis keys
- `conv:{chatId}` — histórico (últimas 8 msgs após corte de tokens)
- `chamados:data` — chamados importados (TTL 24h)
- `config:bom_dia_grupo` — JID legado (substituído por grupos_whatsapp)

## Crons no VPS
- `15 8 * * 1-6` — `/api/tarefas/cobrar` (cobrança automática de tarefas vencidas)
- `* * * * *` — `sync-evolutivo.sh` (sincroniza `cerebro/` top-level: `git pull origin main` + reindex evolutivo)
- `0 4 * * *` — purge chamados_snapshots > 30 dias

## POPs — convenção de título
- Começa com `LEIA SEMPRE:` → incluído em TODAS as respostas
- Normal → incluído por relevância semântica (ts_rank)

## Dashboard — padrões de código
- Auth: `getSession()` + `requireAdmin()` de `lib/auth.js`
- DB: `query(sql, params)` de `lib/db.js` (sempre parametrizado)
- Tema: bg `#0f0f13`, cards `#1a1a24`, brand `#071DE3`

## WhatsApp — formatação
- Negrito: `*texto*` — NUNCA `**`
- Itálico: `_texto_`
- PROIBIDO: `##`, blocos de código markdown

## Idioma
UI, banco e variáveis em Português (BR). Código: mix PT/EN conforme existente.

## ⚠️ Obsidian é o CÉREBRO do projeto

**REGRA CRÍTICA**: existe APENAS UMA pasta válida pra documentação: **`cerebro/`** — no **TOP-LEVEL do repo maluco-dashboard** (raiz do projeto, mesmo nível de `app/` e `lib/`). É a única que o bot lê (config `evolutive_sources` no postgres `pasta='cerebro'` → `/opt/zazz/dashboard/cerebro/` no VPS). NÃO usar o `dashboard/cerebro/` (submódulo gitlink desatualizado — ver aviso abaixo) nem criar pastas paralelas (`cerebro-evolutivo/`, `notas/`, `docs/`).

**Regra absoluta:** TUDO que envolva o projeto deve ser documentado em `cerebro/`. Não importa se é uma anotação simples, dica, descoberta, bug ativo, decisão de arquitetura, ou correção minúscula — vai pra essa pasta. Sempre.

**O que documentar (lista não-exaustiva):**
- ✅ Bug encontrado (mesmo sem fix) → `bugs-abertos.md`
- ✅ Bug corrigido → atualizar a nota relevante (`workflow-n8n.md`, `deploy-workflow.md`, etc) + adicionar à seção "Resolvidos" de `bugs-abertos.md`
- ✅ Decisão de arquitetura (movido X para Y, escolhi A em vez de B) → nota da área (ex: `agent-loop-tool-use.md`)
- ✅ Comando útil de diagnóstico → `workflow-n8n.md` ou `comandos-uteis.md`
- ✅ Pegadinha do n8n / Postgres / Redis → nota da camada
- ✅ Mudança de configuração → nota da feature
- ✅ Aprendizado novo (tipo "n8n carrega de workflow_history, não workflow_entity") → criar nota dedicada se for grande
- ✅ Comportamento inesperado / hipóteses → mesmo sem confirmação, `bugs-abertos.md`

**Por que importa:** essas notas são **indexadas e injetadas como contexto no bot** — viram a memória evolutiva do sistema. Sem doc no Obsidian, o conhecimento se perde entre sessões do Claude Code. Já gastamos várias sessões redescobrindo o mesmo problema (ex: 6 sessões pra entender que workflow_history precisa ser atualizada também). **Não deixe isso acontecer de novo.**

**Onde:** `cerebro/` no TOP-LEVEL do repo (NÃO é submódulo — é tracked direto no maluco-dashboard). Sync pro VPS pelo `sync-evolutivo.sh` a cada minuto: `git pull origin main` + reindex (`POST /api/treinamento-evolutivo/sync`). ⚠️ Se o `git pull` do VPS travar (mudanças scp não-commitadas no clone), `scp` os `.md` pro `/opt/zazz/dashboard/cerebro/` e dispare o reindex manualmente.

**Quando:** ao FINAL de qualquer task que envolva descoberta nova, mesmo que pequena. Antes de commitar o código, atualizar a nota correspondente. Não esperar o usuário pedir.

**Notas de referência atual** (lista completa em [`INDEX.md`](cerebro/INDEX.md)):
- [`INDEX.md`](cerebro/INDEX.md) — **MAPA COMPLETO de tudo que existe + comandos de diagnóstico + troubleshooting**
- [`arquitetura-geral.md`](cerebro/arquitetura-geral.md) — visão geral do sistema, stack, fluxos
- [`workflow-n8n.md`](cerebro/workflow-n8n.md) — estrutura, padrões, regras operacionais do workflow
- [`agent-loop-tool-use.md`](cerebro/agent-loop-tool-use.md) — agent loop, 9 tools, cache split
- [`deploy-workflow.md`](cerebro/deploy-workflow.md) — método correto de deploy (workflow_entity + workflow_history)
- [`tool-choice-forcado.md`](cerebro/tool-choice-forcado.md) — anti-alucinação via tool_choice forçado
- [`detecta-resolvido.md`](cerebro/detecta-resolvido.md) — fluxo paralelo de auto-resolver tarefa
- [`teste-sintetico-webhook.md`](cerebro/teste-sintetico-webhook.md) — testar bot via curl
- [`bugs-abertos.md`](cerebro/bugs-abertos.md) — TODO de problemas conhecidos

⚠️ **NÃO confundir (corrigido 20/06/2026):** o `cerebro/` **top-level** (tracked direto no maluco-dashboard) é o CANÔNICO — é ele que o VPS pulla e o bot indexa. Já o **`dashboard/cerebro/`** é um SUBMÓDULO (gitlink) com história divergente/desatualizada — **NÃO editar lá** (não chega no bot). Editar SEMPRE o `cerebro/` top-level → commit no maluco-dashboard → push. (A doc antiga dizia o contrário e fez notas irem pro lugar errado.)

**Histórico mai/2026:** existia uma pasta paralela `dashboard/cerebro-evolutivo/` com nomes em kebab-case que NÃO era lida pelo bot (config no postgres apontava pra `cerebro/`). Causou várias notas técnicas serem invisíveis. Foi consolidada em `cerebro/`. Não recriar essa pasta.

## 📚 Leitura obrigatória por contexto

ANTES de iniciar uma task que toque uma das áreas abaixo, leia a nota correspondente do Obsidian. Não pular — economiza horas de redescoberta de problemas já resolvidos.

| Se a task envolve... | Leia ANTES |
|---|---|
| Editar nó Code do workflow N8N (Monta Prompt, Claude API, etc) | [`deploy-workflow.md`](cerebro/deploy-workflow.md) — método correto via `deploy_workflow.py` + por que SQLite direto não basta |
| Mudar prompt / system prompt / cache split | [`agent-loop-tool-use.md`](cerebro/agent-loop-tool-use.md) — bloco estável vs dinâmico, regras de cache |
| Testar bot sem mandar mensagem real no WhatsApp | [`teste-sintetico-webhook.md`](cerebro/teste-sintetico-webhook.md) — payload do Filter1 + script `check_exec.py` |
| Mexer no fluxo do workflow N8N (nodes, conexões) | [`workflow-n8n.md`](cerebro/workflow-n8n.md) — estrutura, nodes críticos, regras de SQLite/WAL |
| Encontrar bug ou comportamento estranho | [`bugs-abertos.md`](cerebro/bugs-abertos.md) — talvez já está mapeado lá |
| Ver script `fix_*.py` na raiz do projeto | [`fix-scripts-historicos.md`](cerebro/fix-scripts-historicos.md) — todos são one-shot já aplicados, NÃO rodar |
| Tools do agent loop (`buscar_pop`, `criar_tarefa_notion`, etc) | [`agent-loop-tool-use.md`](cerebro/agent-loop-tool-use.md) — schemas + regras por tool |
| Sistema de chamados / importação | [`Chamados.md`](cerebro/Chamados.md) |
| Filtros por tipo de grupo (Internet vs Design, tipos_filtro_entrega) | [`multigrupo-tipos-implementado.md`](cerebro/multigrupo-tipos-implementado.md) |

**Como ler:** use a tool `Read` direto no path da nota. Não leia o repo inteiro. Se a nota for grande (>500 linhas), procure section relevante via `Grep` antes do `Read`.

**Quando atualizar essas notas:** ao final da task, antes de commitar — incorporar qualquer descoberta nova. Ver regra geral em "## ⚠️ Obsidian é o CÉREBRO do projeto" acima.
