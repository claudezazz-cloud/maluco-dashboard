"""Atualiza o comando da solicitação programada de Bom Dia (ID 6) para enviar ambos Imagem e Excel."""
import subprocess

new_cmd = "/chamados em aberto hoje. Gere APENAS os relatórios em IMAGEM e em PLANILHA EXCEL e envie os DOIS. Chame a tool de imagem e também a tool de excel. Coloque a mensagem de bom dia como legenda. NÃO envie mensagem de texto separada. Data: {{HOJE}}"

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
