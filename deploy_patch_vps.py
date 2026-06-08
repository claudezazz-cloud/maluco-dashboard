import sqlite3, json, uuid, subprocess, sys, time

DB = "/var/lib/docker/volumes/n8n_data/_data/database.sqlite"
WORKFLOW_ID = "DiInHUnddtFACSmj"

def run(cmd):
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if r.returncode != 0:
        print(f"[FAIL] {cmd}\n{r.stderr}", file=sys.stderr); sys.exit(1)
    return r.stdout

def main():
    print("[1] Stopping n8n...")
    run("docker stop n8n-n8n-1")

    con = sqlite3.connect(DB, timeout=10)
    cur = con.cursor()
    cur.execute("PRAGMA wal_checkpoint(TRUNCATE)")

    cur.execute("SELECT nodes, connections FROM workflow_entity WHERE id=?", (WORKFLOW_ID,))
    nodes_str, connections_str = cur.fetchone()
    wf_nodes = json.loads(nodes_str)
    wf_conns = json.loads(connections_str)

    # 1. Update Model names
    for n in wf_nodes:
        if n["name"] in ["Monta Prompt", "Monta Prompt Relatório"]:
            code = n["parameters"].get("jsCode", "")
            code = code.replace('"claude-sonnet-4-6"', '"claude-3-5-haiku-20241022"')
            code = code.replace("'claude-sonnet-4-6'", "'claude-3-5-haiku-20241022'")
            n["parameters"]["jsCode"] = code
        
        # 2. Add Mention detection in Detecta Imagem
        if n["name"] == "Detecta Imagem":
            detecta_pos = n["position"]
            code = n["parameters"].get("jsCode", "")
            if "hasMention:" not in code:
                mention_logic = """
// Detecção de menção (para evitar gasto inútil de Vision API)
const botNumbers = ['554396543242', '235437994062039'];
const txtLower = caption.toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');
const isMentionedText = botNumbers.some(n => caption.includes('@' + n) || caption.includes('@' + n.slice(2))) || txtLower.includes('maluco') || txtLower.includes('claude');
const isDirectMessage = eKey.remoteJid && !eKey.remoteJid.includes('@g.us');
const hasMention = isMentionedText || isDirectMessage;
"""
                code = code.replace("return [{", mention_logic + "\nreturn [{")
                code = code.replace("hasPreloaded: !!preloadedBase64", "hasPreloaded: !!preloadedBase64,\n    hasMention")
                n["parameters"]["jsCode"] = code
            
        if n["name"] == "Imagem Preloaded?":
            imagem_preloaded_pos = n["position"]

    # 3. Add node if not exists
    existe_if_mention = any(n["name"] == "Mencionou Bot Imagem?" for n in wf_nodes)
    if not existe_if_mention and 'imagem_preloaded_pos' in locals():
        if_pos = [imagem_preloaded_pos[0], imagem_preloaded_pos[1] - 150]
        
        wf_nodes.append({
            "id": str(uuid.uuid4()),
            "name": "Mencionou Bot Imagem?",
            "type": "n8n-nodes-base.if",
            "typeVersion": 2,
            "position": if_pos,
            "parameters": {
                "conditions": {
                    "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict"},
                    "conditions": [{
                        "id": str(uuid.uuid4()),
                        "leftValue": "={{ $json.hasMention }}",
                        "rightValue": True,
                        "operator": {"type": "boolean", "operation": "true", "singleValue": True}
                    }],
                    "combinator": "and"
                },
                "options": {}
            }
        })
        
        wf_nodes.append({
            "id": str(uuid.uuid4()),
            "name": "Ignora Vision",
            "type": "n8n-nodes-base.code",
            "typeVersion": 2,
            "position": [if_pos[0] + 200, if_pos[1] + 200],
            "parameters": {
                "jsCode": "const det = $input.first().json;\nreturn [{ json: { chatId: det.chatId, messageId: det.messageId, dbMensagem: '🖼️ [imagem] ' + det.caption, dbRemetente: det.sender, isMentioned: false } }];"
            }
        })

        wf_conns["Detecta Imagem"] = {"main": [[{"node": "Mencionou Bot Imagem?", "type": "main", "index": 0}]]}
        wf_conns["Mencionou Bot Imagem?"] = {"main": [
            [{"node": "Imagem Preloaded?", "type": "main", "index": 0}],
            [{"node": "Ignora Vision", "type": "main", "index": 0}]
        ]}
        wf_conns["Ignora Vision"] = {"main": [[{"node": "Salva Imagem", "type": "main", "index": 0}]]}

    new_vid = str(uuid.uuid4())
    nodes_json = json.dumps(wf_nodes)
    conns_json = json.dumps(wf_conns)
    
    cur.execute("UPDATE workflow_entity SET nodes=?, connections=?, versionId=?, updatedAt=STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW') WHERE id=?", (nodes_json, conns_json, new_vid, WORKFLOW_ID))
    cur.execute("UPDATE workflow_history SET nodes=?, connections=?, versionId=?, updatedAt=STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW') WHERE workflowId=?", (nodes_json, conns_json, new_vid, WORKFLOW_ID))
    if cur.rowcount == 0:
        cur.execute("INSERT INTO workflow_history (versionId, workflowId, authors, nodes, connections, name, autosaved) VALUES (?, ?, ?, ?, ?, ?, ?)", (new_vid, WORKFLOW_ID, "system-deploy", nodes_json, conns_json, "Maluco Bot v7", False))
    
    con.commit()
    cur.execute("PRAGMA wal_checkpoint(TRUNCATE)")
    con.close()

    print("[2] Starting n8n...")
    run("docker start n8n-n8n-1")
    run("chown 1000:1000 /var/lib/docker/volumes/n8n_data/_data/database.sqlite*")
    print("Wait 5s for boot...")
    time.sleep(5)
    
    print("[3] Republishing workflow...")
    run(f"docker exec n8n-n8n-1 n8n unpublish:workflow --id={WORKFLOW_ID}")
    run(f"docker exec n8n-n8n-1 n8n publish:workflow --id={WORKFLOW_ID}")
    
    print("[4] Final restart...")
    run("docker restart n8n-n8n-1")
    print("DONE")

if __name__ == '__main__':
    main()
