import subprocess

commands = {
    6: "/chamados em aberto hoje. Você deverá gerar DUAS planilhas EXCEL distintas: 1) Chame a tool 'gerar_relatorio_excel' para gerar e enviar a planilha de chamados em aberto do Routerbox. 2) Liste os pedidos parados no notion e chame a tool 'gerar_relatorio_excel_notion' para gerar e enviar uma SEGUNDA planilha contendo SOMENTE as tarefas paradas do Notion cujos responsáveis sejam 'Franquelin' ou 'Russo'. Coloque a mensagem de bom dia como legenda. NÃO envie mensagem de texto separada listando as tarefas (sem spam). Data: {{HOJE}}",
    
    9: "/notion Bom Dia Luiz! (Mensagem motivacional). Vamos começar o dia olhando os serviços parados no notion. Busque os pedidos parados no notion e chame a tool 'gerar_relatorio_excel_notion' para gerar e enviar UMA PLANILHA EXCEL contendo APENAS as tarefas paradas do 'Luiz Felipe' e 'Negos'. NÃO envie as tarefas em texto na mensagem (evite spam), envie EXCLUSIVAMENTE a planilha em Excel.",
    
    3: "/relatorio das mensagens do grupo até agora (11:40), relatório dos chamados resolvidos. Para cada pendência encontrada: crie uma tarefa no Notion se ainda não existir, e crie um lembrete agendado para daqui 2 horas cobrando o responsável. Após isso, chame a tool 'gerar_relatorio_excel' para enviar a planilha de chamados do Routerbox, e chame a tool 'gerar_relatorio_excel_notion' para enviar uma SEGUNDA planilha com as tarefas paradas do Notion APENAS do 'Franquelin' e 'Russo'. NÃO envie lista de tarefas em texto (evite spam), apenas as planilhas.",
    
    5: "/relatorio das mensagens do grupo até agora (17:20), relatório dos chamados resolvidos. Para cada pendência encontrada: crie uma tarefa no Notion se ainda não existir, e crie um lembrete agendado para amanhã às 08:15 cobrando o responsável. Após isso, chame a tool 'gerar_relatorio_excel' para enviar a planilha de chamados do Routerbox, e chame a tool 'gerar_relatorio_excel_notion' para enviar uma SEGUNDA planilha com as tarefas paradas do Notion APENAS do 'Franquelin' e 'Russo'. NÃO envie lista de tarefas em texto (evite spam), apenas as planilhas.",
    
    10: "/relatorio das mensagens do grupo até agora (17:30), faça um levantamento se algo ainda não tiver sido marcado no notion, marque-a para a informação não se perder. Para cada pendência: crie uma tarefa no Notion se ainda não existir. Após criar as tarefas, busque os pedidos parados no notion e chame a tool 'gerar_relatorio_excel_notion' para enviar UMA PLANILHA EXCEL com as tarefas paradas APENAS do 'Luiz Felipe' e 'Negos'. NÃO envie resumo extenso em texto das tarefas paradas (evite spam), envie apenas a planilha. Não forneça informações sobre INTERNET."
}

for task_id, cmd_text in commands.items():
    cmd_text_escaped = cmd_text.replace("'", "''")
    query = f"UPDATE dashboard_solicitacoes_programadas SET comando = '{cmd_text_escaped}' WHERE id = {task_id};"
    subprocess.run(['docker', 'exec', 'n8n-postgres-1', 'psql', '-U', 'zazz', '-d', 'zazzdb', '-c', query])

print("Comandos atualizados com sucesso!")
