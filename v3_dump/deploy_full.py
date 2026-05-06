#!/usr/bin/env python3
"""Deploy completo: Monta Prompt + Monta Prompt Relatório + Claude API + sysprompt"""
import sqlite3, json, uuid, subprocess, sys, time

DB = "/var/lib/docker/volumes/n8n_data/_data/database.sqlite"
WORKFLOW_ID = "Pj5SdaxFh9H9EIX4"
MP_FILE = "/opt/zazz/dashboard/v3_dump/Monta_Prompt.js"
AL_FILE = "/opt/zazz/dashboard/v3_dump/agent_loop_code.js"
SYS_FILE = "/opt/zazz/dashboard/v3_dump/sysprompt_v3.txt"

def run(cmd):
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if r.returncode != 0:
        print(f"[FAIL] {cmd}\n{r.stderr}", file=sys.stderr); sys.exit(1)
    return r.stdout

# 1. Atualizar sysprompt no postgres
print("[1/8] Updating sysprompt in postgres...")
with open(SYS_FILE) as f:
    sysprompt = f.read()
escaped = sysprompt.replace("'", "''")
sql = f"UPDATE dashboard_config SET valor = '{escaped}' WHERE chave = 'system_prompt'; SELECT length(valor) FROM dashboard_config WHERE chave='system_prompt';"
r = subprocess.run(['docker', 'exec', '-i', 'n8n-postgres-1', 'psql', '-U', 'zazz', '-d', 'zazzdb'],
    input=sql.encode(), capture_output=True, timeout=30)
print(r.stdout.decode()[:300])

# 2. Stop n8n
print("[2/8] Stopping n8n...")
run("docker stop n8n-n8n-1")

# 3. Update SQLite (3 nodes)
print("[3/8] Updating SQLite...")
with open(MP_FILE) as f: mp_code = f.read()
with open(AL_FILE) as f: al_code = f.read()
print(f"     Monta_Prompt.js: {len(mp_code)} chars")
print(f"     agent_loop_code.js: {len(al_code)} chars")

con = sqlite3.connect(DB, timeout=10)
cur = con.cursor()
cur.execute("PRAGMA wal_checkpoint(TRUNCATE)")
print(f"     pre-checkpoint: {cur.fetchone()}")

cur.execute("SELECT nodes, connections FROM workflow_entity WHERE id=?", (WORKFLOW_ID,))
nodes_str, connections_str = cur.fetchone()
nodes = json.loads(nodes_str)
updated = []
for n in nodes:
    if n.get("name") in ("Monta Prompt", "Monta Prompt Relatório"):
        n["parameters"]["jsCode"] = mp_code
        updated.append(n["name"])
    elif n.get("name") == "Claude API":
        n["parameters"]["jsCode"] = al_code
        updated.append(n["name"])
print(f"     nodes updated: {updated}")

new_vid = str(uuid.uuid4())
nodes_json = json.dumps(nodes)
cur.execute("""UPDATE workflow_entity
    SET nodes=?, versionId=?, updatedAt=STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW')
    WHERE id=?""", (nodes_json, new_vid, WORKFLOW_ID))

cur.execute("""UPDATE workflow_history
    SET nodes=?, connections=?, versionId=?, updatedAt=STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW')
    WHERE workflowId=?""", (nodes_json, connections_str, new_vid, WORKFLOW_ID))
print(f"     workflow_history updated: {cur.rowcount}")

con.commit()
cur.execute("PRAGMA wal_checkpoint(TRUNCATE)")
print(f"     post-checkpoint: {cur.fetchone()}")
con.close()

# 4. Start n8n
print("[4/8] Starting n8n...")
run("docker start n8n-n8n-1")
run("chown 1000:1000 /var/lib/docker/volumes/n8n_data/_data/database.sqlite*")

# 5. Wait
print("[5/8] Waiting for n8n ready...")
for _ in range(30):
    r = subprocess.run("docker logs n8n-n8n-1 --tail 30 2>&1 | grep -c 'Maluco Bot v3'",
                      shell=True, capture_output=True, text=True)
    if int(r.stdout.strip() or 0) > 0:
        print("     n8n ready"); break
    time.sleep(1)

# 6. Republish via CLI
print("[6/8] Republish via CLI...")
run(f"docker exec n8n-n8n-1 n8n unpublish:workflow --id={WORKFLOW_ID}")
run(f"docker exec n8n-n8n-1 n8n publish:workflow --id={WORKFLOW_ID}")

# 7. Final restart
print("[7/8] Final restart...")
run("docker restart n8n-n8n-1")
run("chown 1000:1000 /var/lib/docker/volumes/n8n_data/_data/database.sqlite*")
for _ in range(30):
    r = subprocess.run("docker logs n8n-n8n-1 --tail 10 2>&1 | grep -c 'Maluco Bot v3'",
                      shell=True, capture_output=True, text=True)
    if int(r.stdout.strip() or 0) > 0:
        print("     n8n ready"); break
    time.sleep(1)

print("[8/8] Deploy complete!")
