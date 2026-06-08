# Chatwoot

← volta para [[Maluco da IA]] | infraestrutura em [[Infraestrutura]]

Plataforma de atendimento ao cliente (omnichannel) self-hosted integrada à [[Evolution API]] via WhatsApp.

## URLs e acesso

| Item | Valor |
|------|-------|
| **URL** | `https://chatwoot.srv1537041.hstgr.cloud` |
| **Account ID** | `2` |
| **Container app** | `n8n-chatwoot_app-1` |
| **Container worker** | `n8n-chatwoot_sidekiq-1` |
| **Docker Compose** | `/docker/n8n/docker-compose.yml` |

## Containers Docker

```bash
docker ps | grep chatwoot
docker logs n8n-chatwoot_app-1 --tail 50
docker logs n8n-chatwoot_sidekiq-1 --tail 50
```

## Volumes

| Volume | Conteúdo |
|--------|----------|
| `n8n_chatwoot_storage` | Arquivos, imagens e mídias enviadas |
| `n8n_chatwoot_log` | Logs da aplicação |

## Problema conhecido — server.pid travado

Se o container ficar em loop de restart com erro `A server is already running`:

```bash
cd /docker/n8n
docker compose stop chatwoot_app
docker compose rm -f chatwoot_app
docker compose up -d chatwoot_app
```

Isso recria o container descartando a camada de escrita com o PID preso.

## Problema conhecido — webhook_url vazio (mensagens "enviadas" mas não entregues)

**Sintoma:** agente envia mensagem pelo Chatwoot, status fica `sent` com checkmark, mas a mensagem nunca chega no WhatsApp do contato.

**Causa raiz:** o campo `webhook_url` do `Channel::Api` está vazio. Sem ele, o Chatwoot não dispara nada para a Evolution API quando o agente responde.

**Como confirmar:**

```bash
docker exec n8n-chatwoot_app-1 bundle exec rails runner '
Inbox.where(account_id: 2).each do |i|
  puts "Inbox #{i.id} (#{i.name}): webhook_url=#{i.channel.webhook_url.inspect}"
end
'
```

Se aparecer `""` ou `nil` para um inbox que deveria estar integrado à Evolution, é o bug.

**Fix:**

```bash
docker exec n8n-chatwoot_app-1 bundle exec rails runner '
{
  3 => "https://evolution.srv1537041.hstgr.cloud/chatwoot/webhook/Loja",
  4 => "https://evolution.srv1537041.hstgr.cloud/chatwoot/webhook/Agente_Zazz"
}.each do |inbox_id, url|
  Inbox.find(inbox_id).channel.update!(webhook_url: url)
end
'
```

**Lição:** rodar `/chatwoot/set/{instancia}` na Evolution API **não** popula o `webhook_url` no Chatwoot — esse passo precisa ser feito manualmente via Rails runner ao criar/integrar um inbox novo (ver [[Chatwoot Inboxes]]).

Verificado em 2026-05-18 após mensagem "oi" na conversation 335 nunca chegar no WhatsApp apesar do Chatwoot marcar como `sent`.

## SMTP (e-mail)

Ainda **não configurado** — convites por e-mail não funcionam.
Criar usuários diretamente via Rails runner (ver [[Chatwoot Usuarios]]).

## Inboxes (caixas de entrada)

Ver [[Chatwoot Inboxes]] para a lista completa e integração com Evolution API.

## Usuários e agentes

Ver [[Chatwoot Usuarios]] para lista de agentes e como criar novos.

## Armazenamento

- Texto ocupa pouco espaço
- **Mídias** (imagens, áudios, documentos) acumulam no volume `chatwoot_storage`
- VPS tem 96GB total — monitorar com: `du -sh /var/lib/docker/volumes/n8n_chatwoot_storage/_data`
- Limpeza periódica: Settings → Conta → Deletar conversas antigas
