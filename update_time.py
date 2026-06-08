import subprocess
query = "UPDATE dashboard_solicitacoes_programadas SET hora = to_char(NOW() AT TIME ZONE 'America/Sao_Paulo' + INTERVAL '2 minutes', 'HH24:MI') WHERE id = 3;"
subprocess.run(['docker', 'exec', 'n8n-postgres-1', 'psql', '-U', 'zazz', '-d', 'zazzdb', '-c', query])
