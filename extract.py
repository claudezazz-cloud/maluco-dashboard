import json
with open('workflow_v2.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

for n in data['nodes']:
    if n['type'] == 'n8n-nodes-base.httpRequest':
        url = n['parameters'].get('url', '')
        headers = n['parameters'].get('headerParameters', {}).get('parameters', [])
        if 'evolution' in url.lower() or 'lanlunar' in url.lower():
            print(f"Node: {n['name']} -> URL: {url}")
            for h in headers:
                print(f"  {h['name']}: {h['value']}")
