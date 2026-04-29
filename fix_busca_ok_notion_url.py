"""
fix_busca_ok_notion_url.py — Corrige o database ID errado no nó Busca Ok Notion.
"""
import json, sys, time, urllib.request, urllib.error

N8N_URL   = "https://n8n.srv1537041.hstgr.cloud"
N8N_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkNDE5ZWU0MC0wMmFiLTQ1OGUtODMzMi1lN2E1OWEwYzRmMTAiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMDEzY2FkYmQtMmM4Yi00ZjZlLWFjYmQtOTY2ODI1MGUwZDcxIiwiaWF0IjoxNzc3MzgxNDEzfQ.tKyTjOHjsWaMBk0sonCHoXjupA5QErEEuqEj-ZSEY1s"
WORKFLOW_ID = "Urf233bK6RqoSlQs"
CORRECT_DB  = "d54e5911e8af43dfaed8f2893e59f6ef"
CORRECT_URL = f"https://api.notion.com/v1/databases/{CORRECT_DB}/query"

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

def main():
    print("Buscando workflow...")
    wf    = req("GET", f"/workflows/{WORKFLOW_ID}")
    nodes = wf.get("nodes", [])

    node = next((n for n in nodes if n.get("name") == "Busca Ok Notion"), None)
    if not node:
        print("ERRO: no Busca Ok Notion nao encontrado!")
        sys.exit(1)

    current_url = node["parameters"].get("url", "")
    print(f"  URL atual:   {current_url}")
    print(f"  URL correta: {CORRECT_URL}")

    if current_url == CORRECT_URL:
        print("URL ja esta correta.")
        return

    node["parameters"]["url"] = CORRECT_URL
    wf["nodes"] = nodes

    print("Desativando workflow...")
    deactivate()
    print("Enviando correcao...")
    put_wf(wf)
    print("Reativando workflow...")
    activate()
    print("URL corrigida!")

if __name__ == "__main__":
    main()
