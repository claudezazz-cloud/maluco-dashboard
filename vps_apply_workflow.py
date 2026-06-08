import sqlite3, json, sys, uuid, subprocess, time

DB = "/var/lib/docker/volumes/n8n_data/_data/database.sqlite"
WORKFLOW_ID = "DiInHUnddtFACSmj"

def run(cmd):
    subprocess.run(cmd, shell=True, check=True)

print("Stopping n8n...")
run("docker stop n8n-n8n-1")

with open("/root/workflow_v2.json", "r", encoding="utf-8") as f:
    wf = json.load(f)

nodes_json = json.dumps(wf["nodes"])
conns_json = json.dumps(wf["connections"])
new_vid = str(uuid.uuid4())

con = sqlite3.connect(DB, timeout=10)
cur = con.cursor()
cur.execute("PRAGMA wal_checkpoint(TRUNCATE)")

cur.execute("UPDATE workflow_entity SET nodes=?, connections=?, versionId=?, updatedAt=STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW') WHERE id=?", (nodes_json, conns_json, new_vid, WORKFLOW_ID))
cur.execute("UPDATE workflow_history SET nodes=?, connections=?, versionId=?, updatedAt=STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW') WHERE workflowId=?", (nodes_json, conns_json, new_vid, WORKFLOW_ID))

con.commit()
cur.execute("PRAGMA wal_checkpoint(TRUNCATE)")
con.close()

print("Starting n8n...")
run("docker start n8n-n8n-1")
run("chown 1000:1000 /var/lib/docker/volumes/n8n_data/_data/database.sqlite*")
time.sleep(5)
run(f"docker exec n8n-n8n-1 n8n unpublish:workflow --id={WORKFLOW_ID}")
run(f"docker exec n8n-n8n-1 n8n publish:workflow --id={WORKFLOW_ID}")
run("docker restart n8n-n8n-1")
print("Done!")
