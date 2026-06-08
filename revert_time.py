import subprocess

query = "UPDATE dashboard_solicitacoes_programadas SET hora = '11:40' WHERE id = 3;"
subprocess.run(['docker', 'exec', 'n8n-postgres-1', 'psql', '-U', 'zazz', '-d', 'zazzdb', '-c', query])
