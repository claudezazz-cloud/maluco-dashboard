#!/bin/bash
docker exec n8n-postgres-1 psql -U zazz -d zazzdb -c "SELECT DISTINCT grupo_id FROM bot_conversas;"
