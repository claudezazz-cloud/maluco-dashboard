"""Simplifica o comando da solicitação programada de Bom Dia (ID 6)."""
import subprocess

new_cmd = "/chamados em aberto hoje. Gere APENAS o relatório em IMAGEM e envie com uma legenda curta de bom dia (ex: Bom dia equipe! Segue o resumo de hoje). NÃO envie mensagem de texto separada, apenas a imagem com legenda. Data: {{HOJE}}"

escaped = new_cmd.replace("'", "''")
sql = f"UPDATE dashboard_solicitacoes_programadas SET comando = '{escaped}' WHERE id = 6;"

r = subprocess.run(
    ['docker', 'exec', '-i', 'n8n-postgres-1', 'psql', '-U', 'zazz', '-d', 'zazzdb'],
    input=sql, capture_output=True, text=True
)
print(r.stdout or r.stderr)
if r.returncode != 0:
    print(f"ERROR: {r.stderr}")
    exit(1)

# Verify
r2 = subprocess.run(
    ['docker', 'exec', '-i', 'n8n-postgres-1', 'psql', '-U', 'zazz', '-d', 'zazzdb'],
    input="SELECT id, nome, comando FROM dashboard_solicitacoes_programadas WHERE id = 6;",
    capture_output=True, text=True
)
print(r2.stdout)
print("Done!")
