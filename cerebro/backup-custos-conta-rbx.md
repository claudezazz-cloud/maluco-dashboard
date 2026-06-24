# Backup do banco, Painel de custos e conta RBX → Luiz (24/06/2026)

Três melhorias de saúde/operação (ideias escolhidas pelo Franquelin).

## 1. Backup automático do Postgres
- Script `scripts/backup_db.sh` (no VPS em `/opt/zazz/backup_db.sh`): `pg_dump zazzdb | gzip` → `/root/db_backups/zazzdb_<data>.sql.gz`. Valida tamanho (>10KB) e mantém **14 dias** (`find -mtime +14 -delete`).
- **Cron:** `15 4 * * *` (01:15 BRT). Log em `/var/log/db-backup.log`. Dump real ≈ **34MB** gzip.
- **Restaurar:** `gunzip -c zazzdb_<data>.sql.gz | docker exec -i n8n-postgres-1 psql -U zazz -d zazzdb` (cuidado: aplica por cima; pra restore limpo, recriar o banco antes).
- ⚠️ **Limitação:** backup fica NO MESMO VPS. Protege contra corrupção/erro humano, NÃO contra perda do servidor. Melhoria futura: copiar pra fora (PC do Franquelin / storage).

## 2. Painel de custos da IA (`/custos`, admin)
- Página + `GET /api/custos`: tokens **hoje/mês**, custo **estimado** (R$/US$), média tokens/msg, gráfico dos **últimos 14 dias**.
- `bot_conversas` guarda `tokens_input`/`tokens_output` mas **não o modelo** → custo é estimado assumindo **Haiku 4.5** (rates constantes no route: `IN_USD=1`, `OUT_USD=5`/milhão, `USD_BRL=5.40`). Tokens são exatos; o R$ é aproximado (mensagens de tarefa/carnê podem ir pra Sonnet, 3× mais caro).
- Mostra a economia da otimização de 22/06 (cache + enxugar contexto). Mês atual (24/06): ~228 msgs, ~3.9M tokens, ~R$ 25.
- Link no Navbar (admin), ícone $.

## 3. Conta do Routerbox → Luiz (`ldl.luiz..garcia`)
- Os scrapers (`routerbox-auto/scrape.js` chamados + `scrape_clientes.js`) usavam `ldl.franquelin.2`. Trocado pra **`ldl.luiz..garcia`** (a conta que o gerar_carne já usa; creds no `.env` do dashboard) a pedido do Franquelin. Atualizado em `/opt/zazz/routerbox-auto/.env` (RB_USER/RB_PASS; backup `.env.bak.*`).
- Verificado: scraper de clientes roda fim a fim com a conta do Luiz (1128 clientes). ⚠️ Continua **conta compartilhada** ([[project_gerar_carne_conta_compartilhada]]) — se um humano logar com a conta do Luiz, derruba a sessão do bot. Por isso os scrapers rodam fora do pico (clientes 20:30; chamados 07:00/11:20/17:10). Dedicar uma conta só pro bot ainda é o fix ideal.

Ver: [[extrator-lista-clientes]] · [[Chamados]] · [[Infraestrutura]]
