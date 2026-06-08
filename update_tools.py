import json
import sqlite3

VOLUME = "/var/lib/docker/volumes/n8n_data/_data/database.sqlite"

with open('agent_loop_found.js', 'r', encoding='utf-8') as f:
    code = f.read()

con = sqlite3.connect(VOLUME)
cur = con.cursor()
cur.execute("SELECT id, name, nodes FROM workflow_entity WHERE name LIKE '%Maluco Bot v3%'")
rows = cur.fetchall()

updated = False
for r in rows:
    wf_id, wf_name, nodes_json = r
    try:
        nodes = json.loads(nodes_json)
    except:
        continue
        
    for n in nodes:
        params = n.get('parameters', {})
        if 'jsCode' in params and 'gerar_relatorio_excel' in params['jsCode']:
            n['parameters']['jsCode'] = code
            updated = True
            print(f"Updated Node: {n['name']} in Workflow: {wf_name}")
            break
            
    if updated:
        cur.execute("UPDATE workflow_entity SET nodes=? WHERE id=?", (json.dumps(nodes), wf_id))
        con.commit()
        break

con.close()
if not updated:
    print("Failed to update.")
