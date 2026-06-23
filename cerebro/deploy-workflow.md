# Deploy de Workflow N8N — Lições Aprendidas (mai/2026)

⚠️ **DOCUMENTO CRÍTICO**: 6 sessões do Claude Code foram gastas debugando "por que minhas edições no SQLite não aplicam". O entendimento abaixo é o resultado dessa investigação.

## TL;DR — método correto

Editar SOMENTE `workflow_entity` no SQLite **NÃO funciona** no n8n v2.14+. Tem que atualizar `workflow_history` também, sincronizando `versionId`. Use `/opt/zazz/dashboard/v3_dump/deploy_workflow.py`.

## Como o n8n v2.14+ carrega workflows em runtime

O n8n usa modelo de **versionamento** que tem 3 tabelas relevantes:

| Tabela | Papel |
|---|---|
| `workflow_entity` | **Rascunho** (draft) do editor. Tem `versionId` que aponta pra história. |
| `workflow_history` | **Versões publicadas**. n8n carrega o `nodes` daqui em runtime. |
| `workflow_published_version` | Mapeia `workflowId` → `publishedVersionId`. Pode estar vazio para workflows draft-only. |

Quando o n8n boota e ativa um workflow, ele:
1. Lê `workflow_entity.versionId` para descobrir qual versão está "ativa"
2. Busca `workflow_history WHERE versionId=<entity.versionId>` — daí vem o **código que executa**

Se você atualiza só `workflow_entity.nodes`, o `workflow_history` continua com a versão antiga → n8n executa código antigo, mesmo após restart, mesmo com SQLite atualizado.

## Sintomas do problema

- `bot_conversas.tokens_input` muito alto (ex: 30k+) mesmo após "deploy"
- Inspeção da `execution_data` mostra modelo errado (`claude-sonnet-4-6` em vez de `claude-haiku-4-5-20251001`)
- System prompt contém texto que não está no `workflow_entity.jsCode` atual (ex: blocos `chamadosContext` antigo)
- N8N CLI `update:workflow --active=true` retorna `Failed to publish workflow: Version "X" not found for workflow "Y"`

## Procedimento correto

Use `deploy_workflow.py` (já no VPS em `/opt/zazz/dashboard/v3_dump/deploy_workflow.py`):

```bash
# 1. Editar Monta_Prompt.js localmente
# 2. SCP para o VPS:
scp v3_dump/Monta_Prompt.js root@195.200.7.239:/opt/zazz/dashboard/v3_dump/

# 3. SEMPRE rodar o dry-run antes (não mexe em nada, só compara):
ssh root@195.200.7.239 "python3 /opt/zazz/dashboard/v3_dump/deploy_workflow.py --check"
# 4. Se o --check der OK, rodar o deploy real:
ssh root@195.200.7.239 "python3 /opt/zazz/dashboard/v3_dump/deploy_workflow.py"
```

⚠️ **Corrigido 22/06/2026:** os nós **'Monta Prompt' e 'Monta Prompt Relatório' DIVERGEM** (o Relatório filtra `redisHistory` pelo dia BRT). A versão antiga gravava o MESMO `Monta_Prompt.js` nos dois → **clobberava** a diferença do Relatório. A versão nova mantém UMA fonte (`Monta_Prompt.js` = nó 'Monta Prompt') e **gera o Relatório aplicando a divergência** (transform determinístico); aborta se não achar o anchor. Tem `--check` (dry-run). Versão antiga: `deploy_workflow.py.PERIGOSO.bak`.

O script faz, em ordem:
1. `docker stop n8n-n8n-1`
2. `PRAGMA wal_checkpoint(TRUNCATE)` — consolida WAL antes de qualquer write
3. Lê `Monta_Prompt.js`, atualiza Monta Prompt (igual) + Monta Prompt Relatório (com o filtro de dia aplicado), com backup em `/root/nodes_backup_deploywf_*`
4. Gera novo `versionId = uuid.uuid4()`
5. `UPDATE workflow_entity SET nodes=?, versionId=?, updatedAt=NOW()`
6. `UPDATE workflow_history SET nodes=?, connections=?, versionId=?, updatedAt=NOW()` ← **chave do fix**
7. Outro `wal_checkpoint(TRUNCATE)` para garantir gravação
8. `docker start n8n-n8n-1` + `chown 1000:1000`

## Verificação pós-deploy

```bash
# Enviar webhook teste
TS=$(date +%s) && curl -s -X POST 'https://n8n.srv1537041.hstgr.cloud/webhook/whatsapp' \
  -H 'Content-Type: application/json' \
  -d "{\"event\":\"messages.upsert\",\"data\":{\"key\":{\"remoteJid\":\"554391663335@s.whatsapp.net\",\"fromMe\":false,\"id\":\"TEST_$TS\"},\"message\":{\"conversation\":\"oi\"},\"messageTimestamp\":$TS,\"pushName\":\"Franquelin\"}}"

# Checar tokens (alvo: 5-8k para "oi", não 30k+)
docker exec n8n-postgres-1 psql -U zazz -d zazzdb -c \
  "SELECT id, mensagem, tokens_input FROM bot_conversas ORDER BY id DESC LIMIT 3"
```

## Webhook payload format (Filter1)

O nó `Filter1` rejeita payloads que não tenham:
- `event === 'messages.upsert'` **no nível raiz** (NÃO dentro de `body`)
- `data.key.fromMe === false`
- `data.message` presente

Se enviar com wrapper extra (`{body: {event:..., data:...}}`), o n8n duplica como `$json.body.body`, e o filtro recusa silenciosamente.

Formato correto pra teste sintético:
```json
{
  "event": "messages.upsert",
  "data": {
    "key": {"remoteJid": "554391663335@s.whatsapp.net", "fromMe": false, "id": "TEST_001"},
    "message": {"conversation": "oi"},
    "messageTimestamp": <UNIX_TIMESTAMP>,
    "pushName": "Franquelin"
  }
}
```

⚠️ `messageTimestamp` precisa estar dentro de **2 minutos** (cutoff em `Verifica Menção`) — usar `$(date +%s)` no shell.

## Por que `update:workflow` CLI não basta sozinho

O comando `n8n update:workflow --id=X --active=true` (deprecated) ou `n8n publish:workflow` falha com:
> `Version "<vid>" not found for workflow "<wid>"`

…quando o `versionId` em `workflow_entity` não existe em `workflow_history`. Então primeiro tem que **criar/atualizar** a entry em `workflow_history` com o mesmo `versionId`.

## Por que `workflow_published_version` precisa existir mas estar consistente

Se a tabela ficar **vazia** para um workflow ativo: webhook → `404 Active version not found for workflow with id "X"`.

Se ficar **inconsistente** (versionId da published_version não bate com workflow_history): mesmo erro 404.

Solução: **NUNCA INSERT manual**. Usar `n8n publish:workflow --id=X` via CLI dentro do container — ele resolve. Ou simplesmente deixar como está se já funcionou no boot.

## Restart do n8n vs CLI commands

CLI commands (`n8n update:workflow`, `n8n publish:workflow`, `n8n unpublish:workflow`) avisam:
> `Note: Changes will not take effect if n8n is running. Please restart n8n for changes to take effect`

Sempre `docker restart n8n-n8n-1` após CLI commands, **mesmo que o comando diga sucesso**.

## Comandos de diagnóstico úteis

```python
# Ver versionId em todas as tabelas relevantes
import sqlite3
con = sqlite3.connect("/var/lib/docker/volumes/n8n_data/_data/database.sqlite", timeout=5)
cur = con.cursor()
cur.execute("SELECT versionId, active FROM workflow_entity WHERE id='Pj5SdaxFh9H9EIX4'")
print("entity:", cur.fetchone())
cur.execute("SELECT versionId FROM workflow_history WHERE workflowId='Pj5SdaxFh9H9EIX4'")
print("history:", cur.fetchall())
cur.execute("SELECT * FROM workflow_published_version WHERE workflowId='Pj5SdaxFh9H9EIX4'")
print("published:", cur.fetchall())
```

```python
# Inspecionar uma execução específica (modelo, system size, tokens, chamados)
# Use /tmp/check_exec.py — copiado do laptop:
python3 /tmp/check_exec.py 55023
```

Saída esperada com fix aplicado:
```
model: claude-haiku-4-5-20251001
system: ARRAY (cache split)
  block 0: type=text cache={'type': 'ephemeral'} size=24391
  block 1: type=text cache= size=16398
TOTAL system size: 40789
chamadosCarregados: 'NAO'
input_tokens: ['6822']
```

## Histórico de bugs nesta sessão (mai/2026)

1. **`chamadosContext` injetado mesmo com `chamadosContext = ''` no código**: causa = workflow_history desatualizada (n8n executando versão antiga).
2. **`model = claude-sonnet-4-6` mesmo com SQLite tendo `claude-haiku-4-5-20251001`**: mesma causa acima.
3. **`popsUsados = ''` (sempre vazio)**: bug em `Monta_Prompt.js:262` — string literal vazia. Fix: `popsUsados = todosOsPops.map(p => p.titulo).join(', ')`.
4. **EVOLUTIVO no bloco estável quebrava o cache**: cada mensagem traz notas Obsidian diferentes via `Busca Evolutivo`. Movido para o bloco dinâmico (`{{EVOLUTIVO}}` → vazio + `evolutivoSection` somado em `dynamic`).
5. **Webhook teste retornava 404 com payload correto**: `Filter1` exige `event` no nível raiz, não em `body`. Sem isso, request passa pelo webhook mas o filtro descarta.

## Checklist de sanidade ao mexer no Monta Prompt

- [ ] `chamadosContext = ''` (chamados via tool, não no prompt)
- [ ] `popsUsados = todosOsPops.map(p => p.titulo).join(', ')` (não string vazia)
- [ ] Apenas TÍTULOS de POPs no prompt; conteúdo via `buscar_pop`
- [ ] EVOLUTIVO no bloco dinâmico (linha do `dynamic =` inclui `evolutivoSection`)
- [ ] Marker `{{HISTORICO}}` é trocado por `__CACHE_SPLIT__`
- [ ] Block 0 (estável) tem `cache_control: ephemeral`
- [ ] Block 1 (dinâmico) **não** tem `cache_control`
- [ ] `model: "claude-haiku-4-5-20251001"`
- [ ] `redisHistory.slice(-10)` (não -20)
- [ ] Após deploy, `Monta Prompt` e `Monta Prompt Relatório` corretos — eles NÃO são idênticos (o Relatório tem o filtro de histórico por dia); o `--check` do deploy_workflow.py confirma que cada nó ficou com o código certo

## Resultado final

| Métrica | Antes | Depois |
|---|---|---|
| `tokens_input` para "oi" | 30.866 | 6.822 |
| Modelo | claude-sonnet-4-6 | claude-haiku-4-5-20251001 |
| System size | 79.990 chars | 40.789 chars |
| Cache split | quebrado | 2 blocos (24k estável + 16k dinâmico) |
| POPs no prompt | conteúdo completo (~30k) | só títulos (~1.5k) |
| `chamadosContext` | injetado (~7.5k) | vazio (tool sob demanda) |
| `pops_usados` no DB | vazio (bug) | titles list ✓ |

---

**Ver também:** [[Deploy]] · [[Workflow N8N]] · [[Prompt Caching]] · [[agent-loop-tool-use]] · [[workflow-n8n]] · [[fix-scripts-historicos]]
