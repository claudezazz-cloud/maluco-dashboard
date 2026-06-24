#!/bin/bash
# Backup diário do Postgres (zazzdb): clientes, memória, config, conversas, etc.
# Protege contra corrupção/perda acidental. Mantém os últimos 14 dias.
# Deploy: vive no VPS em /opt/zazz/backup_db.sh; cron 15 4 * * * (01:15 BRT).
set -u
DIR=/root/db_backups
mkdir -p "$DIR"
TS=$(date +%F_%H%M)
F="$DIR/zazzdb_${TS}.sql.gz"

if docker exec n8n-postgres-1 pg_dump -U zazz zazzdb 2>/dev/null | gzip > "$F"; then
  SIZE=$(du -h "$F" | cut -f1)
  BYTES=$(stat -c%s "$F" 2>/dev/null || echo 0)
  if [ "$BYTES" -lt 10240 ]; then
    echo "$(date) ERRO: backup suspeito (${SIZE}, ${BYTES} bytes) — pg_dump pode ter falhado"
    exit 1
  fi
  echo "$(date) OK backup $F (${SIZE})"
  find "$DIR" -name 'zazzdb_*.sql.gz' -mtime +14 -delete
else
  echo "$(date) ERRO: pg_dump falhou"
  exit 1
fi
