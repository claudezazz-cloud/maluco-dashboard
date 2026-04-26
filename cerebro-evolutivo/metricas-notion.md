# Métricas de Tarefas (Notion)

Aba "Métricas" no painel admin que exibe indicadores de tarefas do tipo INTERNET no Notion.

## O que mostra

- Total de tarefas criadas nos últimos 7 e 30 dias
- Total criadas, concluídas e pendentes no período selecionado
- Taxa de conclusão (%)
- Gráfico de barras SVG (criadas vs concluídas por dia)
- Tabela resumo por status

## Filtros disponíveis

- Últimos 7 dias
- Últimos 30 dias
- Últimos 90 dias

## Configuração necessária

Na dashboard → Admin → Filiais → editar filial:
- **Token da Integração Notion** (`notion_token`) — token de integração que começa com `secret_`
- **Notion Database ID** (`notion_database_id`) — ID do banco de tarefas (formato UUID sem traços)

O banco Notion precisa estar compartilhado com a integração (Notion → ... → Connections).

## Onde fica no código

- Rota: `app/api/admin/metricas/notion/route.js`
- UI: componente `MetricasTab` em `app/admin/page.jsx`
- Configuração filial: `app/admin/filiais/[id]/page.jsx` e `app/api/filiais/[id]/route.js`

## Erro comum

"O banco existe mas não está compartilhado com a integração" → abrir o banco no Notion → `...` → Connections → adicionar a integração.
