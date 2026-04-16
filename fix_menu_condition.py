import json

NODE_VERIFICA = "Verifica Men\u00e7\u00e3o"

with open('workflow_v2.json', 'r', encoding='utf-8') as f:
    wf = json.load(f)

for node in wf['nodes']:
    if node.get('id') == 'menu-if-001':
        conds = node['parameters']['conditions']['conditions']
        for c in conds:
            if c.get('id') == 'menu-cond-1':
                old = c['leftValue']
                # Reference Verifica Mencao directly instead of $json
                c['leftValue'] = "={{ $('" + NODE_VERIFICA + "').first().json.skillName }}"
                print("Fixed condition leftValue:")
                print("  OLD:", old)
                print("  NEW:", c['leftValue'])
        break

with open('workflow_v2.json', 'w', encoding='utf-8') as f:
    json.dump(wf, f, ensure_ascii=False, indent=2)

print("Saved.")
