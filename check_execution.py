import json
import sqlite3

VOLUME = "/var/lib/docker/volumes/n8n_data/_data/database.sqlite"
con = sqlite3.connect(VOLUME)
con.row_factory = sqlite3.Row
cur = con.cursor()

# Get the workflow ID for V3
cur.execute("SELECT id FROM workflow_entity WHERE name LIKE '%Maluco Bot v3%'")
row = cur.fetchone()
wf_id = row['id']

# Get the last execution for this workflow
cur.execute("SELECT data FROM execution_entity WHERE workflowId = ? ORDER BY id DESC LIMIT 1", (wf_id,))
row = cur.fetchone()
data = json.loads(row['data'])

try:
    # Find Claude API node execution data
    claude_data = data['resultData']['runData']['Claude API']
    # The last run of Claude API
    last_run = claude_data[-1]
    
    # Get the input to the code node that processes the tool
    code_input = data['resultData']['runData']['executarTool'][-1]['data']['main'][0][0]
    print(json.dumps(code_input, indent=2))
except Exception as e:
    print(f"Error extracting data: {e}")
