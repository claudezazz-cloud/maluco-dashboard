import subprocess

cmd = [
    'docker', 'exec', 'n8n-postgres-1', 'psql', '-U', 'zazz', '-d', 'zazzdb', '-c',
    "SELECT id, nome, hora, chat_id, comando FROM dashboard_solicitacoes_programadas ORDER BY id;"
]

subprocess.run(cmd)
