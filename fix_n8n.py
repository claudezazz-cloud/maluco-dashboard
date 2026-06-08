import sqlite3

DB = "/var/lib/docker/volumes/n8n_data/_data/database.sqlite"
WORKFLOW_ID = "Pj5SdaxFh9H9EIX4"

con = sqlite3.connect(DB)
cur = con.cursor()

# Get the latest valid versionId from workflow_history
cur.execute("SELECT versionId FROM workflow_history WHERE workflowId=? ORDER BY updatedAt DESC LIMIT 1", (WORKFLOW_ID,))
row = cur.fetchone()
if row:
    valid_vid = row[0]
    print(f"Valid versionId found: {valid_vid}")
    cur.execute("UPDATE workflow_entity SET versionId=?, active=1 WHERE id=?", (valid_vid, WORKFLOW_ID))
    con.commit()
    print(f"workflow_entity updated to active=1 and versionId={valid_vid}")
else:
    print("No versionId found in workflow_history!")
con.close()
