import json, sqlite3
VOLUME = "/var/lib/docker/volumes/n8n_data/_data/database.sqlite"
WF_ID = "Pj5SdaxFh9H9EIX4"
con = sqlite3.connect(VOLUME)
cur = con.cursor()
cur.execute("SELECT nodes FROM workflow_entity WHERE id=?", (WF_ID,))
row = cur.fetchone()
with open('/root/wf_v3.json', 'w') as f:
    f.write(row[0])
print("Dumped v3")
con.close()
