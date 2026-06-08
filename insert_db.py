import subprocess

cmd = [
    'docker', 'exec', 'n8n-postgres-1', 'psql', '-U', 'zazz', '-d', 'zazzdb', '-c',
    "INSERT INTO dashboard_solicitacoes_programadas (nome, comando, chat_id, hora, dias_semana, ativo) VALUES ('Teste Parados', 'Mande a planilha de excel dos parados do notion', '120363409735124488@g.us', '22:02', 'todos', true);"
]

subprocess.run(cmd)
