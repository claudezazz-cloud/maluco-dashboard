"""
fix_workflow_bugs.py — Corrige 4 bugs encontrados no review do workflow.

1. isReportMensal: 'mes' como substring ativa falsos positivos (sistema, empresa, mesmo...)
2. Formata Menu: acesso sem null-check pode crashar se Verifica Menção não executou
3. Monta Prompt: rulesPrompt duplicado no dynamic quando template tem {{REGRAS}}
4. Parse Resposta: Redis lido como .value mas Monta Prompt usa .propertyName || .value
"""
import json, os, sys, time, urllib.request, urllib.error
from dotenv import load_dotenv
load_dotenv()

N8N_URL = os.getenv("N8N_URL", "https://n8n.srv1537041.hstgr.cloud")
N8N_API_KEY = os.getenv("N8N_API_KEY", "")
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

def fix_verifica_mencao(code):
    OLD = "const isReportMensal = txtLower.includes('mensal') || txtLower.includes('mes') || txtLower.includes('mês');"
    NEW = "const isReportMensal = txtLower.includes('mensal') || /\\bmes\\b/.test(txtLower) || txtLower.includes('mês');"
    if OLD not in code:
        if NEW in code:
            print("  [verifica] isReportMensal já corrigido ✅")
            return code, False
        print("  [verifica] AVISO: isReportMensal não encontrado com formato esperado")
        return code, False
    code = code.replace(OLD, NEW)
    print("  [verifica] isReportMensal corrigido ✅")
    return code, True

def fix_formata_menu(code):
    OLD = "const chatId = $('Verifica Menção').first().json.chatId;"
    NEW = "const chatId = $('Verifica Menção').first()?.json?.chatId || '';"
    if OLD not in code:
        if "?.json?.chatId" in code:
            print("  [menu] null-check já presente ✅")
            return code, False
        print("  [menu] AVISO: linha chatId não encontrada com formato esperado")
        return code, False
    code = code.replace(OLD, NEW)
    print("  [menu] null-check adicionado ✅")
    return code, True

def fix_monta_prompt(code):
    OLD = "const dynamic = (historicoSection + (afterMarker || \"\") + rulesPrompt + skillContext).trim();"
    NEW = "const dynamic = (historicoSection + (afterMarker || \"\") + skillContext).trim();"
    if OLD not in code:
        if NEW in code:
            print("  [prompt] rulesPrompt já removido do dynamic ✅")
            return code, False
        print("  [prompt] AVISO: linha dynamic não encontrada com formato esperado")
        return code, False
    code = code.replace(OLD, NEW)
    print("  [prompt] rulesPrompt duplicado removido do dynamic ✅")
    return code, True

def fix_parse_resposta(code):
    OLD = "try { const rv2 = $('Busca Histórico Redis').first().json?.value; if(rv2) _prevHist = JSON.parse(rv2); } catch(e) {}"
    NEW = "try { const rv2 = $('Busca Histórico Redis').first().json?.propertyName || $('Busca Histórico Redis').first().json?.value; if(rv2) _prevHist = JSON.parse(rv2); } catch(e) {}"
    if OLD not in code:
        if "propertyName || $('Busca Histórico Redis')" in code:
            print("  [parse] Redis propertyName fallback já presente ✅")
            return code, False
        print("  [parse] AVISO: linha Redis não encontrada com formato esperado")
        return code, False
    code = code.replace(OLD, NEW)
    print("  [parse] Redis propertyName fallback adicionado ✅")
    return code, True

def main():
    print("Buscando workflow...")
    wf = get_wf()
    nodes = wf.get("nodes", [])
    changed = False

    fixes = {
        "Verifica Menção": (fix_verifica_mencao, "n8n-nodes-base.code"),
        "Formata Menu":    (fix_formata_menu,    "n8n-nodes-base.code"),
        "Monta Prompt":    (fix_monta_prompt,    "n8n-nodes-base.code"),
        "Parse Resposta":  (fix_parse_resposta,  "n8n-nodes-base.code"),
    }

    for node_name, (fix_fn, expected_type) in fixes.items():
        node = next((n for n in nodes
                     if n.get("name") == node_name and n.get("type") == expected_type), None)
        if not node:
            print(f"\n[{node_name}] ERRO: nó não encontrado!")
            continue
        print(f"\n[{node_name}]")
        new_code, c = fix_fn(node["parameters"].get("jsCode", ""))
        if c:
            node["parameters"]["jsCode"] = new_code
            changed = True

    if not changed:
        print("\nNada precisou ser corrigido.")
        return

    wf["nodes"] = nodes
    print("\nDesativando workflow...")
    deactivate()
    print("Enviando workflow corrigido...")
    put_wf(wf)
    print("Reativando workflow...")
    activate()
    print("\n✅ fix_workflow_bugs concluído!")

if __name__ == "__main__":
    main()
