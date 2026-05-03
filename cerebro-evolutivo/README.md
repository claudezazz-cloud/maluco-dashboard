# Cérebro Evolutivo — Maluco da IA

Notas indexadas e injetadas como contexto no bot. **Toda alteração significativa
no projeto vira/atualiza um `.md` aqui.** Cron do VPS sincroniza a cada minuto.

## Índice

### Arquitetura do bot
- [agent-loop-tool-use.md](agent-loop-tool-use.md) — agent loop v3 (5 tools, Haiku 4.5, retry 429)
- [memoria-evolutiva.md](memoria-evolutiva.md) — 3 camadas de memória (histórico/dia/longa) + tool aprender_fato
- [workflow-n8n.md](workflow-n8n.md) — estrutura geral, padrões, bugs conhecidos do N8N

### Features
- [multigrupo-tipos-implementado.md](multigrupo-tipos-implementado.md) — N grupos WhatsApp + filtro por tipo de tarefa nos alertas Notion
- [metricas-notion.md](metricas-notion.md) — métricas de tarefas do Notion na dashboard
- [notion-sync-snapshot.md](notion-sync-snapshot.md) — detecção de edições no Notion (responsável, entrega, status) com notificação WhatsApp a cada 5min

### Dashboard
- [dashboard-admin.md](dashboard-admin.md) — páginas, padrões, deploy

### Sistema
- [treinamento-evolutivo.md](treinamento-evolutivo.md) — como funcionam essas notas Obsidian

### Histórico (planos concluídos)
- [plano-multigrupo-tipos.md](plano-multigrupo-tipos.md) — plano original (concluído 2026-05-02)

## Convenções

- **1 nota por feature/sistema**, não por evento. Atualizar a nota existente em
  vez de criar nova "rodada".
- Sessões padrão: visão geral → schema → fluxo → pegadinhas → arquivos relevantes.
- IDs de workflow N8N sempre presentes (`Pj5SdaxFh9H9EIX4` etc) pra fácil lookup.
- Sem segredos: tokens vivem em `.env` do VPS ou hardcoded em nó N8N (workflow JSON
  não vai pro git).
