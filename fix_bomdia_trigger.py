"""Desabilita o node 'Bom Dia Trigger' no workflow DiInHUnddtFACSmj para evitar disparo duplicado."""
import json, sqlite3, uuid, subprocess

VOLUME = "/var/lib/docker/volumes/n8n_data/_data/database.sqlite"
WF_ID = "DiInHUnddtFACSmj"

print("Stopping n8n...")
subprocess.run(["docker", "stop", "n8n-n8n-1"], check=True)

con = sqlite3.connect(VOLUME, timeout=10)
cur = con.cursor()
cur.execute("PRAGMA foreign_keys = OFF")
cur.execute("PRAGMA wal_checkpoint(TRUNCATE)")

cur.execute("SELECT nodes FROM workflow_entity WHERE id=?", (WF_ID,))
row = cur.fetchone()
if not row:
    print(f"ERROR: Workflow {WF_ID} not found!")
    con.close()
    exit(1)

nodes = json.loads(row[0])
found = False
for n in nodes:
    name = n.get('name', '')
    if 'Bom Dia' in name and ('Trigger' in name or 'Schedule' in name or n.get('type','') == 'n8n-nodes-base.scheduleTrigger'):
        print(f"Found node: '{name}' (type={n.get('type','')})")
        n['disabled'] = True
        found = True
        print(f"  -> Set disabled=True")

# Also check for any node with "Bom Dia" that is a schedule/cron type
for n in nodes:
    name = n.get('name', '')
    ntype = n.get('type', '')
    if 'bom' in name.lower() and 'dia' in name.lower() and ntype in ('n8n-nodes-base.scheduleTrigger', 'n8n-nodes-base.cron'):
        if not n.get('disabled'):
            print(f"Found additional node: '{name}' (type={ntype})")
            n['disabled'] = True
            found = True
            print(f"  -> Set disabled=True")

if not found:
    # List all trigger/schedule nodes for debugging
    print("WARNING: No 'Bom Dia Trigger' found. Listing all trigger nodes:")
    for n in nodes:
        ntype = n.get('type', '')
        if 'trigger' in ntype.lower() or 'cron' in ntype.lower() or 'schedule' in ntype.lower():
            print(f"  - '{n.get('name','')}' type={ntype} disabled={n.get('disabled', False)}")

new_vid = str(uuid.uuid4())
nodes_json = json.dumps(nodes)
cur.execute("UPDATE workflow_entity SET nodes=?, versionId=? WHERE id=?", (nodes_json, new_vid, WF_ID))

cur.execute("SELECT activeVersionId FROM workflow_entity WHERE id=?", (WF_ID,))
avid = cur.fetchone()[0]
if avid:
    cur.execute("UPDATE workflow_history SET nodes=? WHERE versionId=?", (nodes_json, avid))
    print(f"Updated workflow_history for {avid}")

con.commit()
cur.execute("PRAGMA wal_checkpoint(TRUNCATE)")
con.close()

print("Starting n8n...")
subprocess.run(["docker", "start", "n8n-n8n-1"], check=True)
print("Done!")
