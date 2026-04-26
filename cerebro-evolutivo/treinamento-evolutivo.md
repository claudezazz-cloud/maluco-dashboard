# Treinamento Evolutivo

Feature que indexa notas do Obsidian no banco e injeta como contexto complementar no bot.

## Como funciona

1. Arquivos `.md` da pasta `cerebro-evolutivo/` são lidos e divididos em chunks (1500 chars, overlap 150)
2. Cada arquivo recebe um hash sha256 — só reindexado se o conteúdo mudar
3. Os chunks ficam nas tabelas `evolutive_documents` e `evolutive_chunks` no PostgreSQL
4. O nó "Busca Evolutivo" no N8N lê esses chunks e passa pro "Monta Prompt"
5. O "Monta Prompt" aplica keyword scoring (mesma lógica dos POPs) e pega os 5 chunks mais relevantes
6. Injetados no system prompt no placeholder `{{EVOLUTIVO}}`

## Prioridade

**POPs têm prioridade sobre o Evolutivo.** Em caso de conflito, o POP prevalece.

## Fluxo N8N

`Busca Skills → Busca Tarefas Notion → Busca Evolutivo → Monta Prompt`

O nó "Busca Evolutivo" tem `executeOnce: true` e `alwaysOutputData: true`.

## Sincronização automática

Cron no VPS (`/etc/cron.d/evolutivo-sync` ou crontab root):
- Roda todo minuto: `* * * * *`
- Script: `/opt/zazz/dashboard/sync-evolutivo.sh`
- Faz `git pull origin main` e chama o endpoint de sync
- Token: `EVOLUTIVO_SYNC_2026` (header `x-token`)

## Administração

Dashboard → Treinamento → aba **Evolutivo**:
- Configurar pasta e padrões de ignorar
- Botão "Sincronizar agora"
- Cards com total de notas, chunks, última sync
- Tabela com status de cada arquivo

## Tabelas no banco

- `evolutive_sources` — configuração da pasta (1 linha)
- `evolutive_documents` — 1 linha por arquivo .md
- `evolutive_chunks` — N chunks por documento
- `evolutive_sync_logs` — histórico de syncs

## Endpoint de sync

`POST /api/treinamento-evolutivo/sync`
- Header `x-token: EVOLUTIVO_SYNC_2026` para cron (sem login)
- Ou sessão admin autenticada
