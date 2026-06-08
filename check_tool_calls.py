import sqlite3
import json

VOLUME = "/var/lib/docker/volumes/n8n_data/_data/database.sqlite"
con = sqlite3.connect(VOLUME)
cur = con.cursor()
cur.execute("SELECT data FROM execution_entity ORDER BY id DESC LIMIT 5")
rows = cur.fetchall()
for i, r in enumerate(rows):
    try:
        data = json.loads(r[0])
        # Find the execution data for "Claude API" node
        resultData = data.get("resultData", {})
        runData = resultData.get("runData", {})
        
        print(f"--- Execution {i} ---")
        if "Claude API" in runData:
            claude_runs = runData["Claude API"]
            for run in claude_runs:
                if "data" in run and "main" in run["data"]:
                    main_out = run["data"]["main"]
                    for item_list in main_out:
                        for item in item_list:
                            if item and "json" in item and "message" in item["json"]:
                                msg = item["json"]["message"]
                                if "content" in msg:
                                    print("LLM Content:")
                                    print(msg["content"])
                                if "tool_calls" in msg:
                                    print("Tool Calls:")
                                    print(msg["tool_calls"])
        print("\n")
    except Exception as e:
        print(f"Error parsing row {i}: {e}")
con.close()
