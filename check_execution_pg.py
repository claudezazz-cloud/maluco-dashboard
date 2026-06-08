import json
import subprocess

# Get V3 workflow ID
query1 = "SELECT id FROM workflow_entity WHERE name LIKE '%Maluco Bot v3%' LIMIT 1;"
res1 = subprocess.run(['docker', 'exec', 'n8n-postgres-1', 'psql', '-U', 'zazz', '-d', 'zazzdb', '-t', '-c', query1], capture_output=True, text=True)
wf_id = res1.stdout.strip()

# Get last execution data
query2 = f"SELECT data FROM execution_entity WHERE \"workflowId\" = '{wf_id}' ORDER BY id DESC LIMIT 1;"
res2 = subprocess.run(['docker', 'exec', 'n8n-postgres-1', 'psql', '-U', 'zazz', '-d', 'zazzdb', '-t', '-c', query2], capture_output=True, text=True)
data_str = res2.stdout.strip()

try:
    data = json.loads(data_str)
    # Find tool call from executarTool node
    runs = data['resultData']['runData']['executarTool']
    last_run = runs[-1]
    input_item = last_run['data']['main'][0][0]
    print(json.dumps(input_item, indent=2))
except Exception as e:
    print(f"Error parsing data: {e}")
    # print raw string truncated
    print(data_str[:1000])
