# Scripts `fix_*.py` históricos — TODO: limpar

## Status: PENDENTE LIMPEZA

A raiz do projeto tem ~20 scripts `fix_*.py` que foram usados para correções pontuais ao longo do tempo. Esses scripts são **one-shot** (rodam uma vez, alteram SQLite/postgres, depois não são mais úteis). Estão poluindo a raiz do repo.

## Lista atual (a partir de mai/2026)

| Script | O que fez | Quando | Status do fix no código |
|---|---|---|---|
| `fix_alerta_entrega_config.py` | Configurou `dashboard_config` para alertas de entrega Notion | abr/2026 | ✅ aplicado em produção |
| `fix_busca_grupo_atual.py` | Adicionou nó `Busca Grupo Atual` no workflow + query SQL | abr/2026 | ✅ no SQLite atual |
| `fix_busca_ok_notion_url.py` | Corrigiu URL da busca de tarefas Ok do Notion | abr/2026 | ✅ aplicado |
| `fix_contexto_grupo.py` | Injetou `[Contexto: Você está no grupo "X"]` no Monta Prompt | abr/2026 | ✅ no Monta_Prompt.js atual |
| `fix_envia_whatsapp_notif.py` | Corrigiu jsonBody dos nós Envia WhatsApp Notif | abr/2026 | ✅ aplicado |
| `fix_filtra_decide_multigrupo.py` | Refatorou Filtra e Decide / Filtra Entrega para multigrupo | abr/2026 | ✅ aplicado |
| `fix_grupos_multigrupo_n8n.py` | Migrou `grupos_whatsapp` para suporte multigrupo (tipos_filtro_*) | abr/2026 | ✅ aplicado |
| `fix_imagem_descricao.py` | Salvou descrição da imagem (Claude Vision) no campo dbMensagem | abr/2026 | ✅ no Formata Imagem |
| `fix_injeta_memoria_monta_prompt.py` | Adicionou `Busca Memoria Contexto` no fluxo + injeção no prompt | abr/2026 | ✅ aplicado |
| `fix_memoria_dia_query.py` | Corrigiu query de Por Chat → Busca Mensagens Hoje (out0/out1 swap) | abr/2026 | ✅ aplicado |
| `fix_notion_date_fallback.py` | Corrigiu `buildNotionBody` para data vazia / desc vazia | abr/2026 | ✅ no Parse Resposta |
| `fix_notion_task_ids.py` | Adicionou `[id:abc]` no início de cada tarefa do prompt | abr/2026 | ✅ no Monta_Prompt.js |
| `fix_por_chat_outputs.py` | Swap dos outputs out0/out1 do SplitInBatches v3 | abr/2026 | ✅ aplicado |
| `fix_redis_ttl.py` | Configurou TTL no Redis para `chamados:data` | abr/2026 | ✅ aplicado |
| `fix_regras_formatacao.py` | Reforçou regras de formatação WhatsApp no system prompt | abr/2026 | ✅ no sysprompt_v3.txt |
| `fix_relatorio_prompt.py` | Atualizou Monta Prompt Relatório (sincronizou com Monta Prompt) | abr/2026 | ✅ deploy_workflow.py faz isso agora |
| `fix_remetente_canonico.py` | Implementou COALESCE de remetente via colaboradores_numeros | abr/2026 | ✅ nos nós Salva |
| `fix_workflow_bugs.py` | Corrigiu bugs gerais do workflow ("É Relatório?" guard, etc) | abr/2026 | ✅ aplicado |
| `fix_workflow_state.py` | Ativou/desativou workflow programaticamente | abr/2026 | ✅ — substituído por `deploy_workflow.py` |
| `v3_04_fix_dup_save.py` | Removeu salvamento duplicado de mensagens | abr/2026 | ✅ aplicado |

## Por que removê-los

1. **Não são mais necessários** — todos os fixes já estão aplicados em produção
2. **Poluem a raiz** do repo — confundem ao olhar `git status` ou `ls`
3. **Hard-coded com state antigo** — referências a workflow IDs antigos, queries SQL desatualizadas, paths que não existem mais
4. **API key do n8n expira** — vários usam JWT que provavelmente já vencem (~3 meses TTL)

## Plano de limpeza (TODO)

1. Mover todos para `archive/fix_scripts_2026_q2/` (mantém histórico no git para auditoria)
2. Atualizar `.gitignore` se algum tinha credentials
3. Atualizar este doc com confirmação de archived
4. Procedimento padrão futuro: scripts one-shot vão direto para `archive/` com nome datado

**Não rodar de novo:** se precisar replicar uma migração, leia o código pra entender o que faz, depois escreva script novo. Os antigos esperam state passado e podem corromper o atual.

## Substituto para fixes futuros

Para edições no workflow N8N: usar `v3_dump/deploy_workflow.py` (deploy padrão estabelecido em mai/2026, ver [deploy-workflow.md](deploy-workflow.md)).

Para edições no Postgres: usar SQL direto via `docker exec n8n-postgres-1 psql -U zazz -d zazzdb -c "..."` ou criar script novo em `dashboard/scripts/` (não na raiz).
