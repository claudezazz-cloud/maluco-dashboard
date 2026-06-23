# Dashboard "Visão Geral" — online/contagens lidos do SQLite (23/06/2026)

**Sintoma:** dashboard mostrava **BOTS ONLINE 0/1**, filial Lunardelli "Offline / Sem workflow", **MENSAGENS HOJE 0** e "Nenhuma execução encontrada" — mesmo com o bot online e com movimento.

**3 causas:**
1. **Filial apontava pro workflow ERRADO:** `dashboard_filiais.n8n_workflow_id = DiInHUnddtFACSmj` (v2 legado, desativado). O correto é `Pj5SdaxFh9H9EIX4` (v3). → corrigido por `UPDATE dashboard_filiais`.
2. **`N8N_API_KEY` vencida (HTTP 401):** `/api/status` e `/api/executions` usavam a API do n8n (`lib/n8n.js`) pra saber se o workflow está ativo + listar execuções. A key do n8n **expira a cada ~3 meses** → tudo virava "offline/sem execução". (Pegadinha recorrente.)
3. **`group_chat_id` único e desatualizado:** as contagens (`mensagensHoje`/`errosHoje`) filtravam por `filial.group_chat_id` (1 grupo só). O bot atende VÁRIOS grupos → o filtro zerava tudo.

**Fix (deployado):** as duas rotas pararam de depender da API key.
- **`/api/status`** e **`/api/executions`** agora leem o estado REAL **direto do SQLite do n8n** (`/var/lib/docker/volumes/n8n_data/_data/database.sqlite`) via `execFileSync('python3', ...)`. Funciona porque o **PM2 roda como root** e o arquivo é world-readable (`-rw-rw-r--`). Lê `workflow_entity.active`/`name` (online + nome) e `execution_entity` (última execução + lista).
- **Contagens** (`mensagensHoje`/`errosHoje`) agora contam TODAS as linhas do dia (`bot_conversas`/`bot_erros`) — sem filtrar por grupo (1 filial, bot multi-grupo).
- **Online:** `workflow_entity.active` do SQLite; se não conseguir ler, cai pra heurística de atividade recente (40min em `bot_conversas`/`mensagens`).

**Resultado:** `online:true`, `workflowNome:"Maluco Bot v3 (tool_use)"`, `mensagensHoje` real, execuções listadas. **Não depende mais da N8N_API_KEY** → não quebra quando a key expirar.

**Se um dia voltar a dar "offline" com o bot rodando:** checar (a) `workflow_entity.active=1` pro `Pj5SdaxFh9H9EIX4` no SQLite; (b) `python3` acessível pro processo do dashboard; (c) `n8n_workflow_id` da filial = v3. A `N8N_API_KEY` NÃO é mais necessária pra esses cards (só pra `lib/n8n.js` em outros usos, ex.: duplicar workflow).

Ver: [[Dashboard]] · [[Infraestrutura]] · [[workflow-n8n]]
