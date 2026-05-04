# Cérebro Evolutivo — Maluco da IA

Notas indexadas e injetadas como contexto no bot. **Toda alteração significativa
no projeto vira/atualiza um `.md` aqui.** Cron do VPS sincroniza a cada minuto.

## Índice

### Arquitetura do bot
- [agent-loop-tool-use.md](agent-loop-tool-use.md) — 7 tools, agent loop v3, Haiku 4.5, timezone, PROXIMOS_DIAS, criar_lembrete
- [memoria-evolutiva.md](memoria-evolutiva.md) — 3 camadas (Redis/dia/longa), aprender_fato, corrigir_fato, contexto injetado
- [workflow-n8n.md](workflow-n8n.md) — estrutura geral do workflow N8N, nodes, padrões de edição

### Features implementadas
- [multigrupo-tipos-implementado.md](multigrupo-tipos-implementado.md) — N grupos WhatsApp + filtro por tipo de tarefa
- [metricas-notion.md](metricas-notion.md) — métricas de tarefas do Notion no dashboard
- [notion-sync-snapshot.md](notion-sync-snapshot.md) — detecção de edições no Notion (responsável, entrega, status) → WhatsApp a cada 5min
- [skills-sistema.md](skills-sistema.md) — comandos /relatorio, /chamados, /pendencias etc. — como criar e como funcionam
- [solicitacoes-programadas.md](solicitacoes-programadas.md) — automações agendadas por horário+dia (relatórios automáticos, cobrança Notion)
- [chamados-sistema.md](chamados-sistema.md) — importação de planilha de chamados, cache Redis, /chamados skill
- [treinamento-evolutivo-sistema.md](treinamento-evolutivo-sistema.md) — indexação das notas Obsidian em chunks (36 docs, 68 chunks)

### Dashboard admin
- [dashboard-admin.md](dashboard-admin.md) — todas as páginas, APIs, tabelas, crons, padrões de código

### Qualidade e evolução
- [auditoria-bugs-corrigidos.md](auditoria-bugs-corrigidos.md) — 23 bugs corrigidos em maio/2026 (race conditions, timezone, paginação, tabela faltante, hallucination, n8n cache)
- [lembretes-standby.md](lembretes-standby.md) — ⚠️ tool `criar_lembrete` desativada em 2026-05-04 (rate limit + hallucination crônica). Plano de reativação documentado.
- [ideias-melhorias.md](ideias-melhorias.md) — backlog de melhorias: memória, confiabilidade, proatividade, observabilidade

### Sistema de notas
- [treinamento-evolutivo.md](treinamento-evolutivo.md) — como funcionam essas notas Obsidian (visão original)

### Histórico (planos concluídos)
- [plano-multigrupo-tipos.md](plano-multigrupo-tipos.md) — plano original do multigrupo (concluído 2026-05-02)

## Convenções

- **1 nota por feature/sistema**, não por evento. Atualizar a nota existente em
  vez de criar "nota da sessão de hoje".
- Ao implementar algo significativo: commit + push → cron sincroniza em 1 min → bot já sabe.
- IDs de workflow N8N sempre presentes (`Pj5SdaxFh9H9EIX4` etc) pra fácil lookup.
- Sem segredos: tokens vivem em `.env` do VPS ou hardcoded em nó N8N (workflow JSON não vai pro git).
- Datas absolutas nas notas (`2026-05-03`, não "ontem") — notas não envelhecem.
