"""
fix_grupos_multigrupo_n8n.py
Atualiza o workflow de alertas para enviar para MÚLTIPLOS grupos
configurados na tabela grupos_whatsapp.

Mudanças:
  Notif OK:  Tem Novas? → Busca Grupos OK (novo) → Envia WhatsApp Notif
  Entrega:   Tem Entrega? → Busca Grupos Entrega (novo) → Envia Alerta Entrega

Os nós de envio passam a usar $json.chat_id (vindo do Postgres)
e buscam a mensagem dos respectivos nós Code via $('NomeNode').first().json.msg
"""
import json, time, urllib.request, urllib.error

N8N_URL     = "https://n8n.srv1537041.hstgr.cloud"
N8N_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkNDE5ZWU0MC0wMmFiLTQ1OGUtODMzMi1lN2E1OWEwYzRmMTAiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMDEzY2FkYmQtMmM4Yi00ZjZlLWFjYmQtOTY2ODI1MGUwZDcxIiwiaWF0IjoxNzc3MzgxNDEzfQ.tKyTjOHjsWaMBk0sonCHoXjupA5QErEEuqEj-ZSEY1s"
WORKFLOW_ID = "Urf233bK6RqoSlQs"
PG_CRED     = {"id": "AErqeMtSVfS0MNsb", "name": "Postgres account"}

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

def find_node(nodes, name):
    return next((n for n in nodes if n.get("name") == name), None)

def node_pos(n, dx=0, dy=0):
    x, y = n.get("position", [0, 0])
    return [x + dx, y + dy]

QUERY_GRUPOS_OK = (
    "SELECT chat_id FROM grupos_whatsapp "
    "WHERE ativo = true AND alertas_notion_ok = true "
    "AND chat_id IS NOT NULL AND chat_id != '' "
    "ORDER BY id"
)

QUERY_GRUPOS_ENTREGA = (
    "SELECT chat_id FROM grupos_whatsapp "
    "WHERE ativo = true AND alertas_notion_entrega = true "
    "AND chat_id IS NOT NULL AND chat_id != '' "
    "ORDER BY id"
)

def main():
    print("Buscando workflow...")
    wf    = req("GET", f"/workflows/{WORKFLOW_ID}")
    nodes = wf.get("nodes", [])
    conns = wf.get("connections", {})
    changed = False

    # ── 1. Busca Grupos OK ──────────────────────────────────────────────────
    envia_ok  = find_node(nodes, "Envia WhatsApp Notif")
    tem_novas = find_node(nodes, "Tem Novas?")

    if not find_node(nodes, "Busca Grupos OK"):
        pos = node_pos(envia_ok, 0, -100) if envia_ok else [1520, 280]
        nodes.append({
            "id": "node-grupos-ok",
            "name": "Busca Grupos OK",
            "type": "n8n-nodes-base.postgres",
            "typeVersion": 2.5,
            "position": pos,
            "parameters": {
                "operation": "executeQuery",
                "query": QUERY_GRUPOS_OK,
                "options": {}
            },
            "credentials": {"postgres": PG_CRED}
        })
        print("  [OK] Nó Busca Grupos OK adicionado")
        changed = True

        # Reconectar: Tem Novas? true → Busca Grupos OK → Envia WhatsApp Notif
        if tem_novas:
            tn_name = tem_novas["name"]
            if tn_name in conns:
                conns[tn_name]["main"][0] = [
                    c for c in conns[tn_name]["main"][0]
                    if c.get("node") != "Envia WhatsApp Notif"
                ]
                if not any(c.get("node") == "Busca Grupos OK" for c in conns[tn_name]["main"][0]):
                    conns[tn_name]["main"][0].append(
                        {"node": "Busca Grupos OK", "type": "main", "index": 0}
                    )
        conns["Busca Grupos OK"] = {
            "main": [[{"node": "Envia WhatsApp Notif", "type": "main", "index": 0}]]
        }
        print("  [OK] Conexão Tem Novas? → Busca Grupos OK → Envia WhatsApp Notif")
    else:
        print("  Busca Grupos OK já existe")

    # Atualizar jsonBody do Envia WhatsApp Notif
    if envia_ok:
        old_body = envia_ok["parameters"].get("jsonBody", "")
        new_body = "={{ JSON.stringify({ number: $json.chat_id, text: $('Filtra e Decide').first().json.msg }) }}"
        if old_body != new_body:
            envia_ok["parameters"]["jsonBody"] = new_body
            print("  [OK] Envia WhatsApp Notif: usa $json.chat_id + msg de Filtra e Decide")
            changed = True
        else:
            print("  Envia WhatsApp Notif já atualizado")

    # ── 2. Busca Grupos Entrega ─────────────────────────────────────────────
    envia_ent   = find_node(nodes, "Envia Alerta Entrega")
    tem_entrega = find_node(nodes, "Tem Entrega?")

    if not find_node(nodes, "Busca Grupos Entrega"):
        pos = node_pos(envia_ent, 0, -100) if envia_ent else [1520, 560]
        nodes.append({
            "id": "node-grupos-entrega",
            "name": "Busca Grupos Entrega",
            "type": "n8n-nodes-base.postgres",
            "typeVersion": 2.5,
            "position": pos,
            "parameters": {
                "operation": "executeQuery",
                "query": QUERY_GRUPOS_ENTREGA,
                "options": {}
            },
            "credentials": {"postgres": PG_CRED}
        })
        print("  [OK] Nó Busca Grupos Entrega adicionado")
        changed = True

        if tem_entrega:
            te_name = tem_entrega["name"]
            if te_name in conns:
                conns[te_name]["main"][0] = [
                    c for c in conns[te_name]["main"][0]
                    if c.get("node") != "Envia Alerta Entrega"
                ]
                if not any(c.get("node") == "Busca Grupos Entrega" for c in conns[te_name]["main"][0]):
                    conns[te_name]["main"][0].append(
                        {"node": "Busca Grupos Entrega", "type": "main", "index": 0}
                    )
        conns["Busca Grupos Entrega"] = {
            "main": [[{"node": "Envia Alerta Entrega", "type": "main", "index": 0}]]
        }
        print("  [OK] Conexão Tem Entrega? → Busca Grupos Entrega → Envia Alerta Entrega")
    else:
        print("  Busca Grupos Entrega já existe")

    if envia_ent:
        old_body = envia_ent["parameters"].get("jsonBody", "")
        new_body = "={{ JSON.stringify({ number: $json.chat_id, text: $('Filtra Entrega').first().json.msg }) }}"
        if old_body != new_body:
            envia_ent["parameters"]["jsonBody"] = new_body
            print("  [OK] Envia Alerta Entrega: usa $json.chat_id + msg de Filtra Entrega")
            changed = True
        else:
            print("  Envia Alerta Entrega já atualizado")

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
    print()
    print("Pronto! Alertas agora enviam para todos os grupos configurados.")
    print("  - Notif OK → grupos com alertas_notion_ok = true")
    print("  - Alerta Entrega → grupos com alertas_notion_entrega = true")

if __name__ == "__main__":
    main()
