#!/usr/bin/env python3
"""Ajusta o fallback de _vM_early em Monta Prompt e Parse Resposta:
quando Verifica Menção retornar textMessage vazio, usar Formata Imagem."""
import json, time, urllib.request, urllib.error, sys
sys.stdout.reconfigure(encoding="utf-8")

API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkNDE5ZWU0MC0wMmFiLTQ1OGUtODMzMi1lN2E1OWEwYzRmMTAiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiOTQyYWFlZDctYTJkOS00MjJjLWE3OWMtZWMzNzQyMmViOWY4IiwiaWF0IjoxNzc0NzkyNzU2LCJleHAiOjE3NzczNDUyMDB9.bdrA_lXECtGYWsEqQB5FCn4CtZATdI2Mxu3LXQufStA"
BASE = "https://n8n.srv1537041.hstgr.cloud/api/v1/workflows/DiInHUnddtFACSmj"
H = {"X-N8N-API-KEY": API_KEY, "Content-Type": "application/json"}

wf = json.loads(urllib.request.urlopen(urllib.request.Request(BASE, headers=H)).read())

def patch(code, label):
    # Troca a checagem "!_vM_early.chatId" por "!_vM_early.chatId || !_vM_early.textMessage"
    old = "try { _vM_early = $('Verifica Menção').first().json; if (!_vM_early.chatId) _vM_early = null; } catch(e) {}"
    new = "try { _vM_early = $('Verifica Menção').first().json; if (!_vM_early.chatId || !_vM_early.textMessage) _vM_early = null; } catch(e) {}"
    if old in code:
        code = code.replace(old, new)
        print(f"  [{label}] _vM_early fallback ajustado")
    else:
        print(f"  [{label}] old _vM_early pattern NOT found")

    # Mesmo ajuste para _vM (usado em Parse Resposta)
    old2 = "try { _vM = $('Verifica Menção').first().json; if (!_vM.chatId) _vM = null; } catch(e) {}"
    new2 = "try { _vM = $('Verifica Menção').first().json; if (!_vM.chatId || !_vM.textMessage) _vM = null; } catch(e) {}"
    if old2 in code:
        code = code.replace(old2, new2)
        print(f"  [{label}] _vM fallback ajustado")

    # E _msgUsr (se existir)
    old3 = "try { _msgUsr = $('Verifica Menção').first().json; if (!_msgUsr.chatId) _msgUsr = null; } catch(e) {}"
    new3 = "try { _msgUsr = $('Verifica Menção').first().json; if (!_msgUsr.chatId || !_msgUsr.textMessage) _msgUsr = null; } catch(e) {}"
    if old3 in code:
        code = code.replace(old3, new3)
        print(f"  [{label}] _msgUsr fallback ajustado")

    return code


for n in wf["nodes"]:
    if n["name"] in ("Monta Prompt", "Parse Resposta"):
        print(f"==> {n['name']}")
        n["parameters"]["jsCode"] = patch(n["parameters"]["jsCode"], n["name"])

allowed = ["id","name","type","typeVersion","position","parameters","credentials",
           "disabled","notes","notesInFlow","executeOnce","alwaysOutputData",
           "retryOnFail","maxTries","waitBetweenTries","continueOnFail","onError"]
cleaned = [{k:v for k,v in n.items() if k in allowed} for n in wf["nodes"]]

payload = json.dumps({
    "name": wf["name"], "nodes": cleaned,
    "connections": wf["connections"], "settings": {}
}).encode()

print(f"==> PUT ({len(payload)} bytes)...")
try:
    res = json.loads(urllib.request.urlopen(
        urllib.request.Request(BASE, data=payload, method="PUT", headers=H)).read())
    print(f"    OK active={res.get('active')}")
except urllib.error.HTTPError as e:
    print(f"    ERROR {e.code}: {e.read().decode()[:400]}")
    sys.exit(1)

print("==> deactivate+activate...")
urllib.request.urlopen(urllib.request.Request(BASE+"/deactivate", data=b"{}", method="POST", headers=H)).read()
time.sleep(1)
urllib.request.urlopen(urllib.request.Request(BASE+"/activate", data=b"{}", method="POST", headers=H)).read()
print("✓ Concluído")
