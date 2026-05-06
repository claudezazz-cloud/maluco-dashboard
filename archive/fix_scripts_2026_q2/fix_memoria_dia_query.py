"""
fix_memoria_dia_query.py
Corrige Busca Mensagens Hoje para usar expressao N8N correta.

Bug: {{ $json.chat_id }} no SQL nao era interpolado em alguns contextos,
retornando 0 linhas -> msgs.length < 3 -> Prepara Prompt Dia retorna []
-> nada e salvo na bot_memoria_dia.

Fix: transformar query em expressao ={{ }} com template literal JS.
Tambem adiciona chat_id no SELECT para o Prepara Prompt Dia conseguir ler.
"""
import json, time, urllib.request, urllib.error

N8N_URL     = "https://n8n.srv1537041.hstgr.cloud"
N8N_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkNDE5ZWU0MC0wMmFiLTQ1OGUtODMzMi1lN2E1OWEwYzRmMTAiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMDEzY2FkYmQtMmM4Yi00ZjZlLWFjYmQtOTY2ODI1MGUwZDcxIiwiaWF0IjoxNzc3MzgxNDEzfQ.tKyTjOHjsWaMBk0sonCHoXjupA5QErEEuqEj-ZSEY1s"
WORKFLOW_ID = "5qTcBwOdBeoU1l7i"

HEADERS = {"X-N8N-API-KEY": N8N_API_KEY, "Content-Type": "application/json"}
ALLOWED = {"name", "nodes", "connections", "settings", "staticData"}
ALLOWED_SETTINGS = {
    "executionOrder", "saveManualExecutions", "callerPolicy",
    "errorWorkflow", "timezone", "saveDataSuccessExecution",
    "saveDataErrorExecution", "saveExecutionProgress"
}

# Expressao N8N: o = no inicio indica que o campo inteiro e uma expressao JS
# Template literal para interpolar chat_id de forma segura
NEW_QUERY = (
    "=`SELECT chat_id, remetente, mensagem, data_hora "
    "FROM mensagens "
    "WHERE chat_id = '${$json.chat_id}' "
    "AND data_hora >= (NOW() AT TIME ZONE 'America/Sao_Paulo')::date "
    "ORDER BY data_hora ASC LIMIT 200`"
)

def req(method, path, body=None):
    url  = f"{N8N_URL}/api/v1{path}"
    data = json.dumps(body).encode() if body else None
    r    = urllib.request.Request(url, data=data, headers=HEADERS, method=method)
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        print(f"HTTP {e.code}: {e.read().decode()[:400]}")
        raise

def put_wf(wf):
    body = {k: v for k, v in wf.items() if k in ALLOWED}
    if "settings" in body:
        body["settings"] = {k: v for k, v in body["settings"].items() if k in ALLOWED_SETTINGS}
    return req("PUT", f"/workflows/{WORKFLOW_ID}", body)

def main():
    print("Buscando workflow Bot Memoria Dia...")
    wf    = req("GET", f"/workflows/{WORKFLOW_ID}")
    nodes = wf["nodes"]
    changed = False

    for n in nodes:
        if n.get("name") == "Busca Mensagens Hoje":
            old = n["parameters"].get("query", "")
            print(f"  Query atual: {old[:80]}")
            n["parameters"]["query"] = NEW_QUERY
            print(f"  Query nova:  {NEW_QUERY[:80]}")
            changed = True

    if not changed:
        print("No Busca Mensagens Hoje nao encontrado.")
        return

    wf["nodes"] = nodes
    print("Desativando...")
    try: req("POST", f"/workflows/{WORKFLOW_ID}/deactivate")
    except: pass
    print("Enviando correcao...")
    put_wf(wf)
    time.sleep(1)
    print("Reativando...")
    req("POST", f"/workflows/{WORKFLOW_ID}/activate")
    print("Pronto! Disparar o webhook para testar.")

if __name__ == "__main__":
    main()
