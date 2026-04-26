# Dashboard Admin — Estrutura

Painel Next.js 14 (App Router) rodando em `dashboard.srv1537041.hstgr.cloud` (PM2: `maluco-dashboard`).

## Páginas principais

- `/` — login
- `/admin` — painel principal com abas: colaboradores, filiais, métricas
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

## Aba Evolutivo (Treinamento)

Visível apenas para admins. Permite:
- Configurar pasta das notas (`cerebro-evolutivo/` por padrão)
- Padrões de arquivos/pastas a ignorar
- Sincronizar manualmente
- Ver métricas: total notas, chunks, última sync, erros
- Tabela de documentos indexados com status
