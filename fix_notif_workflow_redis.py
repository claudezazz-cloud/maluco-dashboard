"""Corrige parâmetros dos nós Redis no workflow de notificação."""
import json, os, urllib.request, urllib.error
from dotenv import load_dotenv
load_dotenv()

N8N_URL = os.getenv("N8N_URL", "https://n8n.srv1537041.hstgr.cloud")
N8N_API_KEY = os.getenv("N8N_API_KEY", "")
WF_ID = "Urf233bK6RqoSlQs"
HEADERS = {"X-N8N-API-KEY": N8N_API_KEY, "Content-Type": "application/json"}
ALLOWED = {"name", "nodes", "connections", "settings", "staticData"}

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

wf = req("GET", f"/workflows/{WF_ID}")
nodes = wf["nodes"]

for n in nodes:
    if n.get("type") != "n8n-nodes-base.redis":
        continue
    p = n["parameters"]
    # Renomear propertyName → key
    if "propertyName" in p:
        p["key"] = p.pop("propertyName")
    # Busca: adicionar options
    if p.get("operation") == "get" and "options" not in p:
        p["options"] = {}
    print(f"  Corrigido: {n['name']} → {json.dumps(p)}")

body = {k: v for k, v in wf.items() if k in ALLOWED}
req("PUT", f"/workflows/{WF_ID}", body)
print("PUT enviado.")

req("POST", f"/workflows/{WF_ID}/activate")
print("✅ Workflow ativado com sucesso!")
