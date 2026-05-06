"""
fix_notion_date_fallback.py — Corrige Data/Entrega no notionBody quando bot não fornece datas.
Bug: notionData.data undefined → {"date": {}} → Notion retorna 400.
Fix: usa hoje como fallback para Data e Entrega.
"""
import json, os, sys, time, urllib.request, urllib.error

N8N_URL = "https://n8n.srv1537041.hstgr.cloud"
N8N_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkNDE5ZWU0MC0wMmFiLTQ1OGUtODMzMi1lN2E1OWEwYzRmMTAiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMDEzY2FkYmQtMmM4Yi00ZjZlLWFjYmQtOTY2ODI1MGUwZDcxIiwiaWF0IjoxNzc3MzgxNDEzfQ.tKyTjOHjsWaMBk0sonCHoXjupA5QErEEuqEj-ZSEY1s"
WORKFLOW_ID = "DiInHUnddtFACSmj"
HEADERS = {"X-N8N-API-KEY": N8N_API_KEY, "Content-Type": "application/json"}
ALLOWED = {"name", "nodes", "connections", "settings", "staticData"}
ALLOWED_SETTINGS = {"executionOrder","saveManualExecutions","callerPolicy",
                    "errorWorkflow","timezone","saveDataSuccessExecution",
                    "saveDataErrorExecution","saveExecutionProgress"}

def req(method, path, body=None):
    url = f"{N8N_URL}/api/v1{path}"
    data = json.dumps(body).encode() if body else None
    r = urllib.request.Request(url, data=data, headers=HEADERS, method=method)
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        print(f"HTTP {e.code}: {e.read().decode()[:500]}")
        raise

def get_wf(): return req("GET", f"/workflows/{WORKFLOW_ID}")
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

OLD = '      "Data": {"date": {"start": data.data}},'
NEW = '      "Data": {"date": data.data ? {"start": data.data} : {"start": new Date().toISOString().split(\'T\')[0]}},'

OLD2 = '      "Entrega": {"date": {"start": data.entrega || data.data}},'
NEW2 = '      "Entrega": {"date": (data.entrega || data.data) ? {"start": data.entrega || data.data} : {"start": new Date().toISOString().split(\'T\')[0]}},'

def main():
    print("Buscando workflow...")
    wf = get_wf()
    nodes = wf.get("nodes", [])

    node = next((n for n in nodes if n.get("name") == "Parse Resposta"
                 and n.get("type") == "n8n-nodes-base.code"), None)
    if not node:
        print("ERRO: Parse Resposta nao encontrado!")
        sys.exit(1)

    code = node["parameters"].get("jsCode", "")
    changed = False

    if OLD in code:
        code = code.replace(OLD, NEW)
        print("  [OK] Data fallback adicionado")
        changed = True
    elif 'data.data ?' in code:
        print("  Data fallback ja presente")
    else:
        print("  AVISO: padrao Data nao encontrado no live workflow")

    if OLD2 in code:
        code = code.replace(OLD2, NEW2)
        print("  [OK] Entrega fallback adicionado")
        changed = True
    elif '(data.entrega || data.data) ?' in code:
        print("  Entrega fallback ja presente")
    else:
        print("  AVISO: padrao Entrega nao encontrado no live workflow")

    if not changed:
        print("Nada a corrigir.")
        return

    node["parameters"]["jsCode"] = code
    wf["nodes"] = nodes

    print("Desativando workflow...")
    deactivate()
    print("Enviando correcao...")
    put_wf(wf)
    print("Reativando workflow...")
    activate()
    print("Correcao aplicada! Data e Entrega agora usam hoje como fallback.")

if __name__ == "__main__":
    main()
