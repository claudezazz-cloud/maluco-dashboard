"""
fix_regras_formatacao.py — Insere duas regras críticas no banco:
1. Proibição absoluta de ## / ### em respostas
2. Identificação correta do remetente (não confundir com nomes no texto)
"""
import json, urllib.request, ssl, time, urllib.error, uuid

N8N_URL = "https://n8n.srv1537041.hstgr.cloud"
API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkNDE5ZWU0MC0wMmFiLTQ1OGUtODMzMi1lN2E1OWEwYzRmMTAiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMDEzY2FkYmQtMmM4Yi00ZjZlLWFjYmQtOTY2ODI1MGUwZDcxIiwiaWF0IjoxNzc3MzgxNDEzfQ.tKyTjOHjsWaMBk0sonCHoXjupA5QErEEuqEj-ZSEY1s"
PG_CRED_ID = "AErqeMtSVfS0MNsb"
ctx = ssl.create_default_context()

REGRAS = [
    "PROIBIDO usar ##, ###, ----, ==== ou qualquer símbolo de título/cabeçalho Markdown. O WhatsApp NÃO renderiza Markdown de cabeçalho. Use *negrito* para destaque e _itálico_ para ênfase. NUNCA escreva ## nem ### em NENHUMA resposta.",
    "Ao identificar quem enviou uma mensagem, use SEMPRE o campo Remetente exatamente como aparece no histórico no formato [HH:MM] Remetente: mensagem. NUNCA confunda o remetente com nomes citados DENTRO do texto da mensagem. Se a linha diz '[09:30] Franquelin: o Russo foi lá', quem enviou foi Franquelin, não Russo.",
]


def req(method, path, body=None):
    url = f"{N8N_URL}/api/v1{path}"
    data = json.dumps(body, ensure_ascii=False).encode("utf-8") if body else None
    r = urllib.request.Request(url, data=data, method=method,
        headers={"X-N8N-API-KEY": API_KEY, "Content-Type": "application/json", "accept": "application/json"})
    try:
        with urllib.request.urlopen(r, context=ctx, timeout=60) as resp:
            txt = resp.read().decode("utf-8")
            return json.loads(txt) if txt else {}
    except urllib.error.HTTPError as e:
        print("ERR:", e.code, e.read().decode()[:500])
        raise


webhook_path = f"fix-regras-{uuid.uuid4().hex[:8]}"

# Build INSERT statements for each regra
inserts = []
for regra in REGRAS:
    escaped = regra.replace("'", "''")
    inserts.append(
        f"INSERT INTO regras (regra) SELECT '{escaped}' "
        f"WHERE NOT EXISTS (SELECT 1 FROM regras WHERE regra = '{escaped}')"
    )
sql = "; ".join(inserts)

js_code = (
    "const sql = " + json.dumps(sql, ensure_ascii=False) + ";\n"
    "return [{ json: { sql } }];\n"
)

wf_body = {
    "name": f"TEMP Fix Regras Formatacao {webhook_path}",
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
            "name": "Build SQL",
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
            "name": "Insert Regras",
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
        "Webhook": {"main": [[{"node": "Build SQL", "type": "main", "index": 0}]]},
        "Build SQL": {"main": [[{"node": "Insert Regras", "type": "main", "index": 0}]]},
    },
    "settings": {"executionOrder": "v1"},
}

print("Criando workflow temporário...")
created = req("POST", "/workflows", wf_body)
wf_id = created["id"]
print(f"  id: {wf_id}")

try:
    print("Ativando...")
    req("POST", f"/workflows/{wf_id}/activate")
    time.sleep(2)

    print(f"Executando via webhook...")
    r = urllib.request.Request(f"{N8N_URL}/webhook/{webhook_path}", method="GET")
    with urllib.request.urlopen(r, context=ctx, timeout=60) as resp:
        out = resp.read().decode("utf-8")
        print(f"  resposta: {out[:300]}")
finally:
    print("Desativando e deletando workflow temporário...")
    try: req("POST", f"/workflows/{wf_id}/deactivate")
    except Exception as e: print("  deact:", e)
    try: req("DELETE", f"/workflows/{wf_id}")
    except Exception as e: print("  del:", e)

print()
print("Regras inseridas:")
for i, r in enumerate(REGRAS, 1):
    print(f"  {i}. {r[:80]}...")
print("OK.")
