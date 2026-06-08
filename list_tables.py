import subprocess

print("--- POSTGRES TABLES ---")
res = subprocess.run(['docker', 'exec', 'n8n-postgres-1', 'psql', '-U', 'zazz', '-d', 'zazzdb', '-c', '\dt'], capture_output=True, text=True)
print(res.stdout)
print(res.stderr)

print("\n--- SQLITE TABLES ---")
res2 = subprocess.run(['sqlite3', '/var/lib/docker/volumes/n8n_data/_data/database.sqlite', '.tables'], capture_output=True, text=True)
print(res2.stdout)
print(res2.stderr)
