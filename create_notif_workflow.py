"""
Cria workflow N8N: "Notificação Tarefa Ok — Notion"

Roda a cada 5 min, busca tarefas com status=Ok alteradas recentemente,
filtra as que ainda não foram notificadas (Redis), e envia mensagem no grupo.

Fluxo:
  Schedule (5min) → Busca Ok Notion → Busca Config DB → Busca Visto Redis
  → Filtra e Decide → IF tem novas → Envia WhatsApp → Salva Visto Redis
"""

import json, os, sys, urllib.request, urllib.error
from dotenv import load_dotenv
load_dotenv()

N8N_URL = os.getenv("N8N_URL", "https://n8n.srv1537041.hstgr.cloud")
N8N_API_KEY = os.getenv("N8N_API_KEY", "")
WORKFLOW_ID = "DiInHUnddtFACSmj"  # workflow principal — para extrair credenciais
HEADERS = {"X-N8N-API-KEY": N8N_API_KEY, "Content-Type": "application/json"}

def req(method, path, body=None):
    url = f"{N8N_URL}/api/v1{path}"
    data = json.dumps(body).encode() if body else None
    r = urllib.request.Request(url, data=data, headers=HEADERS, method=method)
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        print(f"HTTP {e.code}: {e.read().decode()[:600]}")
        raise

# ── Extrair credenciais do workflow principal ─────────────────────────────────
print("Extraindo credenciais do workflow principal...")
main_wf = req("GET", f"/workflows/{WORKFLOW_ID}")
main_nodes = main_wf["nodes"]

notion_token = ""
notion_db_id = ""
ev_url = ""
ev_key = ""
ev_instance = ""
redis_creds = None
pg_creds = None

for n in main_nodes:
    params = n.get("parameters", {})
    url_p = params.get("url", "")
    headers_p = params.get("headerParameters", {}).get("parameters", [])

    # Notion token e DB ID
    if "notion.com/v1/databases" in url_p and "query" in url_p:
        for h in headers_p:
            if h.get("name") == "Authorization":
                notion_token = h["value"].replace("Bearer ", "")
        notion_db_id = url_p.split("/databases/")[1].split("/")[0] if "/databases/" in url_p else ""

    # Evolution API
    if "sendText" in url_p and ("evolution" in url_p or "cloudfy" in url_p):
        parts = url_p.rstrip("/").split("/")
        ev_instance = parts[-1]
        ev_url = "/".join(parts[:3])
        for h in headers_p:
            if h.get("name", "").lower() == "apikey":
                ev_key = h["value"]

    # Redis credentials
    if n.get("type") == "n8n-nodes-base.redis" and not redis_creds:
        redis_creds = n.get("credentials", {}).get("redis")

    # Postgres credentials
    if n.get("type") == "n8n-nodes-base.postgres" and not pg_creds:
        pg_creds = n.get("credentials", {}).get("postgres")

print(f"  Notion DB: {notion_db_id[:20]}... token: {'OK' if notion_token else 'VAZIO'}")
print(f"  Evolution: {ev_url} / {ev_instance}, key: {'OK' if ev_key else 'VAZIO'}")
print(f"  Redis creds: {redis_creds}")
print(f"  Postgres creds: {pg_creds}")

if not notion_token or not notion_db_id:
    print("ERRO: Notion token ou DB ID não encontrado!")
    sys.exit(1)

# ── Montar nós do novo workflow ────────────────────────────────────────────────
X, Y = 200, 300  # posição inicial

nodes = []
connections = {}

def add_node(node, prev_name=None):
    nodes.append(node)
    if prev_name:
        connections.setdefault(prev_name, {"main": [[]]})["main"][0].append(
            {"node": node["name"], "type": "main", "index": 0}
        )

# 1. Schedule Trigger
add_node({
    "id": "sched-notif-ok",
    "name": "A cada 5 minutos",
    "type": "n8n-nodes-base.scheduleTrigger",
    "typeVersion": 1.2,
    "position": [X, Y],
    "parameters": {
        "rule": {
            "interval": [{"field": "minutes", "minutesInterval": 5}]
        }
    },
})

# 2. Busca todas as tarefas Ok no Notion
add_node({
    "id": "busca-ok-notion",
    "name": "Busca Ok Notion",
    "type": "n8n-nodes-base.httpRequest",
    "typeVersion": 4.3,
    "position": [X + 280, Y],
    "parameters": {
        "method": "POST",
        "url": f"https://api.notion.com/v1/databases/{notion_db_id}/query",
        "sendHeaders": True,
        "headerParameters": {"parameters": [
            {"name": "Authorization", "value": f"Bearer {notion_token}"},
            {"name": "Notion-Version", "value": "2022-06-28"},
            {"name": "Content-Type", "value": "application/json"},
        ]},
        "sendBody": True,
        "specifyBody": "json",
        "jsonBody": json.dumps({
            "page_size": 50,
            "filter": {"property": "status", "select": {"equals": "Ok"}},
            "sorts": [{"timestamp": "last_edited_time", "direction": "descending"}]
        }),
        "options": {"timeout": 10000},
    },
}, "A cada 5 minutos")

# 3. Busca grupo de notificação no banco
add_node({
    "id": "busca-config-notif",
    "name": "Busca Config Notif",
    "type": "n8n-nodes-base.postgres",
    "typeVersion": 2.4,
    "position": [X + 560, Y],
    "executeOnce": True,
    "alwaysOutputData": True,
    "credentials": {"postgres": pg_creds} if pg_creds else {},
    "parameters": {
        "operation": "executeQuery",
        "query": "SELECT chave, valor FROM dashboard_config WHERE chave = 'grupo_notificacao_ok' LIMIT 1",
        "options": {},
    },
}, "Busca Ok Notion")

# 4. Busca IDs já notificados no Redis
redis_node = {
    "id": "busca-visto-redis",
    "name": "Busca Visto Redis",
    "type": "n8n-nodes-base.redis",
    "typeVersion": 1,
    "position": [X + 840, Y],
    "parameters": {
        "operation": "get",
        "propertyName": "notif:ok:visto",
    },
}
if redis_creds:
    redis_node["credentials"] = {"redis": redis_creds}
add_node(redis_node, "Busca Config Notif")

# 5. Code: filtra novas tarefas e decide
FILTRA_CODE = r"""
const notionResp = $('Busca Ok Notion').first().json;
const results = notionResp?.results || [];

const configRow = $('Busca Config Notif').first().json;
const grupoNotif = (configRow?.valor || '').trim();
if (!grupoNotif) return [{ json: { temNovas: false, grupoNotif: '', msg: '', novosIds: [] } }];

// IDs já vistos (armazenados como JSON array de strings)
let vistos = [];
try {
  const raw = $('Busca Visto Redis').first().json?.propertyName
           || $('Busca Visto Redis').first().json?.value
           || '[]';
  vistos = JSON.parse(raw);
  if (!Array.isArray(vistos)) vistos = [];
} catch(e) { vistos = []; }

// Janela de detecção: 12 minutos (cobre o intervalo de 5min + margem)
const JANELA_MS = 12 * 60 * 1000;
const agora = Date.now();

const novas = [];
const novosIds = [];

for (const page of results) {
  const pageId = (page.id || '').replace(/-/g, '');
  if (!pageId) continue;
  if (vistos.includes(pageId)) continue;  // já notificado

  // Verificar se foi editado na janela de tempo
  const editado = page.last_edited_time ? new Date(page.last_edited_time).getTime() : 0;
  if (agora - editado > JANELA_MS) continue;  // muito antigo

  const props = page.properties || {};
  const titulo = props['Descrição']?.title?.map(t => t.plain_text).join('') || '(sem título)';
  const cliente = props['Cliente']?.rich_text?.map(t => t.plain_text).join('') || '';
  const resp = (props['Responsável']?.people || []).map(p => p.name || '').filter(Boolean).join(', ');

  novas.push({ titulo, cliente, resp });
  novosIds.push(pageId);
}

if (novas.length === 0) return [{ json: { temNovas: false, grupoNotif, msg: '', novosIds: [] } }];

// Monta mensagem
let msg = `✅ *${novas.length === 1 ? 'Tarefa concluída' : novas.length + ' tarefas concluídas'} no Notion!*\n`;
for (const t of novas) {
  const clienteStr = t.cliente ? ` — ${t.cliente}` : '';
  const respStr = t.resp ? ` _(${t.resp})_` : '';
  msg += `\n• *${t.titulo}*${clienteStr}${respStr}`;
}

// IDs atualizados para salvar
const todosIds = [...new Set([...vistos, ...novosIds])].slice(-200);  // manter últimos 200

return [{ json: { temNovas: true, grupoNotif, msg, novosIds: todosIds } }];
"""

add_node({
    "id": "filtra-decide-notif",
    "name": "Filtra e Decide",
    "type": "n8n-nodes-base.code",
    "typeVersion": 2,
    "position": [X + 1120, Y],
    "parameters": {"jsCode": FILTRA_CODE},
}, "Busca Visto Redis")

# 6. IF tem novas
add_node({
    "id": "if-tem-novas",
    "name": "Tem Novas?",
    "type": "n8n-nodes-base.if",
    "typeVersion": 2,
    "position": [X + 1400, Y],
    "parameters": {
        "conditions": {
            "options": {"caseSensitive": False, "leftValue": "", "typeValidation": "strict", "version": 2},
            "conditions": [{
                "id": "cond-tem-novas",
                "leftValue": "={{ $json.temNovas }}",
                "rightValue": True,
                "operator": {"type": "boolean", "operation": "equals"}
            }],
            "combinator": "and"
        },
        "options": {}
    },
}, "Filtra e Decide")

# 7. Envia WhatsApp (saída TRUE do IF)
add_node({
    "id": "envia-notif-manual",
    "name": "Envia WhatsApp Notif",
    "type": "n8n-nodes-base.httpRequest",
    "typeVersion": 4.3,
    "position": [X + 1680, Y - 100],
    "continueOnFail": True,
    "parameters": {
        "method": "POST",
        "url": f"{ev_url}/message/sendText/{ev_instance}",
        "sendHeaders": True,
        "headerParameters": {"parameters": [
            {"name": "apikey", "value": ev_key},
            {"name": "Content-Type", "value": "application/json"},
        ]},
        "sendBody": True,
        "specifyBody": "json",
        "jsonBody": '={"number": "{{ $json.grupoNotif }}", "text": "{{ $json.msg }}"}',
        "options": {"timeout": 10000},
    },
}, None)  # conexão manual abaixo

# Conectar IF TRUE (index 0) → Envia WhatsApp
connections.setdefault("Tem Novas?", {"main": [[], []]})
connections["Tem Novas?"]["main"][0].append({"node": "Envia WhatsApp Notif", "type": "main", "index": 0})

# 8. Salva IDs vistos no Redis (após envio)
salva_redis = {
    "id": "salva-visto-redis",
    "name": "Salva Visto Redis",
    "type": "n8n-nodes-base.redis",
    "typeVersion": 1,
    "position": [X + 1960, Y - 100],
    "parameters": {
        "operation": "set",
        "propertyName": "notif:ok:visto",
        "value": "={{ JSON.stringify($('Filtra e Decide').first().json.novosIds) }}",
        "expire": True,
        "ttl": 86400,  # 24 horas
    },
}
if redis_creds:
    salva_redis["credentials"] = {"redis": redis_creds}
nodes.append(salva_redis)
connections.setdefault("Envia WhatsApp Notif", {"main": [[]]})["main"][0].append(
    {"node": "Salva Visto Redis", "type": "main", "index": 0}
)

# ── Criar o workflow no N8N ───────────────────────────────────────────────────
new_wf = {
    "name": "Notificação Tarefa Ok — Notion",
    "nodes": nodes,
    "connections": connections,
    "settings": {"executionOrder": "v1"},
}

print("\nCriando workflow...")
result = req("POST", "/workflows", new_wf)
wf_id = result.get("id")
print(f"✅ Workflow criado! ID: {wf_id}")
print(f"   Nome: {result.get('name')}")
print(f"   Nós: {len(result.get('nodes', []))}")

# Ativar
print("Ativando workflow...")
req("POST", f"/workflows/{wf_id}/activate")
print("✅ Workflow ativo! Rodará a cada 5 minutos.")
print(f"\nAcesse: {N8N_URL}/workflow/{wf_id}")
