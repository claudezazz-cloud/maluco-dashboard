import subprocess
import json
import sys

# Read the new code
with open('agent_loop_found.js', 'r', encoding='utf-8') as f:
    new_code = f.read()

# Get the workflow from postgres
print("Fetching workflow from Postgres...")
cmd = ['docker', 'exec', 'n8n-postgres-1', 'psql', '-U', 'zazz', '-d', 'zazzdb', '-t', '-c', "SELECT id, name, nodes FROM workflow_entity WHERE name LIKE '%Maluco Bot v3%'"]
res = subprocess.run(cmd, capture_output=True, text=True)

if res.returncode != 0:
    print("Error fetching workflow:", res.stderr)
    sys.exit(1)

lines = res.stdout.strip().split('|')
if len(lines) < 3:
    print("Workflow not found or bad split")
    sys.exit(1)

wf_id = lines[0].strip()
wf_name = lines[1].strip()
nodes_json_raw = '|'.join(lines[2:]).strip()

try:
    nodes = json.loads(nodes_json_raw)
except Exception as e:
    print("Failed to parse nodes JSON:", e)
    sys.exit(1)

updated = False
for n in nodes:
    params = n.get('parameters', {})
    if 'jsCode' in params and 'gerar_relatorio_excel' in params['jsCode']:
        n['parameters']['jsCode'] = new_code
        updated = True
        print(f"Updated Node: {n['name']} in Workflow: {wf_name}")
        break

if updated:
    print("Updating workflow in Postgres...")
    new_nodes_json = json.dumps(nodes)
    new_nodes_escaped = new_nodes_json.replace("'", "''")
    update_cmd = ['docker', 'exec', 'n8n-postgres-1', 'psql', '-U', 'zazz', '-d', 'zazzdb', '-c', f"UPDATE workflow_entity SET nodes='{new_nodes_escaped}' WHERE id='{wf_id}'"]
    ures = subprocess.run(update_cmd, capture_output=True, text=True)
    if ures.returncode == 0:
        print("Successfully updated Postgres!")
    else:
        print("Update failed:", ures.stderr)
else:
    print("No nodes matched the criteria. Failed to update.")
