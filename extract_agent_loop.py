import json
import sqlite3

VOLUME = "/var/lib/docker/volumes/n8n_data/_data/database.sqlite"
# Maluco Bot v3 ID is gS0v7Yx4Ym1vC4sJ or similar. Wait, how do I know its exact ID?
# Let's search by name instead
con = sqlite3.connect(VOLUME)
cur = con.cursor()
cur.execute("SELECT id, nodes FROM workflow_entity WHERE name LIKE '%Maluco Bot v3%'")
row = cur.fetchone()
if not row:
    print("V3 not found")
    exit(1)

wf_id, nodes_json = row
nodes = json.loads(nodes_json)

for n in nodes:
    if n['name'] == 'Agent Loop':
        with open('agent_loop_extracted.js', 'w', encoding='utf-8') as f:
            f.write(n['parameters']['jsCode'])
        print(f"Extracted to agent_loop_extracted.js (from workflow {wf_id})")
        break
con.close()
