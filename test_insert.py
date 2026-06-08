import sqlite3
import datetime
import pytz

VOLUME = "/var/lib/docker/volumes/n8n_data/_data/database.sqlite"

# Connect to database
# Wait, dashboard_solicitacoes_programadas is in POSTGRES!
# Oh right, the Next.js API uses Postgres, NOT SQLite! N8N uses SQLite.
