#!/usr/bin/env python3
import subprocess, json
result = subprocess.run([
    'curl', '-s', '-X', 'POST',
    '-H', 'Content-Type: application/json',
    '-d', json.dumps({"markdown": "# Teste PDF\n\n## Chamados\n\n- **Cliente A** - Sem internet\n- **Cliente B** - Instalacao\n\n### Tarefas Notion\n\n1. Boleto APMF\n2. Contrato escola\n\n---\n*Gerado automaticamente*"}),
    'http://localhost:3001/api/report-pdf'
], capture_output=True, text=True)
data = json.loads(result.stdout)
if 'base64' in data:
    print(f'SUCCESS: base64 retornado ({len(data["base64"])} chars)')
else:
    print(f'FAIL: {result.stdout[:500]}')
