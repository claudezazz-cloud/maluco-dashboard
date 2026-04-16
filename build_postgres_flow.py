import json

DASHBOARD_URL = "https://dashboard.srv1537041.hstgr.cloud"
N8N_WEBHOOK_URL = "https://n8n.srv1537041.hstgr.cloud/webhook/whatsapp"
TOKEN = "MALUCO_POPS_2026"
BOT_NUMBER = "554396543242@s.whatsapp.net"

with open('workflow_v2.json', 'r', encoding='utf-8') as f:
    wf = json.load(f)

# ── New nodes ──────────────────────────────────────────────────────────────────

# jsonBody for Injeta no Bot — carefully constructed without Unicode issues
inject_body = (
    '={{ JSON.stringify({'
    '"event": "messages.upsert",'
    '"data": {'
    '"key": {'
    '"id": "scheduled-" + $json.id + "-" + Date.now(),'
    '"remoteJid": $json.chat_id,'
    '"fromMe": false'
    '},'
    '"message": {'
    '"extendedTextMessage": {'
    '"text": $json.comando,'
    '"contextInfo": {'
    '"mentionedJid": ["' + BOT_NUMBER + '"]'
    '}'
    '}'
    '},'
    '"messageTimestamp": Math.floor(Date.now() / 1000),'
    '"pushName": "Agendamento"'
    '}'
    '}) }}'
)

new_nodes = [
    {
        "parameters": {
            "rule": {
                "interval": [{"field": "cronExpression", "expression": "* * * * *"}]
            }
        },
        "id": "sched-trigger-001",
        "name": "Agendamento Trigger",
        "type": "n8n-nodes-base.scheduleTrigger",
        "typeVersion": 1.3,
        "position": [9200, -400]
    },
    {
        "parameters": {
            "method": "GET",
            "url": DASHBOARD_URL + "/api/solicitacoes/n8n",
            "sendHeaders": True,
            "headerParameters": {
                "parameters": [{"name": "x-token", "value": TOKEN}]
            },
            "options": {}
        },
        "id": "sched-busca-001",
        "name": "Busca Solicitacoes Due",
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4.2,
        "position": [9450, -400]
    },
    {
        "parameters": {
            "conditions": {
                "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict"},
                "conditions": [
                    {
                        "id": "sched-cond-1",
                        "leftValue": "={{ $json.tasks.length }}",
                        "rightValue": 0,
                        "operator": {"type": "number", "operation": "gt"}
                    }
                ],
                "combinator": "and"
            },
            "options": {}
        },
        "id": "sched-if-001",
        "name": "Tem Tarefas?",
        "type": "n8n-nodes-base.if",
        "typeVersion": 2,
        "position": [9700, -400]
    },
    {
        "parameters": {"batchSize": 1, "options": {}},
        "id": "sched-loop-001",
        "name": "Loop Tarefas",
        "type": "n8n-nodes-base.splitInBatches",
        "typeVersion": 3,
        "position": [9950, -500]
    },
    {
        "parameters": {
            "method": "POST",
            "url": N8N_WEBHOOK_URL,
            "sendBody": True,
            "specifyBody": "json",
            "jsonBody": inject_body,
            "options": {}
        },
        "id": "sched-inject-001",
        "name": "Injeta no Bot",
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4.2,
        "position": [10200, -500]
    },
    {
        "parameters": {
            "method": "POST",
            "url": DASHBOARD_URL + "/api/solicitacoes/n8n",
            "sendHeaders": True,
            "headerParameters": {
                "parameters": [
                    {"name": "x-token", "value": TOKEN},
                    {"name": "Content-Type", "value": "application/json"}
                ]
            },
            "sendBody": True,
            "specifyBody": "json",
            "jsonBody": '={{ JSON.stringify({ "id": $json.id }) }}',
            "options": {}
        },
        "id": "sched-mark-001",
        "name": "Marca Executado",
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4.2,
        "position": [10450, -500]
    }
]

wf['nodes'].extend(new_nodes)
print("Added", len(new_nodes), "nodes.")

# ── Connections ────────────────────────────────────────────────────────────────
conns = wf.setdefault('connections', {})

conns["Agendamento Trigger"] = {
    "main": [[{"node": "Busca Solicitacoes Due", "type": "main", "index": 0}]]
}
conns["Busca Solicitacoes Due"] = {
    "main": [[{"node": "Tem Tarefas?", "type": "main", "index": 0}]]
}
conns["Tem Tarefas?"] = {
    "main": [
        [{"node": "Loop Tarefas", "type": "main", "index": 0}],
        []
    ]
}
conns["Loop Tarefas"] = {
    "main": [
        [{"node": "Injeta no Bot", "type": "main", "index": 0}],
        []
    ]
}
conns["Injeta no Bot"] = {
    "main": [[{"node": "Marca Executado", "type": "main", "index": 0}]]
}
conns["Marca Executado"] = {
    "main": [[{"node": "Loop Tarefas", "type": "main", "index": 0}]]
}

print("Connections added.")

with open('workflow_v2.json', 'w', encoding='utf-8') as f:
    json.dump(wf, f, ensure_ascii=False, indent=2)

print("workflow_v2.json saved.")
