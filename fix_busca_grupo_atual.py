"""
fix_busca_grupo_atual.py
Adiciona no "Busca Grupo Atual" (Postgres) ao workflow principal.
Encadeia: Busca Evolutivo -> Busca Grupo Atual -> Monta Prompt
O no le nome e descricao do grupo na tabela grupos_whatsapp usando o chatId.
"""
import json, time, urllib.request, urllib.error

N8N_URL     = "https://n8n.srv1537041.hstgr.cloud"
N8N_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkNDE5ZWU0MC0wMmFiLTQ1OGUtODMzMi1lN2E1OWEwYzRmMTAiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMDEzY2FkYmQtMmM4Yi00ZjZlLWFjYmQtOTY2ODI1MGUwZDcxIiwiaWF0IjoxNzc3MzgxNDEzfQ.tKyTjOHjsWaMBk0sonCHoXjupA5QErEEuqEj-ZSEY1s"
WORKFLOW_ID = "DiInHUnddtFACSmj"
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

# Usa alwaysOutputData para nao derrubar o fluxo se o grupo nao estiver cadastrado
NEW_NODE = {
    "id": "node-busca-grupo-atual",
    "name": "Busca Grupo Atual",
    "type": "n8n-nodes-base.postgres",
    "typeVersion": 2.5,
    "position": [14624, 9360],
    "parameters": {
        "operation": "executeQuery",
        "query": "SELECT nome, descricao FROM grupos_whatsapp WHERE chat_id = '{{ $('Verifica Mencao').first().json.chatId }}' LIMIT 1",
        "options": {"alwaysOutputData": True}
    },
    "credentials": {"postgres": PG_CRED}
}

def main():
    print("Buscando workflow...")
    wf    = req("GET", f"/workflows/{WORKFLOW_ID}")
    nodes = wf.get("nodes", [])
    conns = wf.get("connections", {})

    if find_node(nodes, "Busca Grupo Atual"):
        print("No 'Busca Grupo Atual' ja existe. Nada a fazer.")
        return

    # Verifica se Busca Evolutivo e Monta Prompt existem
    busca_evo   = find_node(nodes, "Busca Evolutivo")
    monta_prompt = find_node(nodes, "Monta Prompt")
    if not busca_evo or not monta_prompt:
        print("ERRO: Busca Evolutivo ou Monta Prompt nao encontrados!")
        return

    # Ajusta posicao entre os dois nos
    x = (busca_evo["position"][0] + monta_prompt["position"][0]) // 2
    y = busca_evo["position"][1]
    NEW_NODE["position"] = [x, y]

    nodes.append(NEW_NODE)
    print(f"  [OK] No 'Busca Grupo Atual' adicionado em posicao {NEW_NODE['position']}")

    # Reconectar: Busca Evolutivo -> Busca Grupo Atual -> Monta Prompt
    # Remove conexao direta Busca Evolutivo -> Monta Prompt
    if "Busca Evolutivo" in conns:
        conns["Busca Evolutivo"]["main"][0] = [
            c for c in conns["Busca Evolutivo"]["main"][0]
            if c.get("node") != "Monta Prompt"
        ]
        if not any(c.get("node") == "Busca Grupo Atual" for c in conns["Busca Evolutivo"]["main"][0]):
            conns["Busca Evolutivo"]["main"][0].append(
                {"node": "Busca Grupo Atual", "type": "main", "index": 0}
            )

    # Busca Grupo Atual -> Monta Prompt
    conns["Busca Grupo Atual"] = {
        "main": [[{"node": "Monta Prompt", "type": "main", "index": 0}]]
    }
    print("  [OK] Conexao: Busca Evolutivo -> Busca Grupo Atual -> Monta Prompt")

    wf["nodes"] = nodes
    wf["connections"] = conns

    print("Desativando workflow...")
    deactivate()
    print("Enviando workflow atualizado...")
    put_wf(wf)
    print("Reativando workflow...")
    activate()
    print()
    print("Pronto! Bot agora sabe em qual grupo esta respondendo.")
    print("  - Le grupos_whatsapp.nome e descricao pelo chatId")
    print("  - Injeta '[Contexto: voce esta no grupo X]' no inicio do system prompt")

if __name__ == "__main__":
    main()
