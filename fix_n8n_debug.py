#!/usr/bin/env python3
"""Add debug output to Monta Prompt and deploy."""
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

        # Add debug info right after relevantNonClientPops is created
        old = "// 5. COLABORADORES"
        debug_code = """// DEBUG: counts
const _debug = {
  uniquePops: uniquePops.length,
  leiasSemprePops: leiasSemprePops.length,
  importantePops: importantePops.length,
  scoredPops: scoredPops.length,
  relevantNonClientPops: relevantNonClientPops.length,
  scoredTitles: scoredPops.slice(0,3).map(s => s.pop.titulo).join(' | ')
};

// 5. COLABORADORES"""

        if old in code:
            code = code.replace(old, debug_code)
            print("Added debug code")
        else:
            print("FAIL: marker not found")
            exit(1)

        # Also add _debug to the return JSON
        old_return = "popsUsados,"
        new_return = "popsUsados,\n    _debug,"
        if old_return in code:
            code = code.replace(old_return, new_return, 1)
            print("Added _debug to return")
        else:
            print("WARN: could not add _debug to return")

        node["parameters"]["jsCode"] = code
        break

# Deploy
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
