"""
fix_redis_ttl.py — Ajusta TTL do node "Salva Histórico Redis" de 14400s (4h) para 43200s (12h).
Isso garante que o histórico de conversa cubra um turno completo de trabalho.
"""
import json, urllib.request, urllib.error, ssl, time, sys, io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

N8N_URL     = "https://n8n.srv1537041.hstgr.cloud"
N8N_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkNDE5ZWU0MC0wMmFiLTQ1OGUtODMzMi1lN2E1OWEwYzRmMTAiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMDEzY2FkYmQtMmM4Yi00ZjZlLWFjYmQtOTY2ODI1MGUwZDcxIiwiaWF0IjoxNzc3MzgxNDEzfQ.tKyTjOHjsWaMBk0sonCHoXjupA5QErEEuqEj-ZSEY1s"
WORKFLOW_ID = "DiInHUnddtFACSmj"
OLD_TTL     = 14400
NEW_TTL     = 43200

HEADERS = {"X-N8N-API-KEY": N8N_API_KEY, "Content-Type": "application/json"}
ALLOWED = {"name", "nodes", "connections", "settings", "staticData"}
ALLOWED_SETTINGS = {
    "executionOrder","saveManualExecutions","callerPolicy",
    "errorWorkflow","timezone","saveDataSuccessExecution",
    "saveDataErrorExecution","saveExecutionProgress"
}
ctx = ssl.create_default_context()


def req(method, path, body=None):
    url  = f"{N8N_URL}/api/v1{path}"
    data = json.dumps(body, ensure_ascii=False).encode("utf-8") if body else None
    r    = urllib.request.Request(url, data=data, headers=HEADERS, method=method)
    try:
        with urllib.request.urlopen(r, context=ctx, timeout=30) as resp:
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
    print("Buscando workflow principal...")
    wf    = req("GET", f"/workflows/{WORKFLOW_ID}")
    nodes = wf.get("nodes", [])

    target = next((n for n in nodes if n.get("name") == "Salva Histórico Redis"), None)
    if not target:
        print("ERRO: node 'Salva Histórico Redis' não encontrado!")
        return

    atual = target["parameters"].get("ttl")
    print(f"  TTL atual: {atual}s ({atual//3600:.1f}h)")

    if atual == NEW_TTL:
        print(f"  Já está em {NEW_TTL}s — nada a fazer.")
        return

    target["parameters"]["ttl"] = NEW_TTL
    wf["nodes"] = nodes

    print(f"  Atualizando {OLD_TTL}s -> {NEW_TTL}s ({NEW_TTL//3600}h)...")
    deactivate()
    put_wf(wf)
    activate()

    print(f"OK — TTL do histórico Redis atualizado para {NEW_TTL}s (12h).")


if __name__ == "__main__":
    main()
