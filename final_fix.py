import json
with open(r'd:\N8N ClaudeBot Versao 5\Zazz Final Completo.json', 'r', encoding='utf-8') as f:
    data = json.load(f)
for node in data['nodes']:
    if node['name'] == 'Monta Prompt':
        code = node['parameters']['jsCode']
        # Remove the broken 'system: AVISO... `Você é' part and set it correctly
        import re
        # This regex looks for 'system: AVISO... ' followed by a backtick and fixes it
        code = re.sub(r'system: AVISO:.*?`', 'system: `AVISO: O robô está em modo de economia de tokens. ', code)
        node['parameters']['jsCode'] = code
with open(p := r'd:\N8N ClaudeBot Versao 5\Zazz Final Completo.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
