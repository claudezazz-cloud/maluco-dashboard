"""
fix_injeta_memoria_monta_prompt.py
Conecta o sistema de memoria ao bot:

1. Adiciona no HTTP Request "Busca Memoria Contexto" antes de "Monta Prompt"
   GET /api/memoria/contexto?chatId=...&texto=...&incluirOntem=true
   continueOnFail: true (nao trava o bot se memoria falhar)

2. Injeta memoriaContext no Code node "Monta Prompt" antes do historico Redis
"""
import json, time, urllib.request, urllib.error

N8N_URL     = "https://n8n.srv1537041.hstgr.cloud"
N8N_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkNDE5ZWU0MC0wMmFiLTQ1OGUtODMzMi1lN2E1OWEwYzRmMTAiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMDEzY2FkYmQtMmM4Yi00ZjZlLWFjYmQtOTY2ODI1MGUwZDcxIiwiaWF0IjoxNzc3MzgxNDEzfQ.tKyTjOHjsWaMBk0sonCHoXjupA5QErEEuqEj-ZSEY1s"
WORKFLOW_ID = "DiInHUnddtFACSmj"
DASHBOARD   = "https://dashboard.srv1537041.hstgr.cloud"
POPS_TOKEN  = "MALUCO_POPS_2026"

HEADERS = {"X-N8N-API-KEY": N8N_API_KEY, "Content-Type": "application/json"}
ALLOWED = {"name", "nodes", "connections", "settings", "staticData"}
ALLOWED_SETTINGS = {
    "executionOrder", "saveManualExecutions", "callerPolicy",
    "errorWorkflow", "timezone", "saveDataSuccessExecution",
    "saveDataErrorExecution", "saveExecutionProgress"
}

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

# ─── Passo 1: no HTTP Request ────────────────────────────────────────────────

NO_BUSCA_MEMORIA = {
    "id": "node-busca-memoria-contexto",
    "name": "Busca Memoria Contexto",
    "type": "n8n-nodes-base.httpRequest",
    "typeVersion": 4.2,
    "position": [14680, 9264],
    "continueOnFail": True,
    "parameters": {
        "method": "GET",
        "url": f"{DASHBOARD}/api/memoria/contexto",
        "authentication": "none",
        "sendHeaders": True,
        "headerParameters": {
            "parameters": [
                {"name": "x-token", "value": POPS_TOKEN}
            ]
        },
        "sendQuery": True,
        "queryParameters": {
            "parameters": [
                {
                    "name": "chatId",
                    "value": "={{ $('Verifica Mencao').first().json.chatId }}"
                },
                {
                    "name": "texto",
                    "value": "={{ $('Verifica Mencao').first().json.textMessage || '' }}"
                },
                {
                    "name": "incluirOntem",
                    "value": "true"
                }
            ]
        },
        "options": {}
    }
}

# ─── Passo 2: injecao no Monta Prompt ────────────────────────────────────────

# Bloco a inserir antes de "// 9. MONTAGEM FINAL"
MEMORIA_BLOCK = """
// MEMORIA DAS CAMADAS 2 E 3
let memoriaContext = '';
try {
  const memResp = $('Busca Memoria Contexto').first().json;
  if (memResp?.bloco_contexto) memoriaContext = '\\n\\n' + memResp.bloco_contexto;
} catch(e) {}

"""

# Substituicao no dynamic (dentro da IIFE de cache split)
OLD_DYNAMIC = 'const dynamic = (historicoSection + (afterMarker || "") + skillContext).trim();'
NEW_DYNAMIC = 'const dynamic = (memoriaContext + historicoSection + (afterMarker || "") + skillContext).trim();'

MARKER_9 = '// 9. MONTAGEM FINAL DO SYSTEM CONTENT'

# ─── Nome do no Verifica Mencao no workflow ───────────────────────────────────
# O script usa o nome exato — vamos detectar automaticamente
VERIFICA_MENCAO_NAMES = ["Verifica Mencao", "Verifica Menção", "Verifica Menção"]

def main():
    print("Buscando workflow...")
    wf    = req("GET", f"/workflows/{WORKFLOW_ID}")
    nodes = wf.get("nodes", [])
    conns = wf.get("connections", {})
    changed = False

    # Detectar nome real do no Verifica Mencao
    verifica_name = None
    for n in nodes:
        if n.get("name", "") in VERIFICA_MENCAO_NAMES:
            verifica_name = n["name"]
            break
    if not verifica_name:
        # fallback: procura por substring
        for n in nodes:
            if "erifica" in n.get("name", "") and "en" in n.get("name", "").lower():
                verifica_name = n["name"]
                break
    if not verifica_name:
        print("AVISO: no Verifica Mencao nao encontrado, usando nome padrao")
        verifica_name = "Verifica Menção"

    print(f"  No Verifica Mencao: '{verifica_name}'")

    # Atualizar queryParameters com nome correto
    NO_BUSCA_MEMORIA["parameters"]["queryParameters"]["parameters"][0]["value"] = \
        f"={{{{ $('{verifica_name}').first().json.chatId }}}}"
    NO_BUSCA_MEMORIA["parameters"]["queryParameters"]["parameters"][1]["value"] = \
        f"={{{{ $('{verifica_name}').first().json.textMessage || '' }}}}"

    # ── Passo 1: adicionar no Busca Memoria Contexto ──────────────────────────
    if not find_node(nodes, "Busca Memoria Contexto"):
        nodes.append(NO_BUSCA_MEMORIA)
        print("  [OK] No 'Busca Memoria Contexto' adicionado")
        changed = True

        # Reconectar: Busca Grupo Atual → Busca Memoria Contexto → Monta Prompt
        if "Busca Grupo Atual" in conns:
            # Substituir destino Monta Prompt por Busca Memoria Contexto
            for branch in conns["Busca Grupo Atual"].get("main", []):
                for dest in branch:
                    if dest.get("node") == "Monta Prompt":
                        dest["node"] = "Busca Memoria Contexto"
            print("  [OK] Busca Grupo Atual -> Busca Memoria Contexto")

        # Adicionar Busca Memoria Contexto -> Monta Prompt
        conns["Busca Memoria Contexto"] = {
            "main": [[{"node": "Monta Prompt", "type": "main", "index": 0}]]
        }
        print("  [OK] Busca Memoria Contexto -> Monta Prompt")
    else:
        print("  Busca Memoria Contexto ja existe")

    # ── Passo 2: injetar memoriaContext no Monta Prompt ───────────────────────
    monta = find_node(nodes, "Monta Prompt")
    if not monta:
        print("ERRO: no Monta Prompt nao encontrado!")
        return

    code = monta["parameters"].get("jsCode", "")

    # Inserir bloco de memoria antes de "// 9. MONTAGEM FINAL"
    if "memoriaContext" not in code:
        if MARKER_9 in code:
            code = code.replace(MARKER_9, MEMORIA_BLOCK + MARKER_9)
            print("  [OK] Bloco memoriaContext inserido antes de secao 9")
            changed = True
        else:
            print("  AVISO: marcador '// 9. MONTAGEM FINAL' nao encontrado — inserindo antes do return final")
            code = code.replace("return [{", MEMORIA_BLOCK + "return [{", 1)
            changed = True
    else:
        print("  memoriaContext ja presente no Monta Prompt")

    # Substituir dynamic para incluir memoriaContext
    if OLD_DYNAMIC in code:
        code = code.replace(OLD_DYNAMIC, NEW_DYNAMIC)
        print("  [OK] dynamic agora inclui memoriaContext antes do historico")
        changed = True
    elif "memoriaContext + historicoSection" in code:
        print("  dynamic ja inclui memoriaContext")
    else:
        print("  AVISO: padrao dynamic nao encontrado — verifique manualmente")

    monta["parameters"]["jsCode"] = code

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
    print("Pronto! Memoria agora e injetada no contexto do bot antes de cada resposta.")
    print("  - Busca: GET /api/memoria/contexto (continueOnFail=true)")
    print("  - Injeta: memoriaContext antes de historicoSection no dynamic")

