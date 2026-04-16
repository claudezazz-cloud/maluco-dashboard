import json

with open('workflow_v2.json', 'r', encoding='utf-8') as f:
    wf = json.load(f)

for node in wf['nodes']:
    if node['id'] == 'sched-mark-001':
        p = node['parameters']
        # Use query parameter ?id=X — simplest approach, no body issues
        p['url'] = "={{ 'https://dashboard.srv1537041.hstgr.cloud/api/solicitacoes/n8n?id=' + String($('Prepara Body').first().json.id) }}"
        # Remove body-related params
        p['sendBody'] = False
        p.pop('specifyBody', None)
        p.pop('bodyParameters', None)
        p.pop('jsonBody', None)
        p.pop('body', None)
        print("Fixed: URL now includes ?id= as query param")
        print("  url:", p['url'][:100])
        break

with open('workflow_v2.json', 'w', encoding='utf-8') as f:
    json.dump(wf, f, ensure_ascii=False, indent=2)
print("Saved.")
