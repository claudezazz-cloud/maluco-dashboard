#!/usr/bin/env python3
"""Fix the Monta Prompt POP instruction in the deployed N8N workflow."""
import json
import urllib.request

API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkNDE5ZWU0MC0wMmFiLTQ1OGUtODMzMi1lN2E1OWEwYzRmMTAiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiOTQyYWFlZDctYTJkOS00MjJjLWE3OWMtZWMzNzQyMmViOWY4IiwiaWF0IjoxNzc0NzkyNzU2LCJleHAiOjE3NzczNDUyMDB9.bdrA_lXECtGYWsEqQB5FCn4CtZATdI2Mxu3LXQufStA"
BASE = "https://n8n.srv1537041.hstgr.cloud/api/v1/workflows/DiInHUnddtFACSmj"

# 1. GET current workflow
req = urllib.request.Request(BASE, headers={"X-N8N-API-KEY": API_KEY})
with urllib.request.urlopen(req) as resp:
    wf = json.loads(resp.read())

print(f"Workflow: {wf['name']} | Active: {wf['active']}")

# 2. Find and fix Monta Prompt
for node in wf["nodes"]:
    if node["name"] == "Monta Prompt":
        code = node["parameters"]["jsCode"]

        # The broken instruction has ACTUAL newlines inside a JS single-quoted string.
        # We need to find it and replace with a version using \n escape sequences.
        #
        # In the Python string (after json.load), JS \n escapes appear as
        # literal backslash+n (2 chars). Actual line breaks in JS code are
        # actual newline chars.
        #
        # The broken part starts with: pops += '\n\n--- PROCEDIMENTOS
        # (where \n are actual newlines - WRONG)
        #
        # The fix: remove the entire broken pops += line and replace with
        # a version that uses backslash+n (like the working line 194 does).

        broken_start = "  pops += '"
        broken_marker = "PROCEDIMENTOS"

        # Find the line
        idx = code.find(broken_marker)
        if idx < 0:
            print("PROCEDIMENTOS not found - nothing to fix")
            break

        # Walk back to find the start of the pops += statement
        line_start = code.rfind("\n", 0, idx) + 1
        # Walk forward to find the end (the ";")
        line_end = code.find("';", idx) + 2

        broken_section = code[line_start:line_end]
        print(f"Found broken section ({len(broken_section)} chars):")
        print(f"  starts: {repr(broken_section[:60])}")
        print(f"  ends:   {repr(broken_section[-60:])}")

        # Build the replacement with CORRECT escaping
        # In Python, \\ is a literal backslash. So "\\n" = backslash+n in the string.
        # json.dump will write \\n to JSON. N8N will parse as \n (JS escape = newline).
        instruction = (
            "  pops += '\\n--- PROCEDIMENTOS (POPs) ---\\n"
            "IMPORTANTE: Quando abordar chamados, SEMPRE busque o POP "
            "correspondente abaixo e aplique seus passos. "
            "Nao diga que nao localizou POP se existe um relacionado ao assunto."
            "\\n\\n'"
        )

        code = code[:line_start] + instruction + code[line_end:]
        node["parameters"]["jsCode"] = code

        # Verify: the instruction should now have \\n (backslash+n), not actual newlines
        new_idx = code.find("PROCEDIMENTOS")
        context = code[new_idx-30:new_idx+200]
        has_actual_newline = "\n" in context.replace("\n", "", 1)  # allow the line-ending newline
        print(f"\nFixed section: {repr(context[:150])}")

        # Also verify other key parts are intact
        print(f"\nHas slice(0,5): {'slice(0, 5)' in code}")
        print(f"Has leiasSemprePops in popsUsados: {'leiasSemprePops, ...relevantNonClientPops' in code}")
        print(f"Has CLIENTES section: {'CLIENTES' in code}")
        break

# 3. PUT back
allowed_node_keys = ["id", "name", "type", "typeVersion", "position", "parameters",
                     "credentials", "disabled", "notes", "notesInFlow", "executeOnce",
                     "alwaysOutputData", "retryOnFail", "maxTries", "waitBetweenTries",
                     "continueOnFail", "onError"]
cleaned_nodes = []
for n in wf["nodes"]:
    cleaned_nodes.append({k: v for k, v in n.items() if k in allowed_node_keys})

payload = json.dumps({
    "name": wf["name"],
    "nodes": cleaned_nodes,
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
