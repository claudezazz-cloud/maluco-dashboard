"""
fix_alerta_entrega_config.py — Adiciona nó Postgres "Busca Config Entrega" ao workflow
e atualiza Filtra Entrega para ler grupo_notificacao_entrega em vez de grupo_notificacao_ok.
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

NEW_CONFIG_NODE = {
    "id": "node-config-entrega",
    "name": "Busca Config Entrega",
    "type": "n8n-nodes-base.postgres",
    "typeVersion": 2.5,
    "position": [420, 560],
    "parameters": {
        "operation": "executeQuery",
        "query": "SELECT valor FROM dashboard_config WHERE chave = 'grupo_notificacao_entrega' LIMIT 1",
        "options": {}
    },
    "credentials": {
        "postgres": {"id": "AErqeMtSVfS0MNsb", "name": "Postgres account"}
    }
}

# Novo código do Filtra Entrega lendo do nó próprio
OLD_GRUPO_LINE = "const grupoNotif = ($('Busca Config Notif').first().json?.valor || '').trim();"
NEW_GRUPO_LINE = "const grupoNotif = ($('Busca Config Entrega').first().json?.valor || '').trim();"

def main():
    print("Buscando workflow...")
    wf    = req("GET", f"/workflows/{WORKFLOW_ID}")
    nodes = wf.get("nodes", [])
    conns = wf.get("connections", {})
    changed = False

    # 1. Adicionar nó Busca Config Entrega se não existir
    if any(n.get("name") == "Busca Config Entrega" for n in nodes):
        print("  Busca Config Entrega ja existe")
    else:
        nodes.append(NEW_CONFIG_NODE)
        print("  [OK] No Busca Config Entrega adicionado")
        changed = True

    # 2. Conectar trigger → Busca Config Entrega → Busca Tarefas Vencendo
    trigger = next((n for n in nodes if "schedule" in n.get("type","").lower()), None)
    if trigger:
        trigger_name = trigger["name"]
        # Remover conexão direta trigger → Busca Tarefas Vencendo
        if trigger_name in conns:
            main_conns = conns[trigger_name]["main"][0]
            conns[trigger_name]["main"][0] = [
                c for c in main_conns if c.get("node") != "Busca Tarefas Vencendo"
            ]
            # Adicionar trigger → Busca Config Entrega
            if not any(c.get("node") == "Busca Config Entrega" for c in conns[trigger_name]["main"][0]):
                conns[trigger_name]["main"][0].append(
                    {"node": "Busca Config Entrega", "type": "main", "index": 0}
                )
        # Busca Config Entrega → Busca Tarefas Vencendo
        if "Busca Config Entrega" not in conns:
            conns["Busca Config Entrega"] = {
                "main": [[{"node": "Busca Tarefas Vencendo", "type": "main", "index": 0}]]
            }
            print("  [OK] Conexao Config Entrega -> Busca Tarefas adicionada")
            changed = True

    # 3. Atualizar referência no código do Filtra Entrega
    filtra = next((n for n in nodes if n.get("name") == "Filtra Entrega"), None)
    if filtra:
        code = filtra["parameters"].get("jsCode", "")
        if OLD_GRUPO_LINE in code:
            filtra["parameters"]["jsCode"] = code.replace(OLD_GRUPO_LINE, NEW_GRUPO_LINE)
            print("  [OK] Filtra Entrega atualizado para ler Busca Config Entrega")
            changed = True
        elif "Busca Config Entrega" in code:
            print("  Filtra Entrega ja usa Busca Config Entrega")
        else:
            print("  AVISO: padrao nao encontrado em Filtra Entrega")
    else:
        print("  AVISO: no Filtra Entrega nao encontrado")

    if not changed:
        print("Nada a alterar.")
        return

    wf["nodes"] = nodes
    wf["connections"] = conns

    print("Desativando workflow...")
    deactivate()
    print("Enviando workflow atualizado...")
    put_wf(wf)
    print("Reativando workflow...")
    activate()
    print("Pronto! Alerta de entrega agora usa grupo_notificacao_entrega do banco.")

if __name__ == "__main__":
    main()
