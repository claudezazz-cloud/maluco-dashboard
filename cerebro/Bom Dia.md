# Bom Dia

← volta para [[Maluco da IA]] | fluxo em [[Workflow N8N]]

Mensagem automática enviada pelo bot no grupo toda manhã **segunda a sábado às 7:30 AM** (horário de Brasília). Envia uma **imagem** (dashboard dos chamados em aberto) com uma saudação curta de legenda.

## Fluxo Atual (v2 — via Solicitações Programadas)

O bom dia NÃO tem um trigger cron separado. Ele funciona assim:

```
Agendamento Trigger (cron: todo minuto)
  → /api/solicitacoes/processar verifica se tem algo pra disparar
  → Se 07:30 e dia da semana correto:
    → Envia comando ao bot como mensagem
    → Bot chama buscar_chamados → gerar_relatorio_imagem
    → Imagem enviada com legenda curta de "Bom dia"
```

### Comando cadastrado (BD: `dashboard_solicitacoes_programadas` ID 6)

```
/chamados em aberto hoje. Gere APENAS o relatório em IMAGEM e envie com uma legenda curta de bom dia.
NÃO envie mensagem de texto separada, apenas a imagem com legenda. Data: {{HOJE}}
```

## Configuração

### Horário e dias

Configurado na tabela `dashboard_solicitacoes_programadas`:
- **ID:** 6
- **Nome:** Bom dia + Resumo dos Chamados
- **Hora:** 07:30
- **Dias:** seg,ter,qua,qui,sex,sab

Para alterar, UPDATE direto no Postgres:
```sql
docker exec -i n8n-postgres-1 psql -U zazz -d zazzdb
UPDATE dashboard_solicitacoes_programadas SET hora = '08:00' WHERE id = 6;
```

## Histórico de bugs

### Bug: Bom dia disparando 2x (05/06/2026)
**Sintoma:** Duas mensagens no grupo — um textão detalhado (07:30) + imagem com resumo (07:32).
**Causa:** O comando antigo pedia relatório em imagem E mensagem motivacional. O bot interpretava como dois outputs: texto completo + imagem.
**Fix:** Comando reescrito para dizer explicitamente "NÃO envie mensagem de texto separada, apenas a imagem com legenda". Sem triggers internos duplicados.

### Bug: Bom dia disparando 2x (06/05/2026)
**Causa:** Race condition no processamento das solicitações.
**Fix:** UPDATE atômico com `FOR UPDATE SKIP LOCKED` + `RETURNING *`.

## Debug

Se mensagem não chegou, checar:
1. Solicitação ativa? `SELECT * FROM dashboard_solicitacoes_programadas WHERE id = 6;`
2. Evolution API online?
3. N8N rodando? `docker ps | grep n8n`
4. Logs do workflow: execuções recentes no N8N
