import sqlite3
import json

VOLUME = "/var/lib/docker/volumes/n8n_data/_data/database.sqlite"
con = sqlite3.connect(VOLUME)
cur = con.cursor()
cur.execute("SELECT data FROM execution_entity ORDER BY id DESC LIMIT 10")
rows = cur.fetchall()
for r in rows:
    try:
        data = json.loads(r[0])
        # search for tool usage
        s = str(data)
        if "gerar_relatorio" in s:
            print("FOUND EXECUTION WITH TOOL")
            # Let's extract the LLM's thought or tool call
            # This is complex, just print a snippet
            idx = s.find("gerar_relatorio")
            print(s[max(0, idx-100):min(len(s), idx+100)])
            print("-----")
    except Exception as e:
        print(e)
con.close()
