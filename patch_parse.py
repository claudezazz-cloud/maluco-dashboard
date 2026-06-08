import json, sqlite3

VOLUME = "/var/lib/docker/volumes/n8n_data/_data/database.sqlite"
WF_ID = "DiInHUnddtFACSmj"

with open('parse_resposta_dump.js', 'r', encoding='utf-8') as f:
    code = f.read()

con = sqlite3.connect(VOLUME)
cur = con.cursor()
cur.execute("SELECT nodes FROM workflow_entity WHERE id=?", (WF_ID,))
row = cur.fetchone()
nodes = json.loads(row[0])

for n in nodes:
    if n['name'] == 'Parse Resposta':
        n['parameters']['jsCode'] = code
        break

cur.execute("UPDATE workflow_entity SET nodes=? WHERE id=?", (json.dumps(nodes), WF_ID))
con.commit()
con.close()
