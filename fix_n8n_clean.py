#!/usr/bin/env python3
"""Remove debug output from Monta Prompt."""
import json
import urllib.request

API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkNDE5ZWU0MC0wMmFiLTQ1OGUtODMzMi1lN2E1OWEwYzRmMTAiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiOTQyYWFlZDctYTJkOS00MjJjLWE3OWMtZWMzNzQyMmViOWY4IiwiaWF0IjoxNzc0NzkyNzU2LCJleHAiOjE3NzczNDUyMDB9.bdrA_lXECtGYWsEqQB5FCn4CtZATdI2Mxu3LXQufStA"
BASE = "https://n8n.srv1537041.hstgr.cloud/api/v1/workflows/DiInHUnddtFACSmj"

req = urllib.request.Request(BASE, headers={"X-N8N-API-KEY": API_KEY})
with urllib.request.urlopen(req) as resp:
    wf = json.loads(resp.read())

for node in wf["nodes"]:
    if node["name"] == "Monta Prompt":
        code = node["parameters"]["jsCode"]

        # Remove debug block
        debug_start = "// DEBUG: counts"
        debug_end = "\n\n// 5. COLABORADORES"

        idx_start = code.find(debug_start)
        idx_end = code.find(debug_end)

        if idx_start >= 0 and idx_end >= 0:
            code = code[:idx_start] + "// 5. COLABORADORES" + code[idx_end + len(debug_end):]
            print("Removed debug block")

        # Remove _debug from return
        code = code.replace("popsUsados,\n    _debug,", "popsUsados,")
        print("Removed _debug from return")

        node["parameters"]["jsCode"] = code
        break

allowed = ["id", "name", "type", "typeVersion", "position", "parameters",
           "credentials", "disabled", "notes", "notesInFlow", "executeOnce",
           "alwaysOutputData", "retryOnFail", "maxTries", "waitBetweenTries",
           "continueOnFail", "onError"]
cleaned = [{k: v for k, v in n.items() if k in allowed} for n in wf["nodes"]]

payload = json.dumps({
    "name": wf["name"],
    "nodes": cleaned,
    "connections": wf["connections"],
    "settings": {}
}).encode()

req2 = urllib.request.Request(BASE, data=payload, method="PUT", headers={
    "X-N8N-API-KEY": API_KEY,
    "Content-Type": "application/json"
})
try:
    with urllib.request.urlopen(req2) as resp2:
        result = json.loads(resp2.read())
        print("DEPLOYED: {} | Active: {}".format(result.get("name"), result.get("active")))
except urllib.error.HTTPError as e:
    print("ERROR: {} {}".format(e.code, e.read().decode()[:300]))
