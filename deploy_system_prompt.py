#!/usr/bin/env python3
"""Deploy system_prompt_v2.txt para a tabela dashboard_config via N8N.
Cria um workflow temporario (Manual Trigger -> Code -> Postgres UPDATE), executa e deleta.
O prompt vai EMBUTIDO no Code node como JSON.parse(...) pra evitar interpolacao
das chaves duplas {{...}} pelo n8n."""
import json, urllib.request, ssl, time, urllib.error, uuid

N8N_URL = "https://n8n.srv1537041.hstgr.cloud"
API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkNDE5ZWU0MC0wMmFiLTQ1OGUtODMzMi1lN2E1OWEwYzRmMTAiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiOTQyYWFlZDctYTJkOS00MjJjLWE3OWMtZWMzNzQyMmViOWY4IiwiaWF0IjoxNzc0NzkyNzU2LCJleHAiOjE3NzczNDUyMDB9.bdrA_lXECtGYWsEqQB5FCn4CtZATdI2Mxu3LXQufStA"
PG_CRED_ID = "AErqeMtSVfS0MNsb"
PROMPT_FILE = "system_prompt_v2.txt"
ctx = ssl.create_default_context()


def req(method, path, body=None):
    url = f"{N8N_URL}/api/v1{path}"
    data = json.dumps(body).encode() if body else None
    r = urllib.request.Request(url, data=data, method=method,
        headers={"X-N8N-API-KEY": API_KEY, "Content-Type": "application/json", "accept": "application/json"})
    try:
        with urllib.request.urlopen(r, context=ctx, timeout=60) as resp:
            txt = resp.read().decode()
            return json.loads(txt) if txt else {}
    except urllib.error.HTTPError as e:
        print("ERR:", e.code, e.read().decode()[:500])
        raise


with open(PROMPT_FILE, "r", encoding="utf-8") as f:
    new_prompt = f.read()

print(f"Prompt: {len(new_prompt)} chars")

# JSON.stringify-friendly literal: so {{DATA}} permanece literal sem interferencia
prompt_json_literal = json.dumps(new_prompt, ensure_ascii=False)

webhook_path = f"deploy-prompt-{uuid.uuid4().hex[:8]}"

js_code = (
    "// Embute o prompt inteiro como JSON literal — preserva placeholders {{DATA}} etc.\n"
    f"const valor = {prompt_json_literal};\n"
    "// Escapa aspas simples para SQL e monta o INSERT inteiro (sem queryReplacement)\n"
    "const escaped = valor.replace(/'/g, \"''\");\n"
    "const sql = \"INSERT INTO dashboard_config (chave, valor) VALUES ('system_prompt', '\" + escaped + \"') ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor RETURNING chave, length(valor) AS tamanho\";\n"
    "return [{ json: { sql, len: valor.length } }];\n"
)

wf_body = {
    "name": f"TEMP Deploy System Prompt {webhook_path}",
    "nodes": [
        {
            "id": "trig",
            "name": "Webhook",
            "type": "n8n-nodes-base.webhook",
            "typeVersion": 2,
            "position": [0, 0],
            "parameters": {
                "httpMethod": "GET",
                "path": webhook_path,
                "responseMode": "lastNode",
            },
            "webhookId": webhook_path,
        },
        {
            "id": "code",
            "name": "Build Prompt",
            "type": "n8n-nodes-base.code",
            "typeVersion": 2,
            "position": [300, 0],
            "parameters": {
                "mode": "runOnceForAllItems",
                "jsCode": js_code,
            },
        },
        {
            "id": "pg",
            "name": "Update System Prompt",
            "type": "n8n-nodes-base.postgres",
            "typeVersion": 2.5,
            "position": [600, 0],
            "parameters": {
                "operation": "executeQuery",
                "query": "={{ $json.sql }}",
                "options": {},
            },
            "credentials": {
                "postgres": {"id": PG_CRED_ID, "name": "Postgres account"}
            },
        },
    ],
    "connections": {
        "Webhook": {"main": [[{"node": "Build Prompt", "type": "main", "index": 0}]]},
        "Build Prompt": {"main": [[{"node": "Update System Prompt", "type": "main", "index": 0}]]},
    },
    "settings": {"executionOrder": "v1"},
}

print("POST workflow temporario...")
created = req("POST", "/workflows", wf_body)
wf_id = created["id"]
print(f"  id: {wf_id}")

try:
    print("Activate...")
    req("POST", f"/workflows/{wf_id}/activate")
    time.sleep(2)

    print(f"Hit webhook /webhook/{webhook_path} ...")
    r = urllib.request.Request(f"{N8N_URL}/webhook/{webhook_path}", method="GET")
    with urllib.request.urlopen(r, context=ctx, timeout=60) as resp:
        out = resp.read().decode()
        print(f"  resposta: {out[:300]}")
finally:
    print("Deactivate + delete...")
    try: req("POST", f"/workflows/{wf_id}/deactivate")
    except Exception as e: print("  deact:", e)
    try: req("DELETE", f"/workflows/{wf_id}")
    except Exception as e: print("  del:", e)

print("OK.")
