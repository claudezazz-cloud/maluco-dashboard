import subprocess
prompt = "/relatorio das mensagens do grupo até agora, relatório dos chamados resolvidos. Após isso: 1) Chame a tool 'gerar_relatorio_pdf' enviando seu texto de resumo em markdown (IGNORE a regra de formatação de WhatsApp para isso e use markdown completo com ## e **). 2) Chame a tool 'gerar_relatorio_excel' para enviar a planilha de chamados do Routerbox. 3) Chame a tool 'gerar_relatorio_excel_notion' para enviar a planilha de parados do Notion APENAS do 'Franquelin' e 'Russo'. NÃO envie o resumo em texto no chat."
prompt_escaped = prompt.replace("'", "''")

query = f"UPDATE dashboard_solicitacoes_programadas SET comando = '{prompt_escaped}', hora = to_char(NOW() AT TIME ZONE 'America/Sao_Paulo' + INTERVAL '2 minutes', 'HH24:MI'), ativo = true WHERE id = 12;"
subprocess.run(['docker', 'exec', 'n8n-postgres-1', 'psql', '-U', 'zazz', '-d', 'zazzdb', '-c', query])
