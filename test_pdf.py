#!/usr/bin/env python3
# Test generate_pdf.py
import tempfile, os
# Write test markdown
md = """# Relatório Diário - Zazz Internet
## 07/06/2026

### Chamados Pendentes
- **Cliente A** - Sem internet há 3 dias ⚠️
- **Cliente B** - Instalação pendente
- **Cliente C** - Mudança de endereço

### Tarefas do Notion
1. Verificar contratos das escolas
2. Boleto APMF
3. Adesivo Dr. Carlos

---
*Relatório gerado automaticamente*
"""
md_path = '/tmp/test_report.md'
pdf_path = '/tmp/test_report.pdf'
with open(md_path, 'w') as f:
    f.write(md)

os.system(f'python3 /opt/zazz/dashboard/generate_pdf.py {md_path} {pdf_path}')

if os.path.exists(pdf_path):
    size = os.path.getsize(pdf_path)
    print(f'SUCCESS: PDF gerado com {size} bytes')
else:
    print('FAIL: PDF nao foi gerado')
