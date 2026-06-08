import json
import subprocess

query = "SELECT data FROM execution_entity ORDER BY id DESC LIMIT 1;"
res = subprocess.run(['docker', 'exec', 'n8n-postgres-1', 'psql', '-U', 'zazz', '-d', 'zazzdb', '-t', '-c', query], capture_output=True, text=True)
data_str = res.stdout.strip()
try:
    data = json.loads(data_str)
    runs = data['resultData']['runData']['executarTool']
    tool_name = runs[-1]['data']['main'][0][0]['json']['tool_name']
    print("TOOL CALLED:", tool_name)
except Exception as e:
    print("Error:", e)
    with open('/tmp/err_data.txt', 'w') as f:
        f.write(data_str)
