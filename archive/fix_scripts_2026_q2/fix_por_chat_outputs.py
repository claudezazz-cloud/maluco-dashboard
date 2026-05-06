"""
fix_por_chat_outputs.py
Em SplitInBatches v3, output 0 = "done" (vazio ao fim) e output 1 = "loop" (cada item).
Conexao errada: Por Chat [out0] -> Busca Mensagens Hoje (nunca processa).
Fix: mover para out1.
Aplica nos workflows memoria-dia (5qTcBwOdBeoU1l7i) e memoria-longa.
"""
import json, time, urllib.request, urllib.error, os

N8N="https://n8n.srv1537041.hstgr.cloud"
KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkNDE5ZWU0MC0wMmFiLTQ1OGUtODMzMi1lN2E1OWEwYzRmMTAiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMDEzY2FkYmQtMmM4Yi00ZjZlLWFjYmQtOTY2ODI1MGUwZDcxIiwiaWF0IjoxNzc3MzgxNDEzfQ.tKyTjOHjsWaMBk0sonCHoXjupA5QErEEuqEj-ZSEY1s"
H={"X-N8N-API-KEY":KEY,"Content-Type":"application/json"}
ALLOWED={"name","nodes","connections","settings","staticData"}
ALLOWED_S={"executionOrder","saveManualExecutions","callerPolicy","errorWorkflow","timezone","saveDataSuccessExecution","saveDataErrorExecution","saveExecutionProgress"}

def req(m,p,b=None):
    r=urllib.request.Request(f"{N8N}/api/v1{p}",data=json.dumps(b).encode() if b else None,headers=H,method=m)
    try:
        with urllib.request.urlopen(r,timeout=30) as resp: return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        print(f"HTTP {e.code}: {e.read().decode()[:400]}"); raise

def fix(wf_id, split_node):
    print(f"\n=== {wf_id} ===")
    wf=req("GET",f"/workflows/{wf_id}")
    conns=wf["connections"]
    src=conns.get(split_node)
    if not src:
        print(f"  no connections from {split_node}"); return
    main=src.get("main",[])
    print(f"  before: {len(main)} outputs")
    for i,outs in enumerate(main):
        for o in outs: print(f"    out{i} -> {o['node']}")
    # garantir 2 outputs; mover de out0 para out1
    if len(main) >= 1 and main[0]:
        out0_targets = main[0]
        # garantir lista de 2
        while len(main) < 2: main.append([])
        # mover out0 -> out1, deixando out0 vazio
        main[1] = out0_targets
        main[0] = []
        conns[split_node]["main"] = main
        print("  fixed: moved out0 targets to out1")
    body={k:v for k,v in wf.items() if k in ALLOWED}
    if "settings" in body:
        body["settings"]={k:v for k,v in body["settings"].items() if k in ALLOWED_S}
    try: req("POST",f"/workflows/{wf_id}/deactivate")
    except: pass
    req("PUT",f"/workflows/{wf_id}",body)
    time.sleep(1)
    req("POST",f"/workflows/{wf_id}/activate")
    print("  ok")

fix("5qTcBwOdBeoU1l7i","Por Chat")
# longa pode ter outro nome — tentar comum
LONGA=os.environ.get("WF_LONGA","")
if LONGA:
    try: fix(LONGA,"Por Chat")
    except Exception as e: print("longa skip:",e)
print("\nPronto. Disparar webhook para testar.")
