"""
fix_envia_whatsapp_notif.py — Corrige JSON inválido no nó Envia WhatsApp Notif.
Bug: msg tem newlines/emojis que quebram interpolação direta no jsonBody.
Fix: usar JSON.stringify para escapar corretamente.
"""
import json, sys, time, urllib.request, urllib.error

N8N_URL     = "https://n8n.srv1537041.hstgr.cloud"
N8N_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkNDE5ZWU0MC0wMmFiLTQ1OGUtODMzMi1lN2E1OWEwYzRmMTAiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMDEzY2FkYmQtMmM4Yi00ZjZlLWFjYmQtOTY2ODI1MGUwZDcxIiwiaWF0IjoxNzc3MzgxNDEzfQ.tKyTjOHjsWaMBk0sonCHoXjupA5QErEEuqEj-ZSEY1s"
WORKFLOW_ID = "Urf233bK6RqoSlQs"

HEADERS = {"X-N8N-API-KEY": N8N_API_KEY, "Content-Type": "application/json"}
ALLOWED = {"name", "nodes", "connections", "settings", "staticData"}
ALLOWED_SETTINGS = {"executionOrder","saveManualExecutions","callerPolicy",
                    "errorWorkflow","timezone","saveDataSuccessExecution",
                    "saveDataErrorExecution","saveExecutionProgress"}

def req(method, path, body=None):
    url  = f"{N8N_URL}/api/v1{path}"
    data = json.dumps(body).encode() if body else None
    r    = urllib.request.Request(url, data=data, headers=HEADERS, method=method)
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        print(f"HTTP {e.code}: {e.read().decode()[:500]}")
        raise

def put_wf(wf):
    body = {k: v for k, v in wf.items() if k in ALLOWED}
    if "settings" in body:
        body["settings"] = {k: v for k, v in body["settings"].items() if k in ALLOWED_SETTINGS}
    return req("PUT", f"/workflows/{WORKFLOW_ID}", body)

def deactivate():
    try: req("POST", f"/workflows/{WORKFLOW_ID}/deactivate")
    except: pass

def activate():
    time.sleep(1)
    req("POST", f"/workflows/{WORKFLOW_ID}/activate")

OLD_BODY = '={"number": "{{ $json.grupoNotif }}", "text": "{{ $json.msg }}"}'
NEW_BODY = '={{ JSON.stringify({ number: $json.grupoNotif, text: $json.msg }) }}'

def main():
    print("Buscando workflow...")
    wf    = req("GET", f"/workflows/{WORKFLOW_ID}")
    nodes = wf.get("nodes", [])

    node = next((n for n in nodes if n.get("name") == "Envia WhatsApp Notif"), None)
    if not node:
        print("ERRO: no Envia WhatsApp Notif nao encontrado!")
        sys.exit(1)

    current = node["parameters"].get("jsonBody", "")
    print(f"  jsonBody atual: {current}")

    if NEW_BODY in current:
        print("  Ja corrigido.")
        return

    if OLD_BODY not in current:
        print(f"  AVISO: padrao nao encontrado. jsonBody atual: {current}")
        print("  Corrigindo mesmo assim para o formato seguro...")

    node["parameters"]["jsonBody"] = NEW_BODY
    wf["nodes"] = nodes

    print("Desativando workflow...")
    deactivate()
    print("Enviando correcao...")
    put_wf(wf)
    print("Reativando workflow...")
    activate()
    print("Corrigido! jsonBody agora usa JSON.stringify para escapar corretamente.")

if __name__ == "__main__":
    main()
