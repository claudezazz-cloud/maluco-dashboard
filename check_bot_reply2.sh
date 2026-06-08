#!/bin/bash
docker exec n8n-postgres-1 psql -U zazz -d zazzdb -c "SELECT remetente, mensagem FROM bot_conversas ORDER BY criado_em DESC LIMIT 10;"
