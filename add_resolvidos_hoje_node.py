#!/usr/bin/env python3
"""Adiciona nó 'Busca Resolvidos Hoje' (HTTP GET ao endpoint do dashboard)
e injeta o ai_text no prompt do Claude.

- Novo HTTP node entre 'Busca Chamados Redis' e 'Busca Clientes'
- Patch Monta Prompt: lê resolvidos e apenda ao chamadosContext
"""
import json, urllib.request, ssl, time, urllib.error

N8N_URL = "https://n8n.srv1537041.hstgr.cloud"
API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkNDE5ZWU0MC0wMmFiLTQ1OGUtODMzMi1lN2E1OWEwYzRmMTAiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiOTQyYWFlZDctYTJkOS00MjJjLWE3OWMtZWMzNzQyMmViOWY4IiwiaWF0IjoxNzc0NzkyNzU2LCJleHAiOjE3NzczNDUyMDB9.bdrA_lXECtGYWsEqQB5FCn4CtZATdI2Mxu3LXQufStA"
WF_ID = "DiInHUnddtFACSmj"
DASHBOARD_URL = "https://dashboard.srv1537041.hstgr.cloud"
TOKEN = "a90e1938716bd91a57dc1ed6faafd856c7597b113ebf9b818c0ca0e0c6279d21"
ctx = ssl.create_default_context()


def req(method, path, body=None):
    url = f"{N8N_URL}/api/v1{path}"
    data = json.dumps(body).encode() if body else None
    r = urllib.request.Request(
        url, data=data, method=method,
        headers={"X-N8N-API-KEY": API_KEY, "Content-Type": "application/json", "accept": "application/json"}
    )
    try:
        with urllib.request.urlopen(r, context=ctx, timeout=30) as resp:
            txt = resp.read().decode()
            return json.loads(txt) if txt else {}
    except urllib.error.HTTPError as e:
        print("ERR:", e.read().decode()[:500])
        raise


print("GET workflow...")
wf = req("GET", f"/workflows/{WF_ID}")

# ================================================================
# 1) Adicionar nó "Busca Resolvidos Hoje"
# ================================================================
bcr = next(x for x in wf['nodes'] if x['name'] == 'Busca Chamados Redis')
sx, sy = bcr.get('position', [0, 0])

resolvidos_node = {
    "parameters": {
        "method": "GET",
        "url": f"{DASHBOARD_URL}/api/chamados/resolvidos-hoje?detalhes=0",
        "sendHeaders": True,
        "headerParameters": {
            "parameters": [
                {"name": "x-auto-token", "value": TOKEN}
            ]
        },
        "options": {"timeout": 8000}
    },
    "id": "busca-resolvidos-hoje-2026",
    "name": "Busca Resolvidos Hoje",
    "type": "n8n-nodes-base.httpRequest",
    "typeVersion": 4.3,
    "position": [sx + 200, sy + 100],
    "executeOnce": True,
    "alwaysOutputData": True,
    "onError": "continueRegularOutput"
}

wf['nodes'] = [n for n in wf['nodes'] if n['name'] != 'Busca Resolvidos Hoje']
wf['nodes'].append(resolvidos_node)
print("  Busca Resolvidos Hoje: added")

# ================================================================
# 2) Rewire: Busca Chamados Redis -> Busca Resolvidos Hoje -> Busca Clientes
# ================================================================
conns = wf['connections']
# Verifica conexão atual de Busca Chamados Redis (pra preservar destinos extras)
prev_chamados_targets = conns.get('Busca Chamados Redis', {}).get('main', [[]])[0]
# Filtra: queremos manter quem JÁ era destino, EXCETO Busca Clientes (que vai virar destino do novo nó)
keep_targets = [t for t in prev_chamados_targets if t.get('node') != 'Busca Clientes']
keep_targets.append({"node": "Busca Resolvidos Hoje", "type": "main", "index": 0})
conns['Busca Chamados Redis'] = {"main": [keep_targets]}
conns['Busca Resolvidos Hoje'] = {"main": [[{"node": "Busca Clientes", "type": "main", "index": 0}]]}
print("  connections: Busca Chamados Redis -> Busca Resolvidos Hoje -> Busca Clientes")

# ================================================================
# 3) Patch Monta Prompt: adicionar leitura + injeção
# ================================================================
mp = next(x for x in wf['nodes'] if x['name'] == 'Monta Prompt')
js = mp['parameters']['jsCode']

RESOLVIDOS_BLOCK = r'''
// RESOLVIDOS HOJE (diff de snapshots — quem fechou quantos chamados)
let resolvidosContext = '';
try {
  const resp = $('Busca Resolvidos Hoje').first().json;
  if (resp && resp.total_resolvidos > 0 && resp.ai_text) {
    resolvidosContext = '\n\n🏁 CHAMADOS RESOLVIDOS HOJE (calculado por diff de snapshots — DADOS OFICIAIS):\n'
      + 'Quando perguntarem "quem resolveu chamados hoje", "quantos chamados o fulano fechou", "ranking", USE este bloco.\n'
      + 'Os números são EXATOS, pré-calculados. Nunca reconte ou invente.\n\n'
      + resp.ai_text;
  }
} catch(e) {}

'''

if 'resolvidosContext' not in js:
    # Insere antes do bloco REMETENTE
    js = js.replace(
        "// REMETENTE\nlet remetente",
        RESOLVIDOS_BLOCK + "// REMETENTE\nlet remetente",
        1
    )
    print("  Monta Prompt: bloco de leitura adicionado")
else:
    print("  Monta Prompt: bloco já existe — patch idempotente")

# Concatenar resolvidosContext junto com chamadosContext nos dois pontos de uso
js = js.replace(
    "rulesPrompt + skillContext + chamadosContext + '\\n' + systemContent",
    "rulesPrompt + skillContext + chamadosContext + resolvidosContext + '\\n' + systemContent"
)
js = js.replace(
    "+ historicoSection\n    + chamadosContext;",
    "+ historicoSection\n    + chamadosContext\n    + resolvidosContext;"
)
# Caso já tinha tarefasContext junto, não duplica
print("  Monta Prompt: resolvidosContext injetado")

mp['parameters']['jsCode'] = js

# ================================================================
# 4) Settings (filtra pra não quebrar o PUT)
# ================================================================
ALLOWED = {"executionOrder", "saveDataErrorExecution", "saveDataSuccessExecution",
           "saveManualExecutions", "saveExecutionProgress", "timezone",
           "errorWorkflow", "callerPolicy", "executionTimeout"}
if isinstance(wf.get('settings'), dict):
    wf['settings'] = {k: v for k, v in wf['settings'].items() if k in ALLOWED}

clean = {k: wf[k] for k in ('name', 'nodes', 'connections', 'settings', 'staticData') if k in wf}
print("PUT workflow...")
req("PUT", f"/workflows/{WF_ID}", clean)

print("Deactivate + activate (limpa cache do task runner)...")
try:
    req("POST", f"/workflows/{WF_ID}/deactivate")
except Exception as e:
    print("  deactivate:", e)
time.sleep(1)
req("POST", f"/workflows/{WF_ID}/activate")
print("OK.")
