#!/bin/bash
ssh -o StrictHostKeyChecking=no root@195.200.7.239 'docker exec n8n-postgres-1 psql -U zazz -d zazzdb -c "SELECT chat_id, left(mensagem, 30) as msg, criado_em FROM bot_conversas ORDER BY criado_em DESC LIMIT 5;"'
