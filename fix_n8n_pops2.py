#!/usr/bin/env python3
"""Fix the duplicated pops += in deployed N8N workflow."""
import json
import urllib.request

API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkNDE5ZWU0MC0wMmFiLTQ1OGUtODMzMi1lN2E1OWEwYzRmMTAiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiOTQyYWFlZDctYTJkOS00MjJjLWE3OWMtZWMzNzQyMmViOWY4IiwiaWF0IjoxNzc0NzkyNzU2LCJleHAiOjE3NzczNDUyMDB9.bdrA_lXECtGYWsEqQB5FCn4CtZATdI2Mxu3LXQufStA"
BASE = "https://n8n.srv1537041.hstgr.cloud/api/v1/workflows/DiInHUnddtFACSmj"

# GET
req = urllib.request.Request(BASE, headers={"X-N8N-API-KEY": API_KEY})
with urllib.request.urlopen(req) as resp:
    wf = json.loads(resp.read())

for node in wf["nodes"]:
    if node["name"] == "Monta Prompt":
        code = node["parameters"]["jsCode"]

        # Current broken state (from repr):
        # ...!isListingPops) {\n  pops += '\n\n  pops += '\\n--- PROCEDIMENTOS...\\n\\n'\n  for (const pop...
        #
        # Need to replace everything between "!isListingPops) {\n" and "\n  for (const pop"
        # with the clean instruction line

        marker_before = "!isListingPops) {\n"
        marker_after = "\n  for (const pop of relevantNonClientPops) {"

        idx_before = code.find(marker_before)
        idx_after = code.find(marker_after)

        if idx_before < 0 or idx_after < 0:
            print(f"Markers not found: before={idx_before}, after={idx_after}")
            exit(1)

        # The content between markers (what we're replacing)
        content_start = idx_before + len(marker_before)
        old_content = code[content_start:idx_after]
        print(f"Replacing: {repr(old_content)}")

        # New content: clean instruction with proper \\n escapes
        # In Python string, \\n = backslash+n (2 chars)
        # json.dump will write this as \\n in JSON
        # N8N will parse as \n in jsCode (JS escape sequence for newline)
        new_content = "  pops += '\\n--- PROCEDIMENTOS (POPs) ---\\nIMPORTANTE: Quando abordar chamados, SEMPRE busque o POP correspondente abaixo e aplique seus passos. Nao diga que nao localizou POP se existe um relacionado ao assunto.\\n\\n';"

        code = code[:content_start] + new_content + code[idx_after:]
        node["parameters"]["jsCode"] = code

        # Verify
        check_idx = code.find("PROCEDIMENTOS")
        context = code[check_idx - 50:check_idx + 250]
        print(f"\nFixed: {repr(context)}")

        # Sanity: no actual newlines inside single-quoted strings
        # The line should be: pops += '\\n--- PROCEDIMENTOS...\\n\\n';
        line_start = code.rfind("\n", 0, check_idx) + 1
        line_end = code.find("\n", check_idx)
        the_line = code[line_start:line_end]
        print(f"\nFull line: {repr(the_line)}")

        if "\n" in the_line:
            print("WARNING: actual newline found inside the line!")
        else:
            print("OK: no actual newlines in the line")
        break

# PUT
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
        print(f"\nDEPLOYED: {result.get('name')} | Active: {result.get('active')}")
except urllib.error.HTTPError as e:
    print(f"\nERROR: {e.code} {e.read().decode()[:300]}")
