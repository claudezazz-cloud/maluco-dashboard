# Notificação de Tarefas Paradas (Desativada)

Aviso: A notificação automática de "Tarefas Vencidas" que rodava todas as manhãs às 08:15 foi **desativada** no dia 08/06/2026.

## O que ela fazia
Havia um cron job configurado na VPS que fazia uma requisição HTTP para o endpoint `/api/tarefas/cobrar` da nossa Dashboard Next.js.
O cron rodava de segunda a sábado às 11:15 UTC (08:15 Horário de Brasília).

O script conectava diretamente à API do Notion, buscando tarefas com:
- `Status`: Parado
- `Entrega`: Data no passado (vencidas)

Após coletar essas informações, ele formatava a mensagem dura e mecânica (`⚠️ *Tarefas vencidas — DD/MM/AAAA*`) e inseria na tabela `mensagens_agendadas` do banco de dados (usando uma lógica de `dedup_key` para não duplicar envios no mesmo dia). A mensagem era então disparada para os grupos do WhatsApp através do N8N.

## Por que foi desativada
A pedido do usuário, a rotina foi comentada no `crontab` do servidor pois estava gerando spam excessivo no grupo, com o formato pouco amigável e descolado da persona do robô (já que o robô agora faz seus próprios resumos via IA utilizando ferramentas específicas e em linguagem natural).

## Como reativar (caso necessário no futuro)
1. Acesse o servidor VPS via SSH.
2. Edite o crontab executando `crontab -e`.
3. Descomente a seguinte linha:
```cron
# 15 11 * * 1-6 curl -s -X POST https://dashboard.srv1537041.hstgr.cloud/api/tarefas/cobrar -H "x-token: MALUCO_POPS_2026" >> /var/log/cobrar-tarefas.log 2>&1
```

## Arquivos Relacionados
- **Endpoint**: `app/api/tarefas/cobrar/route.js` (Lógica central de extração e formatação).
- **Banco de Dados**: Tabela `mensagens_agendadas`.
- **Servidor**: Crontab do usuário root na VPS.
