# Solicitações Programadas — Automações Agendadas

Solicitações programadas são comandos que o sistema dispara automaticamente no horário configurado, simulando um usuário digitando no WhatsApp. Diferente de mensagens agendadas (`mensagens_agendadas`), aqui o bot **processa e responde** ao comando — não apenas envia uma mensagem.

---

## Como funciona

```
Cron N8N (a cada minuto)  →  GET /api/solicitacoes/n8n (hora+dia atual)
                          →  Retorna tarefas do horário
                          →  N8N faz POST no webhook /webhook/whatsapp simulando mensagem
                          →  Bot processa normalmente (com todo o contexto)
                          →  Marca ultimo_executado via POST /api/solicitacoes/n8n?id=X
```

O N8N consulta o endpoint a cada minuto. O endpoint verifica `hora = HH:MM atual` E `dia ∈ dias_semana` E `ultimo_executado < 50 min atrás` (evita dupla execução).

---

## Solicitações ativas (produção — 03/05/2026)

| Nome | Horário | Grupos | Dias |
|---|---|---|---|
| Bom dia + Resumo dos Chamados | 07:00 | Nego's Internet | seg-sáb |
| Relatório Diário das Mensagens Manhã | 11:40 | Nego's Internet, Diário Zazz | seg-sáb |
| Relatório Diário das Mensagens Tarde | 17:20 | Nego's Internet, Diário Zazz | seg-sex |
| PARADOS NOTION NEGO'S INTERNET | 18:00 | Nego's Internet | seg-sex |

**Comandos dos relatórios (11:40 e 17:20):**
> Para cada pendência encontrada: crie uma tarefa no Notion se ainda não existir, e crie um lembrete agendado cobrando o responsável. Faça tudo sem perguntar para o usuário.
- 11:40 → lembrete para daqui 2 horas
- 17:20 → lembrete para amanhã às 08:15

---

## Schema — `dashboard_solicitacoes_programadas`

```sql
dashboard_solicitacoes_programadas (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  comando TEXT NOT NULL,        -- o que será "digitado" no WhatsApp
  chat_id TEXT NOT NULL,        -- JID(s) separados por vírgula
  hora VARCHAR(5) NOT NULL,     -- 'HH:MM'
  dias_semana VARCHAR(50),      -- 'seg,ter,qua,qui,sex' ou 'todos'
  ativo BOOLEAN DEFAULT true,
  ultimo_executado TIMESTAMP,
  criado_em TIMESTAMP DEFAULT NOW()
)
```

**`chat_id` com múltiplos grupos:** separados por vírgula. O endpoint n8n expande cada um em uma row separada para envio individual.

**`dias_semana`:** valores válidos: `seg`, `ter`, `qua`, `qui`, `sex`, `sab`, `dom`, `todos`.

---

## APIs

| Rota | Auth | Função |
|---|---|---|
| `GET /api/solicitacoes` | admin session | lista todas |
| `POST /api/solicitacoes` | admin session | cria nova |
| `PUT /api/solicitacoes/[id]` | admin session | edita |
| `DELETE /api/solicitacoes/[id]` | admin session | exclui |
| `POST /api/solicitacoes/executar` | admin session | dispara imediatamente ("Executar Agora") |
| `GET /api/solicitacoes/n8n` | x-token (N8N_POPS_TOKEN) | retorna tarefas do horário atual |
| `POST /api/solicitacoes/n8n?id=X` | x-token | marca ultimo_executado |

---

## Executar Agora

Botão no painel admin. Chama `POST /api/solicitacoes/executar` com `{ id }`. O endpoint:
1. Busca a solicitação no banco
2. Para cada `chat_id` configurado, faz POST no webhook N8N simulando mensagem WhatsApp:
   ```json
   { "event": "messages.upsert", "data": { "key": { "remoteJid": chatId }, "message": { "extendedTextMessage": { "text": comando } }, "pushName": "Dashboard" } }
   ```
3. Marca `ultimo_executado = NOW()`

**Webhook N8N:** `N8N_WEBHOOK_URL` ou `https://n8n.srv1537041.hstgr.cloud/webhook/whatsapp`
**BOT_NUMBER:** `554396543242@s.whatsapp.net` (mencionado no contextInfo para o bot processar)

---

## Diferença: Solicitações vs Mensagens Agendadas

| | Solicitações Programadas | Mensagens Agendadas |
|---|---|---|
| Tabela | `dashboard_solicitacoes_programadas` | `mensagens_agendadas` |
| Recorrência | Sim (horário + dias da semana) | Não (data/hora única) |
| O bot processa? | Sim (recebe como mensagem WhatsApp) | Não (envia texto direto via Evolution API) |
| Quem cria | Admin no dashboard | Bot (tool `criar_lembrete`) ou sistema (`tarefas/cobrar`) |
| Exemplo | "Relatório diário 11:40" | "Lembrete: cobrar Victor amanhã 08:15" |

---

## Pegadinhas

- `dias_semana LIKE '%seg%'` foi substituído por `$2 = ANY(string_to_array(dias_semana, ','))` — match exato, sem falsos positivos.
- Guard de `ultimo_executado < 50 min` evita dupla execução se N8N chamar 2x no mesmo minuto.
- Se o webhook N8N falhar em todos os grupos, retorna 502 e `ultimo_executado` NÃO é atualizado — vai tentar de novo no próximo minuto.
- Múltiplos chat_ids: se falhar em 1 de 3, `ultimo_executado` é marcado mesmo assim (comportamento parcial aceito).
