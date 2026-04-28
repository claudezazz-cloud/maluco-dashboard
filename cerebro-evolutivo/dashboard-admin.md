# Dashboard Admin — Estrutura

Painel Next.js 14 (App Router) rodando em `dashboard.srv1537041.hstgr.cloud` (PM2: `maluco-dashboard`).

## Páginas principais

- `/` — login
- `/admin` — painel principal com abas: Filiais, Usuários, Configurações, Solicitações, Grupos, Métricas
- `/treinamento` — abas: pops, regras, skills, colaboradores, evolutivo
- `/admin/filiais/[id]` — editar configurações de filial (tokens, IDs externos)

## Padrões de código

- Auth: `getSession()` + `requireAdmin()` de `lib/auth.js`
- DB: `query(sql, params)` de `lib/db.js` — sempre parametrizado com `$1`, `$2`...
- Schema auto-gerenciado: `ensureTables()` chamado dentro da rota API
- Tema: bg `#0f0f13`, cards `#1a1a24`, brand `#071DE3`

## Deploy

```bash
# No VPS
cd /opt/zazz/dashboard
git pull origin main
npm run build && pm2 restart maluco-dashboard --update-env
```

## Configurações de filial (dashboard_filiais_config)

Chaves usadas:
- `notion_token` — token da integração Notion (começa com `secret_`)
- `notion_database_id` — UUID do banco de tarefas Notion
- outras chaves conforme necessidade

Tabela com constraint UNIQUE em `(filial_id, chave)`.

## Aba Grupos (/admin → Grupos)

Gerencia grupos WhatsApp internos. Tabela `grupos_whatsapp`:
- `nome`, `chat_id` (JID do grupo, ex: `120363xxxxx@g.us`), `descricao`
- Toggles: `bom_dia`, `alertas_notion_entrega`, `alertas_notion_ok`
- Seed automático na primeira abertura: Nego's Internet, Nego's Sub, Migra e Instalação, Diário

API: `/api/grupos` (GET + POST) e `/api/grupos/[id]` (PUT + DELETE).

O N8N usa a tabela para:
- Enviar Alertas Notion OK → grupos com `alertas_notion_ok = true`
- Enviar Alertas Entrega → grupos com `alertas_notion_entrega = true`
- O nó "Busca Grupo Atual" injeta nome+descrição no context do bot por mensagem

Aba Solicitações: multi-grupo — ao criar/editar, o campo "Grupos" mostra checkboxes para selecionar múltiplos grupos simultaneamente. O `chat_id` é armazenado como string separada por vírgula (ex: `jid1@g.us,jid2@g.us`). O endpoint N8N `/api/solicitacoes/n8n` expande automaticamente: uma solicitação com 3 grupos vira 3 itens na resposta, um por grupo. O card da solicitação exibe os nomes dos grupos resolvidos da tabela `grupos_whatsapp`.

## Aba Evolutivo (Treinamento)

Visível apenas para admins. Permite:
- Configurar pasta das notas (`cerebro-evolutivo/` por padrão)
- Padrões de arquivos/pastas a ignorar
- Sincronizar manualmente
- Ver métricas: total notas, chunks, última sync, erros
- Tabela de documentos indexados com status
