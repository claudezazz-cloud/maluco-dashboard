"""
fix_imagem_descricao.py — Salva descrição da imagem (Claude Vision) no banco.

Problema: dbMensagem gravava só "🖼️ [imagem]" ou a legenda.
Fix: inclui a descrição automática do Claude no campo salvo em mensagens,
     para o relatório e contexto futuro do bot saberem o conteúdo da imagem.
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

OLD_DB = "dbMensagem: ('🖼️ ' + userVisible).substring(0, 1950),"
NEW_DB = (
    "dbMensagem: ('🖼️ ' + userVisible + "
    "(description && description !== '(imagem sem descrição)' "
    "? ' | Conteúdo: ' + description.substring(0, 800) "
    ": '')).substring(0, 1950),"
)

def main():
    print("Buscando workflow...")
    wf = get_wf()
    nodes = wf.get("nodes", [])

    target = next((n for n in nodes if n.get("name") == "Formata Imagem"
                   and n.get("type") == "n8n-nodes-base.code"), None)
    if not target:
        print("ERRO: nó 'Formata Imagem' não encontrado!")
        sys.exit(1)

    code = target["parameters"].get("jsCode", "")
    if OLD_DB not in code:
        if "dbMensagem:" in code:
            print("Campo dbMensagem encontrado mas com formato diferente do esperado:")
            idx = code.find("dbMensagem:")
            print("  →", code[idx:idx+120])
            print("Corrija manualmente ou atualize OLD_DB no script.")
        else:
            print("AVISO: dbMensagem não encontrado — talvez já corrigido ou diferente.")
        # Verifica se já tem a correção
        if "Conteúdo:" in code or "description.substring" in code:
            print("✅ Fix já aplicado anteriormente.")
        sys.exit(0)

    new_code = code.replace(OLD_DB, NEW_DB)
    target["parameters"]["jsCode"] = new_code
    wf["nodes"] = nodes

    print("Desativando workflow...")
    deactivate()
    print("Enviando workflow corrigido...")
    put_wf(wf)
    print("Reativando workflow...")
    activate()
    print("✅ Formata Imagem corrigido — descrição agora salva no banco!")

if __name__ == "__main__":
    main()
