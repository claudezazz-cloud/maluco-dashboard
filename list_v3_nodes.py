import json
import sqlite3

VOLUME = "/var/lib/docker/volumes/n8n_data/_data/database.sqlite"
con = sqlite3.connect(VOLUME)
cur = con.cursor()
cur.execute("SELECT name, id, nodes FROM workflow_entity WHERE name LIKE '%Maluco Bot v3%'")
rows = cur.fetchall()
if not rows:
    print("V3 not found")
    exit(1)

for r in rows:
    wf_name, wf_id, nodes_json = r
    print(f"Workflow: {wf_name}")
    nodes = json.loads(nodes_json)
    for n in nodes:
        print(f"  - {n['name']}")

con.close()
