#!/bin/bash
docker exec n8n-postgres-1 psql -U zazz -d zazzdb -c "SELECT chat_id FROM dashboard_solicitacoes_programadas LIMIT 1;"
