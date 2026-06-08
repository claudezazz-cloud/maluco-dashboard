import json, sqlite3
VOLUME = "/var/lib/docker/volumes/n8n_data/_data/database.sqlite"
WF_ID = "DiInHUnddtFACSmj"
con = sqlite3.connect(VOLUME)
cur = con.cursor()
cur.execute("SELECT nodes FROM workflow_entity WHERE id=?", (WF_ID,))
row = cur.fetchone()
nodes = json.loads(row[0])
for n in nodes:
    if n.get('name') == 'Parse Resposta':
        code = n.get('parameters', {}).get('jsCode', '')
        with open('/root/parse_resposta_dump.js', 'w') as f:
            f.write(code)
        print("Dumped Parse Resposta to /root/parse_resposta_dump.js")
con.close()
