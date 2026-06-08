import json
import sqlite3

VOLUME = "/var/lib/docker/volumes/n8n_data/_data/database.sqlite"
con = sqlite3.connect(VOLUME)
cur = con.cursor()
cur.execute("SELECT id, name, nodes FROM workflow_entity")
rows = cur.fetchall()

found = False
for r in rows:
    wf_id, wf_name, nodes_json = r
    try:
        nodes = json.loads(nodes_json)
    except:
        continue
    for n in nodes:
        params = n.get('parameters', {})
        if 'jsCode' in params and 'gerar_relatorio_excel' in params['jsCode']:
            with open('agent_loop_found.js', 'w', encoding='utf-8') as f:
                f.write(params['jsCode'])
            print(f"Found tools in Workflow: {wf_name} (ID: {wf_id}), Node: {n['name']}")
            found = True
            break
    if found:
        break
con.close()
