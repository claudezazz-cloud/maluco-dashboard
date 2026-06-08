import json
import sqlite3

VOLUME = "/var/lib/docker/volumes/n8n_data/_data/database.sqlite"

con = sqlite3.connect(VOLUME)
cur = con.cursor()
cur.execute("SELECT id, name, nodes FROM workflow_entity WHERE name LIKE '%Maluco da IA v7.12%'")
rows = cur.fetchall()

updated = False
for r in rows:
    wf_id, wf_name, nodes_json = r
    try:
        nodes = json.loads(nodes_json)
    except:
        continue
        
    for n in nodes:
        if n['name'] == 'Agendamento Trigger':
            n['disabled'] = True
            updated = True
            print(f"Disabled Agendamento Trigger in Workflow: {wf_name}")
            break
            
    if updated:
        cur.execute("UPDATE workflow_entity SET nodes=? WHERE id=?", (json.dumps(nodes), wf_id))
        con.commit()
        break

con.close()
if not updated:
    print("Failed to update.")
