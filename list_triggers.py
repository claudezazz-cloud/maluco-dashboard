import json, sqlite3

VOLUME = "/var/lib/docker/volumes/n8n_data/_data/database.sqlite"
WF_ID = "DiInHUnddtFACSmj"

con = sqlite3.connect(VOLUME)
cur = con.cursor()
cur.execute("SELECT nodes FROM workflow_entity WHERE id=?", (WF_ID,))
row = cur.fetchone()
if not row:
    print(f"ERROR: Workflow {WF_ID} not found!")
    exit(1)

nodes = json.loads(row[0])
print("Trigger/Schedule Nodes:")
for n in nodes:
    ntype = n.get('type', '')
    if 'trigger' in ntype.lower() or 'cron' in ntype.lower() or 'schedule' in ntype.lower():
        print(f"  - '{n.get('name','')}' | type={ntype} | disabled={n.get('disabled', False)}")

con.close()
