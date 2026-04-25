"""Atualiza o system_prompt no banco diretamente via psql docker."""
import subprocess, sys

prompt = open('/opt/zazz/dashboard/system_prompt_v2.txt', encoding='utf-8').read().strip()
escaped = prompt.replace("'", "''")
sql = f"INSERT INTO dashboard_config (chave, valor) VALUES ('system_prompt', '{escaped}') ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor;"

r = subprocess.run(
    ['docker', 'exec', '-i', 'n8n-postgres-1', 'psql', '-U', 'zazz', '-d', 'zazzdb'],
    input=sql, capture_output=True, text=True
)
print(r.stdout or r.stderr)
if r.returncode != 0:
    sys.exit(1)
print("System prompt atualizado com sucesso!")
