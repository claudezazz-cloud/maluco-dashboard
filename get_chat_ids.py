import subprocess
query = "SELECT chat_id FROM dashboard_memoria_curta LIMIT 100;"
result = subprocess.run(['docker', 'exec', 'n8n-postgres-1', 'psql', '-U', 'zazz', '-d', 'zazzdb', '-c', query], capture_output=True, text=True)
print(result.stdout)
