import sqlite3, json

DB = '/var/lib/docker/volumes/n8n_data/_data/database.sqlite'
con = sqlite3.connect(DB, timeout=5)
cur = con.cursor()

cur.execute("""
    SELECT id, startedAt, stoppedAt, status 
    FROM execution_entity 
    WHERE workflowId='Pj5SdaxFh9H9EIX4' 
    ORDER BY startedAt DESC LIMIT 3
""")
rows = cur.fetchall()
for r in rows:
    print(f"ID={r[0]} start={r[1]} stop={r[2]} status={r[3]}")

# Get the most recent execution data
if rows:
    eid = rows[0][0]
    cur.execute("SELECT executionData FROM execution_data WHERE executionId=?", (eid,))
    drow = cur.fetchone()
    if drow:
        data = json.loads(drow[0])
        run_data = data.get('resultData', {}).get('runData', {})
        claude_runs = run_data.get('Claude API', [])
        print(f"\nClaude API runs: {len(claude_runs)}")
        
        for i, cr in enumerate(claude_runs):
            out = cr.get('data', {}).get('main', [[]])[0]
            if not out:
                print(f"  Run {i}: no output")
                continue
            result = out[0].get('json', {})
            content = result.get('content', [])
            for block in content:
                if block.get('type') == 'text':
                    print(f"  Run {i} TEXT: {block['text'][:400]}")
                elif block.get('type') == 'tool_use':
                    inp = json.dumps(block.get('input', {}), ensure_ascii=False)
                    print(f"  Run {i} TOOL_USE: {block['name']}({inp[:400]})")
            
            # Check usage
            usage = result.get('usage', {})
            if usage:
                print(f"  Run {i} USAGE: in={usage.get('input_tokens',0)} out={usage.get('output_tokens',0)}")
    
    # Also check if there were errors
    if rows:
        eid = rows[0][0]
        cur.execute("SELECT executionData FROM execution_data WHERE executionId=?", (eid,))
        drow = cur.fetchone()
        if drow:
            data = json.loads(drow[0])
            last_node = data.get('resultData', {}).get('lastNodeExecuted', '')
            error = data.get('resultData', {}).get('error', None)
            print(f"\nLast node: {last_node}")
            if error:
                print(f"Error: {json.dumps(error, ensure_ascii=False)[:500]}")

con.close()
