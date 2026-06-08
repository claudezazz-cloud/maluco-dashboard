import sqlite3, json, uuid, subprocess, sys, time

DB = "/var/lib/docker/volumes/n8n_data/_data/database.sqlite"
MP_FILE = "/root/agent_loop_found.js"
WORKFLOW_ID = "Pj5SdaxFh9H9EIX4"
NODES_TO_UPDATE = ("Claude API",)

def run(cmd):
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if r.returncode != 0:
        print(f"[FAIL] {cmd}\n{r.stderr}", file=sys.stderr); sys.exit(1)
    return r.stdout

def main():
    with open(MP_FILE) as f:
        new_code = f.read()
    print(f"[1/6] Loaded {MP_FILE}: {len(new_code)} chars")

    print("[2/6] Stopping n8n...")
    run("docker stop n8n-n8n-1")

    print("[3/6] Updating SQLite...")
    con = sqlite3.connect(DB, timeout=10)
    cur = con.cursor()
    cur.execute("PRAGMA wal_checkpoint(TRUNCATE)")

    # Find workflow by name instead of fixed ID just in case
    cur.execute("SELECT id, nodes, connections FROM workflow_entity WHERE name LIKE '%Maluco Bot v3%' LIMIT 1")
    row = cur.fetchone()
    if not row:
        print("Workflow not found!")
        sys.exit(1)
        
    wf_id = row[0]
    nodes_str = row[1]
    connections_str = row[2]
    
    nodes = json.loads(nodes_str)
    updated = 0
    for n in nodes:
        if n.get("name") in NODES_TO_UPDATE:
            n["parameters"]["jsCode"] = new_code
            updated += 1
    print(f"     nodes updated in workflow_entity: {updated}")

    if updated == 0:
        print("     No nodes updated. Aborting.")
        con.close()
        run("docker start n8n-n8n-1")
        sys.exit(0)

    new_vid = str(uuid.uuid4())
    nodes_json = json.dumps(nodes)
    
    # Update workflow_entity
    cur.execute("""UPDATE workflow_entity
        SET nodes=?, versionId=?, updatedAt=STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW')
        WHERE id=?""", (nodes_json, new_vid, wf_id))

    # Update workflow_history
    cur.execute("""UPDATE workflow_history
        SET nodes=?, connections=?, versionId=?, updatedAt=STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW')
        WHERE workflowId=?""", (nodes_json, connections_str, new_vid, wf_id))
    if cur.rowcount == 0:
        cur.execute("""INSERT INTO workflow_history (versionId, workflowId, authors, nodes, connections, name, autosaved)
            VALUES (?, ?, ?, ?, ?, ?, ?)""", (new_vid, wf_id, "system-deploy", nodes_json, connections_str, "Maluco Bot v3 (tool_use)", False))

    con.commit()
    cur.execute("PRAGMA wal_checkpoint(TRUNCATE)")
    con.close()

    print("[4/8] Starting n8n...")
    run("docker start n8n-n8n-1")
    run("chown 1000:1000 /var/lib/docker/volumes/n8n_data/_data/database.sqlite*")

    print("[5/8] Waiting for n8n ready...")
    time.sleep(5)

    print("[6/8] Republish via CLI...")
    run(f"docker exec n8n-n8n-1 n8n unpublish:workflow --id={wf_id}")
    run(f"docker exec n8n-n8n-1 n8n publish:workflow --id={wf_id}")

    print("[7/8] Final restart...")
    run("docker restart n8n-n8n-1")
    run("chown 1000:1000 /var/lib/docker/volumes/n8n_data/_data/database.sqlite*")
    
    print("[8/8] Deploy complete!")

if __name__ == "__main__":
    main()
