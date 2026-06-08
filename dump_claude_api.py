import json, sqlite3
VOLUME = "/var/lib/docker/volumes/n8n_data/_data/database.sqlite"
WF_ID = "DiInHUnddtFACSmj"
con = sqlite3.connect(VOLUME)
cur = con.cursor()
cur.execute("SELECT nodes FROM workflow_entity WHERE id=?", (WF_ID,))
row = cur.fetchone()
nodes = json.loads(row[0])
for n in nodes:
    if n.get('name') == 'Claude API':
        with open('/root/claude_api_dump.json', 'w') as f:
            json.dump(n, f, indent=2)
        print("Dumped Claude API")
    if n.get('name') == 'Monta Prompt':
        with open('/root/monta_prompt_dump.js', 'w') as f:
            f.write(n.get('parameters', {}).get('jsCode', ''))
        print("Dumped Monta Prompt")
con.close()
