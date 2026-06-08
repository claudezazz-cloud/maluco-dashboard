import sqlite3, subprocess

DB = "/var/lib/docker/volumes/n8n_data/_data/database.sqlite"

def run(cmd):
    subprocess.run(cmd, shell=True, check=True)

print("Stopping n8n to repair DB...")
run("docker stop n8n-n8n-1")

con = sqlite3.connect(DB, timeout=10)
cur = con.cursor()
cur.execute("PRAGMA foreign_keys = OFF")
cur.execute("PRAGMA wal_checkpoint(TRUNCATE)")

cur.execute("SELECT id, versionId FROM workflow_entity")
rows = cur.fetchall()

for row in rows:
    w_id, v_id = row
    # Ensure activeVersionId is valid (just match versionId)
    cur.execute("UPDATE workflow_entity SET activeVersionId=? WHERE id=?", (v_id, w_id))
    
    # Fix workflow_history by removing duplicates and ensuring the versionId exists
    cur.execute("DELETE FROM workflow_history WHERE workflowId=?", (w_id,))
    
    # Insert exactly one history record with this versionId to satisfy foreign keys
    cur.execute("SELECT nodes, connections, versionId FROM workflow_entity WHERE id=?", (w_id,))
    wf_data = cur.fetchone()
    if wf_data:
        nodes, connections, vid = wf_data
        cur.execute("INSERT INTO workflow_history (versionId, workflowId, nodes, connections, authors, createdAt, updatedAt) VALUES (?, ?, ?, ?, '[]', STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW'), STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW'))", (vid, w_id, nodes, connections))

con.commit()
cur.execute("PRAGMA wal_checkpoint(TRUNCATE)")
con.close()

print("Starting n8n...")
run("docker start n8n-n8n-1")
print("Done!")
