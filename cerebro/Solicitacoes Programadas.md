# Solicitações Programadas

← volta para [[Funcionalidades]] | tabela em [[Banco de Dados]] (`dashboard_solicitacoes_programadas`)

Sistema único e flexível de agendamento — substituiu triggers dedicados (Bom Dia, Pendentes).

## Como funciona

```
Agendamento Trigger (a cada minuto)
  → Busca Solicitacoes Due (GET /api/solicitacoes/n8n)
  → Tem Tarefas? (IF: tasks.length > 0)
       └─ true → Extrai Tarefas (split do array)
              → Prepara Body (monta mensagem sintética com mentionedJid do bot)
              → Injeta no Bot (POST no próprio webhook → dispara o fluxo principal)
              → Marca Executado (POST /api/solicitacoes/n8n?id=X)
```

## Mensagem sintética

Inclui: `event: messages.upsert`, `fromMe: false`, `mentionedJid` do bot e `messageTimestamp` atual. Passa por `Filter1` e `Verifica Menção` do [[Workflow N8N]] normalmente — ou seja, **reaproveita 100% do fluxo existente**.

## Configuração na [[Dashboard]]

`/treinamento` → aba Solicitações Programadas. Campos:
- `nome` — identifica (ex: "Bom Dia")
- `comando` — texto que o bot vai receber (ex: "gere a mensagem de bom dia")
- `chat_id` — grupo/chat de destino
- `hora` — horário (ex: `07:30`)
- `dias_semana` — `seg,ter,qua,qui,sex` ou `todos`

## Proteções

- **Duplicatas** → intervalo mínimo de 50min entre execuções da mesma tarefa
- **Última execução** salva em `ultimo_executado` (ver tabela em [[Banco de Dados]])

## Botão "Executar Agora"

Na [[Dashboard]] → dispara via `/api/solicitacoes/executar`. Injeta a mesma mensagem sintética, pulando a verificação de horário — útil pra testar.

## Exemplos de uso

- Bom dia com resumo de chamados, 07:30, seg-sáb
- Relatório de atendimentos, 17:00, seg-sex
- Lembrete de reunião, 09:00, seg
