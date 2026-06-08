import subprocess

commands = {
    3: "/relatorio das mensagens do grupo até agora (11:40), relatório dos chamados resolvidos. Para cada pendência: crie uma tarefa no Notion se não existir, e crie um lembrete para daqui 2 horas. Após isso: 1) Responda com um JSON contendo `{\"isPdfReport\": true, \"markdown\": \"Seu resumo detalhado em markdown aqui\"}` para gerar um PDF com o resumo das mensagens. 2) Chame a tool 'gerar_relatorio_excel' para enviar a planilha de chamados do Routerbox. 3) Chame a tool 'gerar_relatorio_excel_notion' para enviar a planilha com as tarefas paradas do Notion APENAS do 'Franquelin' e 'Russo'. NÃO envie o resumo em texto no chat, apenas os arquivos.",
    
    5: "/relatorio das mensagens do grupo até agora (17:20), relatório dos chamados resolvidos. Para cada pendência: crie uma tarefa no Notion se não existir, e crie um lembrete para amanhã às 08:15. Após isso: 1) Responda com um JSON contendo `{\"isPdfReport\": true, \"markdown\": \"Seu resumo detalhado em markdown aqui\"}` para gerar um PDF com o resumo das mensagens. 2) Chame a tool 'gerar_relatorio_excel' para enviar a planilha de chamados do Routerbox. 3) Chame a tool 'gerar_relatorio_excel_notion' para enviar a planilha com as tarefas paradas do Notion APENAS do 'Franquelin' e 'Russo'. NÃO envie o resumo em texto no chat, apenas os arquivos."
}

for task_id, cmd_text in commands.items():
    cmd_text_escaped = cmd_text.replace("'", "''")
    query = f"UPDATE dashboard_solicitacoes_programadas SET comando = '{cmd_text_escaped}' WHERE id = {task_id};"
    subprocess.run(['docker', 'exec', 'n8n-postgres-1', 'psql', '-U', 'zazz', '-d', 'zazzdb', '-c', query])

print("Comandos atualizados para PDF!")
