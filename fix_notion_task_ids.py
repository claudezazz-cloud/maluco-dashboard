"""
fix_notion_task_ids.py — Inclui o page_id de cada tarefa na lista do Monta Prompt.

Bug: a linha de cada tarefa era formatada como:
  - [status] descrição | cliente: X | ...

O bot não tinha o ID → não conseguia emitir |||NOTION_OK||| sem inventar.

Fix: incluir o id no início da linha, conforme o system prompt documenta:
  [id:abc123def456] [status] descrição | ...
"""
import json, os, sys, time, urllib.request, urllib.error
from dotenv import load_dotenv
load_dotenv()

N8N_URL = os.getenv("N8N_URL", "https://n8n.srv1537041.hstgr.cloud")
N8N_API_KEY = os.getenv("N8N_API_KEY", "")
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

# Linha antiga — sem o id
OLD_LINE = "      let line = `- [${status || 'sem status'}] ${desc}`;"
# Linha nova — com id no início, sem traços (padrão do system prompt)
NEW_LINE = "      let line = `[id:${p.id.replace(/-/g, '')}] [${status || 'sem status'}] ${desc}`;"

def main():
    print("Buscando workflow...")
    wf = get_wf()
    nodes = wf.get("nodes", [])

    mp = next((n for n in nodes if n.get("name") == "Monta Prompt"
               and n.get("type") == "n8n-nodes-base.code"), None)
    if not mp:
        print("ERRO: Monta Prompt não encontrado!")
        sys.exit(1)

    code = mp["parameters"].get("jsCode", "")

    if OLD_LINE not in code:
        if "p.id.replace" in code:
            print("✅ page_id já incluído nas linhas de tarefa.")
        else:
            # Tenta encontrar a linha para diagnóstico
            for i, l in enumerate(code.split('\n')):
                if 'let line' in l and 'status' in l:
                    print(f"  Linha atual (L{i+1}): {l.strip()}")
            print("AVISO: padrão OLD_LINE não encontrado. Verifique manualmente.")
        sys.exit(0)

    new_code = code.replace(OLD_LINE, NEW_LINE)
    mp["parameters"]["jsCode"] = new_code
    wf["nodes"] = nodes

    print("Desativando workflow...")
    deactivate()
    print("Enviando workflow corrigido...")
    put_wf(wf)
    print("Reativando workflow...")
    activate()
    print("✅ page_id agora incluído nas linhas de tarefa do Notion!")
    print("   Formato: [id:abc123def456] [status] descrição | ...")

if __name__ == "__main__":
    main()
