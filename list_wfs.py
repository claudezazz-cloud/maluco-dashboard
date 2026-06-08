import sqlite3
VOLUME = "/var/lib/docker/volumes/n8n_data/_data/database.sqlite"
con = sqlite3.connect(VOLUME)
cur = con.cursor()
cur.execute("SELECT id, name, active FROM workflow_entity")
rows = cur.fetchall()
for r in rows:
    print(f"ID: {r[0]} | Name: {r[1]} | Active: {r[2]}")
con.close()
