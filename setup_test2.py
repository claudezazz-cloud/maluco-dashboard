import subprocess
prompt = "/relatorio das tarefas do notion do Franquelin. Após buscar as tarefas: Chame a tool gerar_relatorio_pdf enviando seu texto de resumo em markdown (IGNORE a regra de formatacao de WhatsApp para isso e use markdown completo com ## e **). NAO envie o resumo em texto no chat, APENAS o PDF."
prompt_escaped = prompt.replace("'", "''")

query = f"UPDATE dashboard_solicitacoes_programadas SET comando = '{prompt_escaped}', hora = to_char(NOW() AT TIME ZONE 'America/Sao_Paulo' + INTERVAL '2 minutes', 'HH24:MI'), ativo = true WHERE id = 12;"
subprocess.run(['docker', 'exec', 'n8n-postgres-1', 'psql', '-U', 'zazz', '-d', 'zazzdb', '-c', query])
print("Teste agendado para daqui 2 minutos no claudebot2!")
