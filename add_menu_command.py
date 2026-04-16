import json

# Node name with special chars
NODE_VERIFICA = "Verifica Men\u00e7\u00e3o"

with open('workflow_v2.json', 'r', encoding='utf-8') as f:
    wf = json.load(f)

# ── 1. Build the jsCode for Formata Menu ──────────────────────────────────────
# Important: \n inside JS string literals must be stored as the 2-char sequence
# backslash+n (i.e. \\n in this Python string).
# Newlines that separate JS statements are fine as literal \n in the Python string.

formata_menu_code = (
    "const skills = $('Busca Skills Menu').all().map(s => s.json).filter(s => s.nome);\n"
    "const chatId = $('" + NODE_VERIFICA + "').first().json.chatId;\n"
    "\n"
    "let msg = '*Menu de Comandos*\\n\\n';\n"
    "\n"
    "if (skills.length === 0) {\n"
    "  msg += '_Nenhum comando disponivel no momento._\\n\\n';\n"
    "  msg += 'Entre em contato com o administrador.';\n"
    "} else {\n"
    "  msg += 'Comandos disponiveis:\\n\\n';\n"
    "  for (const skill of skills) {\n"
    "    const desc = skill.descricao ? skill.descricao : 'Sem descricao';\n"
    "    msg += '*' + skill.nome + '*\\n' + desc + '\\n\\n';\n"
    "  }\n"
    "  msg = msg.trimEnd();\n"
    "  msg += '\\n\\n_Digite o comando para ativa-lo._';\n"
    "}\n"
    "\n"
    "return [{ json: { chatId, message: msg } }];"
)

# ── 2. Define the 4 new nodes ─────────────────────────────────────────────────
new_nodes = [
    {
        "parameters": {
            "conditions": {
                "options": {
                    "caseSensitive": True,
                    "leftValue": "",
                    "typeValidation": "strict"
                },
                "conditions": [
                    {
                        "id": "menu-cond-1",
                        "leftValue": "={{ $json.skillName }}",
                        "rightValue": "/menu",
                        "operator": {
                            "type": "string",
                            "operation": "equals"
                        }
                    }
                ],
                "combinator": "and"
            },
            "options": {}
        },
        "id": "menu-if-001",
        "name": "\u00c9 Menu?",
        "type": "n8n-nodes-base.if",
        "typeVersion": 2,
        "position": [12300, -1300]
    },
    {
        "parameters": {
            "operation": "executeQuery",
            "query": "SELECT nome, descricao FROM dashboard_skills WHERE ativo = true ORDER BY nome ASC",
            "options": {}
        },
        "id": "menu-skills-001",
        "name": "Busca Skills Menu",
        "type": "n8n-nodes-base.postgres",
        "typeVersion": 2.4,
        "position": [12650, -1500],
        "executeOnce": True,
        "alwaysOutputData": True,
        "credentials": {
            "postgres": {
                "id": "AErqeMtSVfS0MNsb",
                "name": "Postgres account"
            }
        },
        "onError": "continueRegularOutput"
    },
    {
        "parameters": {
            "jsCode": formata_menu_code
        },
        "id": "menu-format-001",
        "name": "Formata Menu",
        "type": "n8n-nodes-base.code",
        "typeVersion": 2,
        "position": [13000, -1500]
    },
    {
        "parameters": {
            "method": "POST",
            "url": "https://lanlunar-evolution.cloudfy.live/message/sendText/ZazzClaude",
            "sendHeaders": True,
            "headerParameters": {
                "parameters": [
                    {"name": "apikey", "value": "KGWUTIl4uXDVxFiJMhFgT1LzP8bHRcze"},
                    {"name": "Content-Type", "value": "application/json"}
                ]
            },
            "sendBody": True,
            "specifyBody": "json",
            "jsonBody": "={{ JSON.stringify({ number: $json.chatId, text: $json.message }) }}",
            "options": {}
        },
        "id": "menu-send-001",
        "name": "Envia Menu",
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4.2,
        "position": [13350, -1500]
    }
]

# ── 3. Add nodes to the workflow ──────────────────────────────────────────────
wf['nodes'].extend(new_nodes)
print(f"Added {len(new_nodes)} nodes.")

# ── 4. Update connections ─────────────────────────────────────────────────────
conns = wf.setdefault('connections', {})

# 4a. Reroute "É Relatório?" false (main[1]) from "Busca Histórico 10" -> "É Menu?"
rel_key = "\u00c9 Relat\u00f3rio?"
if rel_key in conns:
    false_path = conns[rel_key]['main'][1]
    # Remove old connection to Busca Histórico 10
    false_path[:] = [c for c in false_path if c.get('node') != 'Busca Hist\u00f3rico 10']
    # Add new connection to É Menu?
    false_path.append({"node": "\u00c9 Menu?", "type": "main", "index": 0})
    print(f"Updated false path -> E Menu?")
else:
    print(f"ERROR: '{rel_key}' not found in connections!")

# 4b. É Menu? true (main[0]) -> Busca Skills Menu
conns["\u00c9 Menu?"] = {
    "main": [
        [{"node": "Busca Skills Menu", "type": "main", "index": 0}],  # true
        [{"node": "Busca Hist\u00f3rico 10", "type": "main", "index": 0}]   # false
    ]
}
print("Added 'É Menu?' connections.")

# 4c. Busca Skills Menu -> Formata Menu
conns["Busca Skills Menu"] = {
    "main": [
        [{"node": "Formata Menu", "type": "main", "index": 0}]
    ]
}
print("Added 'Busca Skills Menu' -> 'Formata Menu'.")

# 4d. Formata Menu -> Envia Menu
conns["Formata Menu"] = {
    "main": [
        [{"node": "Envia Menu", "type": "main", "index": 0}]
    ]
}
print("Added 'Formata Menu' -> 'Envia Menu'.")

# ── 5. Verify no literal newlines inside JS string literals ───────────────────
print("\nVerifying Formata Menu JS code...")
for line in formata_menu_code.split('\n'):
    if 'msg' in line and ('+=' in line or '= ' in line):
        in_str = False
        for ch in line:
            if ch == "'":
                in_str = not in_str
            elif in_str and ord(ch) == 10:
                print(f"  WARNING literal newline in: {repr(line)}")
                break
        else:
            print(f"  OK: {repr(line[:80])}")

# ── 6. Save ───────────────────────────────────────────────────────────────────
with open('workflow_v2.json', 'w', encoding='utf-8') as f:
    json.dump(wf, f, ensure_ascii=False, indent=2)

print("\nworkflow_v2.json saved successfully.")
