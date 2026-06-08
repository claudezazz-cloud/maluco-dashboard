import subprocess

commands = {
    3: "/relatorio das mensagens do grupo até agora (11:40), relatório dos chamados resolvidos. Para cada pendência: crie uma tarefa no Notion se não existir, e crie um lembrete para daqui 2 horas. Após isso: 1) Chame a tool 'gerar_relatorio_pdf' enviando seu texto de resumo em markdown (IGNORE a regra de formatação de WhatsApp para isso e use markdown completo com ## e **). 2) Chame a tool 'gerar_relatorio_excel' para enviar a planilha de chamados do Routerbox. 3) Chame a tool 'gerar_relatorio_excel_notion' para enviar a planilha de parados do Notion APENAS do 'Franquelin' e 'Russo'. NÃO envie o resumo em texto no chat.",
    
    5: "/relatorio das mensagens do grupo até agora (17:20), relatório dos chamados resolvidos. Para cada pendência: crie uma tarefa no Notion se não existir, e crie um lembrete para amanhã às 08:15. Após isso: 1) Chame a tool 'gerar_relatorio_pdf' enviando seu texto de resumo em markdown (IGNORE a regra de formatação de WhatsApp para isso e use markdown completo com ## e **). 2) Chame a tool 'gerar_relatorio_excel' para enviar a planilha de chamados do Routerbox. 3) Chame a tool 'gerar_relatorio_excel_notion' para enviar a planilha de parados do Notion APENAS do 'Franquelin' e 'Russo'. NÃO envie o resumo em texto no chat."
}

for task_id, cmd_text in commands.items():
    cmd_text_escaped = cmd_text.replace("'", "''")
    query = f"UPDATE dashboard_solicitacoes_programadas SET comando = '{cmd_text_escaped}' WHERE id = {task_id};"
    subprocess.run(['docker', 'exec', 'n8n-postgres-1', 'psql', '-U', 'zazz', '-d', 'zazzdb', '-c', query])

print("Prompts atualizados para tool_use nativo.")
