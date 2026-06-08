import json
with open('/tmp/last_exec.json', 'r') as f:
    data = json.loads(f.read().strip())
runs = data['resultData']['runData']['executarTool']
print(json.dumps(runs[-1]['data']['main'][0][0], indent=2))
