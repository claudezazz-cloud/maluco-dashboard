#!/bin/bash
# 1. Update the database
docker exec n8n-postgres-1 psql -U zazz -d zazzdb -c "UPDATE dashboard_solicitacoes_programadas SET hora = '08:30' WHERE nome LIKE '%Bom dia%Chamados%';"
echo "Database updated."

# 2. Deploy dashboard fix
cd /opt/zazz/dashboard
npm run build
pm2 reload dashboard
echo "Dashboard updated and reloaded."
