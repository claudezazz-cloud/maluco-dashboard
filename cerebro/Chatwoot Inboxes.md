# Chatwoot — Inboxes

← volta para [[Chatwoot]]

Cada inbox corresponde a uma instância do WhatsApp na [[Evolution API]].

## Inboxes ativos

| ID | Nome | Instância Evolution | Status |
|----|------|---------------------|--------|
| 3 | **Loja** | `Loja` | Ativo |
| 4 | **Agente_Zazz** | `Agente_Zazz` | Ativo |

## Agentes por inbox

| Inbox | Agentes |
|-------|---------|
| **Loja** | Franquelin, Claudival Nego, Victor, Computadores_F1_F2, Junior Souza |
| **Agente_Zazz** | Franquelin, Victor, Claudival Nego, Junior Souza |

## Como criar novo inbox + conectar à Evolution

### 1. Criar inbox no Chatwoot (via Rails runner)

```bash
ssh root@195.200.7.239
docker exec n8n-chatwoot_app-1 bundle exec rails runner '
channel = Channel::Api.create!(account_id: 2)
inbox = Inbox.create!(account_id: 2, channel: channel, name: "NOME_DO_INBOX")
puts "identifier: #{channel.identifier}"
puts "inbox_id: #{inbox.id}"
'
```

### 2. Conectar à Evolution API

```bash
curl -X POST "https://evolution.srv1537041.hstgr.cloud/chatwoot/set/NOME_DA_INSTANCIA" \
  -H "apikey: EVOLUTION_APIKEY" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "accountId": "2",
    "token": "TOKEN_AGENTE_CHATWOOT",
    "url": "https://chatwoot.srv1537041.hstgr.cloud",
    "signMsg": false,
    "reopenConversation": true,
    "conversationPending": false,
    "importContacts": true,
    "importMessages": true,
    "daysLimitImportMessages": 7,
    "mergeBrazilContacts": true,
    "nameInbox": "NOME_DO_INBOX"
  }'
```

> **token** = access token do agente Chatwoot (não é o identifier do inbox)

### 3. ⚠️ Setar `webhook_url` no Channel::Api (OBRIGATÓRIO)

Sem esse passo, mensagens enviadas pelo agente Chatwoot **não chegam no WhatsApp** (Chatwoot mostra `sent` mas Evolution nunca recebe nada). O `chatwoot/set` da Evolution **não** popula esse campo sozinho — tem que ser feito à mão.

```bash
docker exec n8n-chatwoot_app-1 bundle exec rails runner '
Inbox.find(ID_DO_INBOX).channel.update!(
  webhook_url: "https://evolution.srv1537041.hstgr.cloud/chatwoot/webhook/NOME_DA_INSTANCIA"
)
'
```

Confirmar com:

```bash
docker exec n8n-chatwoot_app-1 bundle exec rails runner '
puts Inbox.find(ID_DO_INBOX).channel.webhook_url
'
```

Histórico (mai/2026): inboxes 3 (Loja) e 4 (Agente_Zazz) ficaram com `webhook_url` vazio após a integração inicial — ver [[Chatwoot#Problema conhecido — webhook_url vazio (mensagens "enviadas" mas não entregues)]].

### 4. Atribuir agentes ao inbox

```bash
docker exec n8n-chatwoot_app-1 bundle exec rails runner '
inbox = Inbox.find(ID_DO_INBOX)
user = User.find_by(email: "email@exemplo.com")
InboxMember.find_or_create_by!(inbox: inbox, user_id: user.id)
puts "OK"
'
```

## Verificar integração

```bash
curl "https://evolution.srv1537041.hstgr.cloud/chatwoot/find/NOME_DA_INSTANCIA" \
  -H "apikey: EVOLUTION_APIKEY"
```

## Fluxo de mensagens

```
WhatsApp → Evolution API → webhook → Chatwoot (nova conversa)
Agente responde no Chatwoot → Evolution API → WhatsApp
```
