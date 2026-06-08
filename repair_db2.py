import sqlite3, uuid

DB = "/var/lib/docker/volumes/n8n_data/_data/database.sqlite"

con = sqlite3.connect(DB, timeout=10)
cur = con.cursor()

# Disable FK checks during repair
cur.execute("PRAGMA foreign_keys = OFF")
cur.execute("PRAGMA wal_checkpoint(TRUNCATE)")

# Get all workflows
cur.execute("SELECT id, name, nodes, connections, versionId, activeVersionId FROM workflow_entity")
workflows = cur.fetchall()

for wf in workflows:
    w_id, w_name, nodes, connections, version_id, active_version_id = wf
    print(f"Processing workflow: {w_id} ({w_name})")
    
    # Check if activeVersionId references a valid workflow_history record
    if active_version_id:
        cur.execute("SELECT COUNT(*) FROM workflow_history WHERE versionId=?", (active_version_id,))
        count = cur.fetchone()[0]
        if count > 0:
            print(f"  -> activeVersionId {active_version_id} is valid, skipping")
            continue
    
    # Need to fix: create a proper history record
    new_vid = str(uuid.uuid4())
    print(f"  -> Creating new history record with versionId={new_vid}")
    
    cur.execute("""
        INSERT INTO workflow_history 
        (versionId, workflowId, authors, nodes, connections, name, autosaved, nodeGroups,
         createdAt, updatedAt)
        VALUES (?, ?, '[]', ?, ?, ?, 0, '[]',
                STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW'), STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW'))
    """, (new_vid, w_id, nodes, connections, w_name))
    
    # Point activeVersionId to the new history record
    cur.execute("UPDATE workflow_entity SET activeVersionId=?, versionId=? WHERE id=?",
                (new_vid, new_vid, w_id))
    print(f"  -> Updated activeVersionId to {new_vid}")

con.commit()

# Verify all FK constraints are now satisfied
cur.execute("PRAGMA foreign_key_check")
fk_errors = cur.fetchall()
if fk_errors:
    print(f"\nWARNING: {len(fk_errors)} FK violations remain:")
    for err in fk_errors:
        print(f"  {err}")
else:
    print("\nAll foreign key constraints are satisfied!")

cur.execute("PRAGMA wal_checkpoint(TRUNCATE)")
con.close()
print("DB repair complete.")
