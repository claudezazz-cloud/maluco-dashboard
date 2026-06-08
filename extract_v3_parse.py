import json
import sqlite3

VOLUME = "/var/lib/docker/volumes/n8n_data/_data/database.sqlite"
con = sqlite3.connect(VOLUME)
cur = con.cursor()
cur.execute("SELECT id, nodes FROM workflow_entity WHERE name LIKE '%Maluco Bot v3%'")
row = cur.fetchone()

wf_id, nodes_json = row
nodes = json.loads(nodes_json)

for n in nodes:
    if n['name'] == 'Parse Resposta':
        with open('agent_loop_extracted.js', 'w', encoding='utf-8') as f:
            f.write(n['parameters']['jsCode'])
        print(f"Extracted to agent_loop_extracted.js")
        break
con.close()
