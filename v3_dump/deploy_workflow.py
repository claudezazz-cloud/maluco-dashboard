#!/usr/bin/env python3
"""
Deploy padrão para o workflow Maluco Bot v3 (tool_use):
- Atualiza Monta Prompt + Monta Prompt Relatório com o mesmo Monta_Prompt.js
- Atualiza workflow_entity (draft) e workflow_history (publicada — n8n carrega daqui!)
- Faz stop/start do n8n com PRAGMA wal_checkpoint(TRUNCATE) antes/depois
- Sai 0 se sucesso, 1 se erro

Uso: python3 deploy_workflow.py
Pré-requisito: /opt/zazz/dashboard/v3_dump/Monta_Prompt.js tem que estar atualizado.
"""
import sqlite3, json, uuid, subprocess, sys, time

DB = "/var/lib/docker/volumes/n8n_data/_data/database.sqlite"
MP_FILE = "/opt/zazz/dashboard/v3_dump/Monta_Prompt.js"
WORKFLOW_ID = "Pj5SdaxFh9H9EIX4"
NODES_TO_UPDATE = ("Monta Prompt", "Monta Prompt Relatório")

def run(cmd):
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if r.returncode != 0:
        print(f"[FAIL] {cmd}\n{r.stderr}", file=sys.stderr); sys.exit(1)
    return r.stdout

def main():
    # 1. Read new code
    with open(MP_FILE) as f:
        new_code = f.read()
    print(f"[1/6] Loaded {MP_FILE}: {len(new_code)} chars")
    if "todosOsPops" not in new_code:
        print("[FAIL] new code missing 'todosOsPops' marker — aborting", file=sys.stderr); sys.exit(1)

    # 2. Stop n8n
    print("[2/6] Stopping n8n...")
    run("docker stop n8n-n8n-1")

    # 3. Update SQLite (workflow_entity + workflow_history)
    print("[3/6] Updating SQLite...")
    con = sqlite3.connect(DB, timeout=10)
    cur = con.cursor()
    cur.execute("PRAGMA wal_checkpoint(TRUNCATE)")
    print(f"     pre-checkpoint: {cur.fetchone()}")

    cur.execute("SELECT nodes, connections FROM workflow_entity WHERE id=?", (WORKFLOW_ID,))
    nodes_str, connections_str = cur.fetchone()
    nodes = json.loads(nodes_str)
    updated = 0
    for n in nodes:
        if n.get("name") in NODES_TO_UPDATE:
            n["parameters"]["jsCode"] = new_code
            updated += 1
    print(f"     nodes updated in workflow_entity: {updated}")

    new_vid = str(uuid.uuid4())
    nodes_json = json.dumps(nodes)
    cur.execute("""UPDATE workflow_entity
        SET nodes=?, versionId=?, updatedAt=STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW')
        WHERE id=?""", (nodes_json, new_vid, WORKFLOW_ID))

    # CRITICAL: also update workflow_history — n8n loads from here!
    cur.execute("""UPDATE workflow_history
        SET nodes=?, connections=?, versionId=?, updatedAt=STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW')
        WHERE workflowId=?""", (nodes_json, connections_str, new_vid, WORKFLOW_ID))
    if cur.rowcount == 0:
        cur.execute("""INSERT INTO workflow_history (versionId, workflowId, authors, nodes, connections, name, autosaved)
            VALUES (?, ?, ?, ?, ?, ?, ?)""", (new_vid, WORKFLOW_ID, "system-deploy", nodes_json, connections_str, "Maluco Bot v3 (tool_use)", False))
        print("     inserted new workflow_history row")
    else:
        print(f"     updated {cur.rowcount} workflow_history row(s)")

    con.commit()
    cur.execute("PRAGMA wal_checkpoint(TRUNCATE)")
    print(f"     post-checkpoint: {cur.fetchone()}")
    cur.execute("SELECT versionId FROM workflow_entity WHERE id=?", (WORKFLOW_ID,))
    print(f"     final versionId: {cur.fetchone()[0]}")
    con.close()

    # 4. Start n8n
    print("[4/8] Starting n8n...")
    run("docker start n8n-n8n-1")
    run("chown 1000:1000 /var/lib/docker/volumes/n8n_data/_data/database.sqlite*")

    # 5. Wait for ready
    print("[5/8] Waiting for n8n ready...")
    for _ in range(30):
        r = subprocess.run("docker logs n8n-n8n-1 --tail 30 2>&1 | grep -c 'Maluco Bot v3'",
                          shell=True, capture_output=True, text=True)
        if int(r.stdout.strip() or 0) > 0:
            print("     n8n ready")
            break
        time.sleep(1)
    else:
        print("[WARN] n8n didn't show 'Maluco Bot v3' in logs after 30s")

    # 6. Republish via CLI to sync workflow_published_version
    # SEM ISSO o webhook responde 404 "Active version not found"
    print("[6/8] Republish via CLI...")
    run(f"docker exec n8n-n8n-1 n8n unpublish:workflow --id={WORKFLOW_ID}")
    run(f"docker exec n8n-n8n-1 n8n publish:workflow --id={WORKFLOW_ID}")

    # 7. Final restart to pick up republish
    print("[7/8] Final restart...")
    run("docker restart n8n-n8n-1")
    run("chown 1000:1000 /var/lib/docker/volumes/n8n_data/_data/database.sqlite*")
    for _ in range(30):
        r = subprocess.run("docker logs n8n-n8n-1 --tail 10 2>&1 | grep -c 'Maluco Bot v3'",
                          shell=True, capture_output=True, text=True)
        if int(r.stdout.strip() or 0) > 0:
            print("     n8n ready")
            break
        time.sleep(1)

    # 8. Done
    print("[8/8] Deploy complete!")

if __name__ == "__main__":
    main()
