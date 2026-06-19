# Detecta Resolvido — Auto-resolução de tarefas

Fluxo paralelo do workflow `Pj5SdaxFh9H9EIX4` que detecta quando alguém confirma "tarefa concluída" no chat e marca como Ok no Notion automaticamente.

## Fluxo

```
Webhook recebe mensagem
        ↓ (paralelo ao agent loop)
Detecta Resolvido (filtra por keyword)
        ↓ (se match)
Busca Paradas Notion (lista tarefas em status="Parado")
        ↓
Match Tarefa Resolvida (Claude analisa qual tarefa bate)
        ↓
Parse Match Resolvido (extrai action: resolve | ambiguo | nenhum)
        ↓ (se action=resolve)
Resolve no Notion (PATCH status=Ok)
        ↓
Confirma Resolvido (envia "✅ Marquei como Ok" no chat)
```

## Quando dispara (regex pós-fix mai/2026)

**Aceita** (action=resolve esperada):
- "Tarefa X resolvida"
- "Já ficou pronto"
- "Tá pronto / tá ok / tá feito"
- "Concluí o adesivo do João"
- "Finalizado"
- "Encerrado"
- "Terminei"
- "Tudo certo / tudo ok"

**Rejeita** (não dispara — exclusão `CRIA_TAREFA_RE`):
- Mensagens com "Descrição do Serviço:", "Cliente:", "Data de Entrega:" (template de criação)
- "Avisar quando tiver pronto" / "Me avise quando" (instrução futura)
- "Quero criar uma tarefa", "Criar pedido"
- Mensagens > 800 caracteres (geralmente briefing, não confirmação)

## Histórico do bug (06/05/2026)

**Sintoma:** usuário Franquelin colou template de pedido de adesivo recortado pra João Victor:
```
Descrição do Serviço (Título): Adesivo recortado - Branco
Cliente: João Victor de Proença
Data de Entrega: 06/05/2026
...
Avisar ele quando tiver pronto.
```

Bot:
1. ✅ Criou a tarefa no Notion (correto, via `criar_tarefa_notion` no agent loop)
2. ❌ Logo depois: enviou "Marquei como Ok no Notion: Adesivo recortado - Branco João" (ERRADO — acabou de criar!)

**Causa raiz:** o regex original do `Detecta Resolvido` era:
```js
const KEY_RE = /\b(resolv|fech|finaliz|termin|conclu|encerr|feito|pronto|prontinho|ja foi|esta ok|ta ok|tudo certo)/;
```

A palavra "**pronto**" sozinha matchava qualquer ocorrência. Quando o usuário escreveu "Avisar ele quando tiver pronto" (instrução futura), o regex disparou o flow paralelo. O Claude do `Match Tarefa Resolvida` viu uma mensagem ambígua, encontrou uma tarefa similar ("Adesivo recortado") já em status Parado e marcou como Ok.

**Fix mai/2026** (commit `[ver git log]`):
1. Adicionada exclusão `CRIA_TAREFA_RE` que pega templates de criação de tarefa
2. Regex KEY_RE mais restrito: exige contexto de "JÁ está pronto", não só "pronto" solto
3. Mensagens > 800 chars são ignoradas (briefings raramente são confirmação)

Código em `v3_dump/detecta_resolvido.js` (no VPS em `/opt/zazz/dashboard/v3_dump/`, não vai pro git em raw — é deployado via `deploy_full.py`).

## Arquivos relacionados

- Nó N8N: `Detecta Resolvido` no workflow `Pj5SdaxFh9H9EIX4`
- Source local: `v3_dump/detecta_resolvido.js` (não commitado por gitignore — copiar do VPS se precisar)
- Deploy: `v3_dump/deploy_full.py` (atualiza o nó junto com Monta Prompt + agent_loop)

## Como testar mudanças

```bash
# 1. Editar /tmp/detecta_resolvido.js localmente
# 2. SCP pro VPS:
scp detecta_resolvido.js root@195.200.7.239:/opt/zazz/dashboard/v3_dump/

# 3. Rodar deploy:
ssh root@195.200.7.239 "python3 /opt/zazz/dashboard/v3_dump/deploy_full.py"

# 4. Teste com webhook sintético (mensagem que NÃO deveria disparar):
TS=$(date +%s) && curl -s -X POST 'https://n8n.srv1537041.hstgr.cloud/webhook/whatsapp' \
  -H 'Content-Type: application/json' \
  -d "{\"event\":\"messages.upsert\",\"data\":{\"key\":{\"remoteJid\":\"554391663335@s.whatsapp.net\",\"fromMe\":false,\"id\":\"TEST_$TS\"},\"message\":{\"conversation\":\"Avisar quando tiver pronto\"},\"messageTimestamp\":$TS,\"pushName\":\"Franquelin\"}}"

# 5. Verificar nodes que rodaram (NÃO devem aparecer Match/Resolve/Confirma):
ssh root@195.200.7.239 "python3 -c \"
import sqlite3, json
con = sqlite3.connect('/var/lib/docker/volumes/n8n_data/_data/database.sqlite', timeout=5)
cur = con.cursor()
cur.execute(\\\"SELECT data FROM execution_data WHERE executionId=(SELECT MAX(id) FROM execution_entity WHERE workflowId='Pj5SdaxFh9H9EIX4' AND mode='webhook')\\\")
arr = json.loads(cur.fetchone()[0])
# Lista nodes
for v in arr:
  if isinstance(v, dict) and 'runData' in str(json.dumps(v)) and 'lastNodeExecuted' in str(json.dumps(v)):
    rd = arr[int(v['runData'])] if isinstance(v.get('runData'), str) and v['runData'].isdigit() else v.get('runData')
    if isinstance(rd, dict):
      ran = [arr[int(k)] if isinstance(k,str) and k.isdigit() else k for k in rd.keys()]
      bad = [n for n in ran if n in ('Match Tarefa Resolvida','Resolve no Notion','Confirma Resolvido')]
      print('Auto-resolve nodes ran:', bad if bad else 'NONE (correct)')
\""
```

## Fix mai/2026 (14/05) — novas exclusões CRIA_TAREFA_RE

**Problema:** "Marcar para passar na casa dela de tarde. Já foi feito o processo para atualizar a Rede" disparou o Detecta Resolvido porque "já foi feito" casou no KEY_RE. A tarefa "Instabilidade na conexão - Maria Conceição Marconato" foi marcada como Ok indevidamente.

**Fix adicionado à CRIA_TAREFA_RE:**
```js
|marcar\s+(?:para|pra)\s+(?:passar|ir|visitar|agendar|fazer|checar|verificar)
|passar\s+(?:na|em)\s+casa
|agendar\s+(?:uma?\s+)?(?:visita|passagem|ida)
|j[aá]\s+foi\s+feito\s+o\s+processo
|j[aá]\s+foi\s+(?:feito|realizado|executado)\s+(?:o\s+)?(?:processo|atualiza|configura|reboot|reset)
```

Estes padrões indicam CRIAÇÃO de tarefa ou contexto de background (não confirmação de resolução).

## Fix 17/06/2026 — entende REPLY CITADO (quote)

**Problema:** o Russo respondeu "Resolvido, roteador travado..." **citando** o chamado da Celinalva (sem dizer o nome na resposta). O `Detecta Resolvido` re-extraía só o texto cru (`eText`) e **ignorava o quote** — então o `Match Tarefa Resolvida` (que exige cliente explícito, regra 4) via uma msg vaga → `action=nenhum` → tarefa ficou Parado. Aí a cobrança das 13:40 disparou em algo já resolvido.

**Fix:** o `Detecta Resolvido` agora captura o `contextInfo.quotedMessage` (igual o `Extrai Dados Mensagem` já fazia) e **anexa ao `text`** que vai pro Match: `Resolvido... [em resposta a: "482 - Celinalva sem internet"]`. Assim o Claude resolve a referência do quote e casa a tarefa. As regras (CRIA_TAREFA_RE, KEY_RE, >800 chars) continuam rodando só no texto da RESPOSTA; o quote entra só no output pra contexto.

Deploy: `v3_dump/deploy_detecta_resolvido.py` (string-replace do `return` do nó + `workflow_entity`/`workflow_history` mesmo versionId + republish). Testado via webhook sintético (quote flui até o Match). **Complemento:** o processador de cobrança (`/api/mensagens-agendadas/processar`) também passou a re-checar o status no Notion antes de disparar — ver `bugs-abertos.md`.

## Considerações futuras

Esse fluxo paralelo tem **valor real** quando funciona — economiza tempo em "ah, já resolvi o chamado da Maria" sem precisar abrir o Notion. Mas false positives são caros (cliente recebe "marquei como Ok" sem ter pedido).

Possíveis melhorias:
- Threshold de confiança no Claude do `Match Tarefa Resolvida` (só marcar se confiança > 0.9)
- Pedir confirmação no chat antes de marcar ("Posso marcar X como Ok?")
- Limitar tarefas candidatas a apenas as do usuário que falou (usuário X só resolve tarefa atribuída a X)

---

**Ver também:** [[Notion]] · [[Workflow N8N]] · [[Colaboradores]] · [[agent-loop-tool-use]] · [[bugs-abertos]]
