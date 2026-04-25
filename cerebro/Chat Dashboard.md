# Chat Dashboard

← volta para [[Maluco da IA]] | parte da [[Dashboard]] | passa pelo [[Workflow N8N]]

Página `/chat` na [[Dashboard]] que permite **conversar com o bot diretamente pelo navegador**, sem precisar mandar mensagem no grupo WhatsApp. Útil pra teste, debug, ou uso individual.

## Como funciona

### Frontend (`app/chat/page.jsx`)

1. Usuário digita mensagem ou faz upload de imagens (até 10 por envio) ou grava áudio
2. POST `/api/chat/send` com `{message, images?, audioBase64?}`
3. Frontend faz polling `GET /api/chat/messages?chatId=dashboard-{email}@c.us` a cada 2 segundos
4. Renderiza histórico (usuário + bot)

### Backend

- `POST /api/chat/send` injeta a mensagem no [[Workflow N8N]] via webhook simulando o payload da Evolution API, com `chatId = "dashboard-{email}@c.us"` (prefixo `dashboard-` é o gate)
- Workflow processa normal: [[Banco de Dados|consulta POPs]], chama Claude, salva resposta em `bot_conversas`
- `GET /api/chat/messages` lê últimas N msgs de `bot_conversas` filtrando pelo chatId

## Gate: pular Envia WhatsApp

O chatId começando com `dashboard-` ativa o IF "É Chat Dashboard?" no [[Workflow N8N]] — **não envia pra Evolution API**, só salva resposta no Postgres pra dashboard mostrar.

Sem isso, o nó `Envia WhatsApp` ficava 120s travado tentando mandar pra um número fake.

## Multi-imagem e áudio

- **Imagens** (commits recentes): até 10 anexos por mensagem, processados via [[Fluxo de Imagem|Claude Vision]] em uma única chamada (multi-imagem)
- **Áudio**: botão de gravar usa MediaRecorder do browser, base64 vai pro [[Fluxo de Audio|Groq Whisper]]

## ChatId pattern

```
dashboard-{email_user}@c.us
ex: dashboard-lanlunardelli@gmail.com@c.us
```

Cada usuário tem seu próprio histórico isolado — útil pra simular conversas privadas.

## Sem grupo, sem [[Colaboradores]] context

Como é DM (direct message simulada), o bot **não usa contexto de grupo** — não puxa histórico de outros membros. O system prompt completo ainda entra (POPs, colaboradores, etc), só que o `{{HISTORICO}}` é zero.
