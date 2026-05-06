# Teste sintético do bot via webhook (debug sem WhatsApp)

Técnica descoberta em mai/2026 — permite simular mensagem do usuário direto no webhook do n8n sem precisar mandar via WhatsApp real.

## Quando usar

- Validar deploy do Monta Prompt (verificar tokens caíram)
- Reproduzir bug com payload controlado
- Verificar que tools estão sendo chamadas
- Testar mudanças no agent_loop_code.js sem incomodar o usuário

## Payload mínimo

O webhook (`Pj5SdaxFh9H9EIX4`, path `/whatsapp`) tem um nó `Filter1` que rejeita silenciosamente payloads malformados. A condição é:
```js
$json.body.event === 'messages.upsert' &&
$json.body.data &&
$json.body.data.key &&
$json.body.data.key.fromMe === false &&
$json.body.data.message
```

Formato correto **(SEM wrapper extra `body:`)**:
```json
{
  "event": "messages.upsert",
  "data": {
    "key": {
      "remoteJid": "554391663335@s.whatsapp.net",
      "fromMe": false,
      "id": "TEST_001"
    },
    "message": {"conversation": "oi"},
    "messageTimestamp": 1778000000,
    "pushName": "Franquelin"
  }
}
```

Se enviar com `{"body": {...}}` por fora, o webhook duplica em `$json.body.body` e o filtro recusa.

## Comando completo

```bash
TS=$(date +%s) && curl -s -X POST 'https://n8n.srv1537041.hstgr.cloud/webhook/whatsapp' \
  -H 'Content-Type: application/json' \
  -d "{\"event\":\"messages.upsert\",\"data\":{\"key\":{\"remoteJid\":\"554391663335@s.whatsapp.net\",\"fromMe\":false,\"id\":\"TEST_$TS\"},\"message\":{\"conversation\":\"oi\"},\"messageTimestamp\":$TS,\"pushName\":\"Franquelin\"}}"
```

Resposta esperada: `{"message":"Workflow was started"}` com HTTP 200.

## Pegadinhas

1. **`messageTimestamp` precisa ser recente** — `Verifica Menção` descarta mensagens com mais de 120s. Sempre usar `$(date +%s)` no momento do envio.

2. **JID do remetente real** — usar um JID que esteja em `colaboradores_numeros`, senão o lookup de `remetente canônico` falha e a mensagem é salva como pushName cru. Para Franquelin: `554391663335@s.whatsapp.net`.

3. **DM vs grupo** — DMs (`@s.whatsapp.net`) passam direto pelo filtro de menção. Grupos (`@g.us`) exigem `@bot_number` no texto ou `mentionedJid`.

4. **O bot RESPONDE na vida real** — o webhook dispara Evolution API que envia mensagem ao WhatsApp do usuário. Não use IDs de teste se não quiser que o usuário receba "Oi! 😊 Manda o que precisar!".

## Verificação pós-envio

```bash
# Espera nova execução aparecer
ssh root@195.200.7.239 "until python3 -c \"
import sqlite3
con = sqlite3.connect('/var/lib/docker/volumes/n8n_data/_data/database.sqlite', timeout=5)
cur = con.cursor()
cur.execute(\\\"SELECT COUNT(*) FROM execution_entity WHERE workflowId='Pj5SdaxFh9H9EIX4' AND mode='webhook' AND id > <ID_ANTERIOR>\\\")
exit(0 if cur.fetchone()[0] > 0 else 1)
\"; do sleep 2; done"
```

```bash
# Inspeciona a execução
ssh root@195.200.7.239 'python3 /tmp/check_exec.py <NOVO_ID>'
```

`check_exec.py` (já no VPS em `/tmp/`):
```python
import sqlite3, json, re, sys
DB = "/var/lib/docker/volumes/n8n_data/_data/database.sqlite"
EID = int(sys.argv[1])
con = sqlite3.connect(DB, timeout=5)
cur = con.cursor()
cur.execute("SELECT data FROM execution_data WHERE executionId=?", (EID,))
data = cur.fetchone()[0]
arr = json.loads(data)
# Find claudeBody
for v in arr:
    if isinstance(v, dict) and "model" in v and "max_tokens" in v and "system" in v:
        m = v["model"]; s = v["system"]
        if isinstance(m, str) and m.isdigit(): m = arr[int(m)]
        if isinstance(s, str) and s.isdigit(): s = arr[int(s)]
        print("model:", m)
        if isinstance(s, list):
            total = 0
            for j, b in enumerate(s):
                if isinstance(b, str) and b.isdigit(): b = arr[int(b)]
                if isinstance(b, dict):
                    t = b.get("text", "")
                    if isinstance(t, str) and t.isdigit(): t = arr[int(t)]
                    sz = len(t) if isinstance(t, str) else 0
                    total += sz
                    cc = b.get("cache_control", "")
                    if isinstance(cc, str) and cc.isdigit(): cc = arr[int(cc)]
                    print(f"  block {j}: cache={cc} size={sz}")
            print("TOTAL system size:", total)
        break
m = re.search(r'"chamadosCarregados":"(\d+)"', data)
if m: print("chamadosCarregados:", repr(arr[int(m.group(1))]))
print("input_tokens:", re.findall(r'"input_tokens":(\d+)', data))
print("cache_read_input_tokens:", re.findall(r'"cache_read_input_tokens":(\d+)', data))
print("cache_creation_input_tokens:", re.findall(r'"cache_creation_input_tokens":(\d+)', data))
print("output_tokens:", re.findall(r'"output_tokens":(\d+)', data))
con.close()
```

## Métricas alvo

Para uma mensagem `oi` simples (sem chamadas de tool):

| Métrica | Alvo | Anterior (bug) |
|---|---|---|
| `input_tokens` | 5–8k | 30k+ |
| `output_tokens` | < 50 | similar |
| `system block 0` | ~24k chars (estável) | full prompt sem split |
| `system block 1` | ~16k chars (dinâmico) | inexistente |
| `chamadosCarregados` | `'NAO'` | `'SIM (7398 chars)'` |
| `model` | `claude-haiku-4-5-20251001` | `claude-sonnet-4-6` |

Se NÃO bater com o alvo após deploy, o `workflow_history` provavelmente continua com versão antiga — ver [deploy-workflow.md](deploy-workflow.md).
