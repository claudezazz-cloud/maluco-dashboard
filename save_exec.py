import subprocess

query = "SELECT data FROM execution_entity ORDER BY id DESC LIMIT 1;"
res = subprocess.run(['docker', 'exec', 'n8n-postgres-1', 'psql', '-U', 'zazz', '-d', 'zazzdb', '-t', '-c', query], capture_output=True, text=True)
with open("/tmp/last_exec.json", "w") as f:
    f.write(res.stdout)
print("Data written to /tmp/last_exec.json")
