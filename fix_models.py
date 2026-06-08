import sqlite3, uuid, time, subprocess

DB = "/var/lib/docker/volumes/n8n_data/_data/database.sqlite"

def run(cmd):
    subprocess.run(cmd, shell=True, check=True)

print("Stopping n8n to avoid locks...")
run("docker stop n8n-n8n-1")

con = sqlite3.connect(DB, timeout=10)
cur = con.cursor()
cur.execute("PRAGMA wal_checkpoint(TRUNCATE)")

cur.execute("SELECT id, nodes FROM workflow_entity")
rows = cur.fetchall()

for row in rows:
    w_id, nodes = row
    if 'claude-3-5-haiku' in nodes or 'claude-3-5-sonnet' in nodes:
        new_nodes = nodes.replace('claude-3-5-haiku-20241022', 'claude-haiku-4-5-20251001')
        new_nodes = new_nodes.replace('claude-3-5-sonnet-20241022', 'claude-sonnet-4-6')
        
        new_vid = str(uuid.uuid4())
        cur.execute("UPDATE workflow_entity SET nodes=?, versionId=?, updatedAt=STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW') WHERE id=?", (new_nodes, new_vid, w_id))
        cur.execute("UPDATE workflow_history SET nodes=?, versionId=?, updatedAt=STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW') WHERE workflowId=?", (new_nodes, new_vid, w_id))
        print(f"Updated workflow {w_id}")

con.commit()
cur.execute("PRAGMA wal_checkpoint(TRUNCATE)")
con.close()

print("Starting n8n...")
run("docker start n8n-n8n-1")
print("Done!")
