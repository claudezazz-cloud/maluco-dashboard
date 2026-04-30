"""
fix_remetente_canonico.py
1) Extrai Dados Mensagem: passa a outputar senderNumber (digitos do JID).
2) Salva no Postgres / Salva Transcricao / Salva Imagem: usa COALESCE com subquery
   em colaboradores_numeros para gravar o nome canonico do colaborador no campo remetente.
"""
import json, time, urllib.request, urllib.error, re

N8N="https://n8n.srv1537041.hstgr.cloud"
KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkNDE5ZWU0MC0wMmFiLTQ1OGUtODMzMi1lN2E1OWEwYzRmMTAiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMDEzY2FkYmQtMmM4Yi00ZjZlLWFjYmQtOTY2ODI1MGUwZDcxIiwiaWF0IjoxNzc3MzgxNDEzfQ.tKyTjOHjsWaMBk0sonCHoXjupA5QErEEuqEj-ZSEY1s"
H={"X-N8N-API-KEY":KEY,"Content-Type":"application/json"}
WF="DiInHUnddtFACSmj"
ALLOWED={"name","nodes","connections","settings","staticData"}
ALLOWED_S={"executionOrder","saveManualExecutions","callerPolicy","errorWorkflow","timezone","saveDataSuccessExecution","saveDataErrorExecution","saveExecutionProgress"}

def req(m,p,b=None):
    r=urllib.request.Request(f"{N8N}/api/v1{p}",data=json.dumps(b).encode() if b else None,headers=H,method=m)
    try:
        with urllib.request.urlopen(r,timeout=30) as resp: return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        print(f"HTTP {e.code}: {e.read().decode()[:400]}"); raise

# ---------- 1) Extrai Dados Mensagem: injetar senderNumber ----------
SENDER_NUMBER_BLOCK = """
// Extrai numero do remetente (participant em grupo, remoteJid em DM)
const eParticipant = eData.key?.participant || eData.key?.participantPn || eData.key?.senderPn || '';
const eFromJid = eParticipant || (eData.key?.remoteJid && !String(eData.key.remoteJid).includes('@g.us') ? eData.key.remoteJid : '');
const senderNumber = String(eFromJid).split('@')[0].replace(/\\D/g,'');
"""

def patch_extrai(jscode):
    if "senderNumber" in jscode:
        # ja tem; garante que esta no return
        pass
    else:
        # injeta apos definicao de eChat
        jscode = jscode.replace(
            "const eChat = eData.key?.remoteJid || '';",
            "const eChat = eData.key?.remoteJid || '';" + SENDER_NUMBER_BLOCK,
            1
        )
    # adiciona senderNumber no return final
    jscode = re.sub(
        r"return \[\{\s*json:\s*\{\s*dbRemetente:",
        "return [{ json: { senderNumber, dbRemetente:",
        jscode, count=1
    )
    return jscode

# ---------- 2) Reescreve queries Salva* com COALESCE ----------
# Padrao novo: usa COALESCE((SELECT c.nome FROM dashboard_colaboradores c
#   JOIN colaboradores_numeros cn ON cn.colaborador_id = c.id
#   WHERE cn.numero = '<senderNumber>' AND c.ativo = true LIMIT 1), '<dbRemetente>')
# Construido em JS template literal.

def build_insert_query(table_extra=""):
    # mantem mesmo formato que ja existe (tipo_atendimento condicional ou NULL)
    return None  # nao usado, fazemos por substituicao

OLD_REM = "'${$json.dbRemetente.replace(/'/g, \"''\")}'"
NEW_REM = (
    "(SELECT COALESCE("
    "(SELECT c.nome FROM dashboard_colaboradores c "
    "JOIN colaboradores_numeros cn ON cn.colaborador_id = c.id "
    "WHERE cn.numero = '${($json.senderNumber||'').replace(/'/g, \"''\")}' AND c.ativo = true LIMIT 1), "
    "'${$json.dbRemetente.replace(/'/g, \"''\")}'))"
)

def main():
    print("Buscando workflow...")
    wf = req("GET", f"/workflows/{WF}")
    nodes = wf["nodes"]
    changes = []

    for n in nodes:
        nm = n["name"]
        params = n.get("parameters", {})
        if nm == "Extrai Dados Mensagem":
            old = params.get("jsCode","")
            new = patch_extrai(old)
            if new != old:
                params["jsCode"] = new
                changes.append(nm)
        elif nm in ("Salva no Postgres", "Salva Transcricao", "Salva Transcrição", "Salva Imagem"):
            q = params.get("query","")
            if q and OLD_REM in q and NEW_REM not in q:
                params["query"] = q.replace(OLD_REM, NEW_REM)
                changes.append(nm)

    if not changes:
        print("Nenhuma mudanca necessaria.")
        return

    print("Alterados:", changes)
    body = {k:v for k,v in wf.items() if k in ALLOWED}
    if "settings" in body:
        body["settings"] = {k:v for k,v in body["settings"].items() if k in ALLOWED_S}
    try: req("POST", f"/workflows/{WF}/deactivate")
    except: pass
    req("PUT", f"/workflows/{WF}", body)
    time.sleep(1)
    req("POST", f"/workflows/{WF}/activate")
    print("OK.")

if __name__ == "__main__":
    main()
