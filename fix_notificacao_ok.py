"""
Adiciona fluxo de notificação de tarefa concluída no N8N.

Após 'Marca Ok no Notion' → Busca Config Notif Ok (Postgres)
                           → Envia Notif Ok (HTTP → Evolution API)

A notificação só é enviada se:
1. Há um grupo configurado em dashboard_config (chave: grupo_notificacao_ok)
2. O grupo é diferente do chat de origem (evita mensagem dupla)
"""

import json, os, sys, time, urllib.request, urllib.error
from dotenv import load_dotenv
load_dotenv()

N8N_URL = os.getenv("N8N_URL", "https://n8n.srv1537041.hstgr.cloud")
N8N_API_KEY = os.getenv("N8N_API_KEY", "")
EVOLUTION_URL = os.getenv("EVOLUTION_URL", "https://evolution.srv1537041.hstgr.cloud")
EVOLUTION_KEY = os.getenv("EVOLUTION_APIKEY", "")
EVOLUTION_INSTANCE = os.getenv("EVOLUTION_INSTANCE", "ZazzChip")
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

# Nó 1: busca o grupo configurado no banco
BUSCA_CONFIG_NODE = {
    "parameters": {
        "operation": "executeQuery",
        "query": "SELECT valor FROM dashboard_config WHERE chave = 'grupo_notificacao_ok' LIMIT 1",
        "options": {},
    },
    "id": "busca-config-notif-ok",
    "name": "Busca Config Notif Ok",
    "type": "n8n-nodes-base.postgres",
    "typeVersion": 2.4,
    "position": [0, 0],  # será ajustado
    "executeOnce": True,
    "alwaysOutputData": True,
    "credentials": {"postgres": {"id": "AErqeMtSVfS0MNsb", "name": "Postgres account"}},
}

# Nó 2: Code que decide se envia e monta o payload
DECIDE_NOTIF_NODE = {
    "parameters": {
        "jsCode": """
const ok = $input.first().json;
const configRow = $('Busca Config Notif Ok').first().json;
const grupoNotif = (configRow?.valor || '').trim();

// Se não há grupo configurado, não envia
if (!grupoNotif) return [];

// Dados da tarefa marcada como Ok
const chatId = ok.chatId || '';
const titulo = ok.titulo || 'Tarefa';
const cliente = ok.cliente || '';
const remetente = ok.remetente || ok.senderName || '';

// Evita notif se o bot está respondendo no próprio grupo de notificação
// (mensagem duplicada — o bot já respondeu lá)
if (chatId === grupoNotif) return [];

const clienteStr = cliente ? ` — *${cliente}*` : '';
const remetenteStr = remetente ? `\\n_Concluída por: ${remetente}_` : '';
const msg = `✅ Tarefa concluída no Notion!\\n\\n*${titulo}*${clienteStr}${remetenteStr}`;

return [{ json: { grupoNotif, msg } }];
""",
    },
    "id": "decide-notif-ok",
    "name": "Decide Notif Ok",
    "type": "n8n-nodes-base.code",
    "typeVersion": 2,
    "position": [0, 0],
}

# Nó 3: HTTP Request → Evolution API
def make_envia_node(evolution_url, evolution_key, instance):
    return {
        "parameters": {
            "method": "POST",
            "url": f"{evolution_url}/message/sendText/{instance}",
            "sendHeaders": True,
            "headerParameters": {
                "parameters": [
                    {"name": "apikey", "value": evolution_key},
                    {"name": "Content-Type", "value": "application/json"},
                ]
            },
            "sendBody": True,
            "specifyBody": "json",
            "jsonBody": '={"number": "{{ $json.grupoNotif }}", "text": "{{ $json.msg }}"}',
            "options": {"timeout": 10000},
        },
        "id": "envia-notif-ok",
        "name": "Envia Notif Ok",
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4.3,
        "position": [0, 0],
        "continueOnFail": True,
    }

def find_node(nodes, name):
    return next((n for n in nodes if n.get("name") == name), None)

def get_position(nodes, name, offset_x=250, offset_y=0):
    n = find_node(nodes, name)
    if n:
        x, y = n.get("position", [0, 0])
        return [x + offset_x, y + offset_y]
    return [0, 0]

def main():
    print("Buscando workflow...")
    wf = get_wf()
    nodes = wf.get("nodes", [])
    conns = wf.get("connections", {})

    # Verificar se já existe
    if any(n.get("id") == "busca-config-notif-ok" for n in nodes):
        print("Nós de notificação já existem. Abortando.")
        return

    # Encontrar "Marca Ok no Notion" para posicionar os novos nós
    marca_ok = find_node(nodes, "Marca Ok no Notion")
    if not marca_ok:
        print("ERRO: nó 'Marca Ok no Notion' não encontrado!")
        sys.exit(1)

    mx, my = marca_ok.get("position", [0, 0])
    BUSCA_CONFIG_NODE["position"] = [mx + 280, my]
    DECIDE_NOTIF_NODE["position"] = [mx + 560, my]

    # Buscar credenciais Evolution da instância existente
    ev_node = next((n for n in nodes if "evolution" in n.get("name","").lower()
                    and n.get("type") == "n8n-nodes-base.httpRequest"), None)
    ev_url = EVOLUTION_URL
    ev_key = EVOLUTION_KEY
    ev_instance = EVOLUTION_INSTANCE
    if ev_node:
        # Tentar extrair URL da instância do nó existente
        url_param = ev_node.get("parameters", {}).get("url", "")
        if url_param and "evolution" in url_param:
            # ex: https://evolution.xxx.com/message/sendText/ZazzChip
            parts = url_param.rstrip("/").split("/")
            if len(parts) >= 2:
                ev_instance = parts[-1]
                ev_url = "/".join(parts[:3])
        # Pegar apikey dos headers
        for h in ev_node.get("parameters", {}).get("headerParameters", {}).get("parameters", []):
            if h.get("name", "").lower() == "apikey":
                ev_key = h.get("value", ev_key)
    print(f"  Evolution: {ev_url}, instance: {ev_instance}")

    envia_node = make_envia_node(ev_url, ev_key, ev_instance)
    envia_node["position"] = [mx + 840, my]

    nodes += [BUSCA_CONFIG_NODE, DECIDE_NOTIF_NODE, envia_node]

    # Conexões:
    # Marca Ok no Notion → Busca Config Notif Ok
    if "Marca Ok no Notion" not in conns:
        conns["Marca Ok no Notion"] = {"main": [[]]}
    mok_main = conns["Marca Ok no Notion"].setdefault("main", [[]])
    if not mok_main: mok_main.append([])
    if not any(t.get("node") == "Busca Config Notif Ok" for t in mok_main[0]):
        mok_main[0].append({"node": "Busca Config Notif Ok", "type": "main", "index": 0})

    # Busca Config Notif Ok → Decide Notif Ok
    conns["Busca Config Notif Ok"] = {"main": [[{"node": "Decide Notif Ok", "type": "main", "index": 0}]]}

    # Decide Notif Ok → Envia Notif Ok
    conns["Decide Notif Ok"] = {"main": [[{"node": "Envia Notif Ok", "type": "main", "index": 0}]]}

    wf["nodes"] = nodes
    wf["connections"] = conns

    print("Desativando workflow...")
    deactivate()
    print("Enviando workflow atualizado...")
    put_wf(wf)
    print("Reativando workflow...")
    activate()
    print("✅ Pronto! Notificação de tarefa Ok adicionada ao workflow.")

if __name__ == "__main__":
    main()
