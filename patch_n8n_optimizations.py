#!/usr/bin/env python3
"""Patch no workflow para otimizar custos e consertar o modelo do Claude.

Modificações:
1. Monta Prompt / Monta Prompt Relatório: troca "claude-sonnet-4-6" por "claude-3-5-haiku-20241022" e corrige a injeção do cache.
2. Detecta Imagem: Verifica se houve menção ao bot. Se não houve, setta hasMention = false, pulando a chamada do Claude Vision.
3. Cria nó IF "Mencionou o Bot na Imagem?" antes de "Baixa Imagem".
"""
import json, time, urllib.request, urllib.error, uuid, sys, re
sys.stdout.reconfigure(encoding="utf-8")

API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkNDE5ZWU0MC0wMmFiLTQ1OGUtODMzMi1lN2E1OWEwYzRmMTAiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiOTQyYWFlZDctYTJkOS00MjJjLWE3OWMtZWMzNzQyMmViOWY4IiwiaWF0IjoxNzc0NzkyNzU2LCJleHAiOjE3NzczNDUyMDB9.bdrA_lXECtGYWsEqQB5FCn4CtZATdI2Mxu3LXQufStA"
BASE = "https://n8n.srv1537041.hstgr.cloud/api/v1/workflows/DiInHUnddtFACSmj"
H = {"X-N8N-API-KEY": API_KEY, "Content-Type": "application/json"}

def main():
    print("==> GET workflow...")
    wf = json.loads(urllib.request.urlopen(urllib.request.Request(BASE, headers=H)).read())

    detecta_pos = None
    imagem_preloaded_pos = None

    for n in wf["nodes"]:
        # Fix Model name in Monta Prompts
        if n["name"] in ["Monta Prompt", "Monta Prompt Relatório"]:
            code = n["parameters"].get("jsCode", "")
            code = code.replace('"claude-sonnet-4-6"', '"claude-3-5-haiku-20241022"')
            code = code.replace("'claude-sonnet-4-6'", "'claude-3-5-haiku-20241022'")
            n["parameters"]["jsCode"] = code
            print(f"  {n['name']}: corrigido modelo de IA")
        
        # Modify Detecta Imagem to evaluate mention
        if n["name"] == "Detecta Imagem":
            detecta_pos = n["position"]
            code = n["parameters"].get("jsCode", "")
            # Adiciona detecção de menção
            if "hasMention:" not in code:
                mention_logic = """
// Detecção de menção (para evitar gasto inútil de Vision API)
const botNumbers = ['554396543242', '235437994062039'];
const isMentionedJid = mentionedJid.some(jid => botNumbers.some(n => jid.includes(n)));
const txtLower = caption.toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');
const isMentionedText = botNumbers.some(n => caption.includes('@' + n) || caption.includes('@' + n.slice(2))) || txtLower.includes('maluco') || txtLower.includes('claude');
const isDirectMessage = eKey.remoteJid && !eKey.remoteJid.includes('@g.us');
const hasMention = isMentionedJid || isMentionedText || isDirectMessage;
"""
                # Insere antes do return
                code = code.replace("return [{", mention_logic + "\nreturn [{")
                code = code.replace("hasPreloaded: !!preloadedBase64", "hasPreloaded: !!preloadedBase64,\n    hasMention")
                n["parameters"]["jsCode"] = code
            print("  Detecta Imagem: adicionada verificação de menção")
            
        if n["name"] == "Imagem Preloaded?":
            imagem_preloaded_pos = n["position"]

    # Adiciona IF para checar Menção antes da pipeline Vision
    existe_if_mention = any(n["name"] == "Mencionou Bot Imagem?" for n in wf["nodes"])
    if not existe_if_mention and detecta_pos:
        if_pos = [imagem_preloaded_pos[0], imagem_preloaded_pos[1] - 150]
        
        wf["nodes"].append({
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
        print("  Nó 'Mencionou Bot Imagem?' adicionado")
        
        # Reconecta: Detecta Imagem -> Mencionou Bot Imagem? -> [True] Imagem Preloaded?
        # -> [False] Formata Imagem Padrão (Sem Vision)
        
        wf["nodes"].append({
            "id": str(uuid.uuid4()),
            "name": "Ignora Vision",
            "type": "n8n-nodes-base.code",
            "typeVersion": 2,
            "position": [if_pos[0] + 200, if_pos[1] + 200],
            "parameters": {
                "jsCode": "const det = $input.first().json;\nreturn [{ json: { chatId: det.chatId, messageId: det.messageId, dbMensagem: '🖼️ [imagem] ' + det.caption, dbRemetente: det.sender, isMentioned: false } }];"
            }
        })

        conns = wf["connections"]
        # Apaga conexão antiga de Detecta Imagem -> Imagem Preloaded
        conns["Detecta Imagem"] = {"main": [[{"node": "Mencionou Bot Imagem?", "type": "main", "index": 0}]]}
        conns["Mencionou Bot Imagem?"] = {"main": [
            [{"node": "Imagem Preloaded?", "type": "main", "index": 0}], # TRUE: Segue pro Vision
            [{"node": "Ignora Vision", "type": "main", "index": 0}]       # FALSE: Ignora
        ]}
        
        # Conecta o Ignora Vision direto no Salva Imagem (ou Salva Transcrição que na vdd a gente joga pro banco)
        if "Ignora Vision" not in conns:
            conns["Ignora Vision"] = {"main": [[{"node": "Salva Imagem", "type": "main", "index": 0}]]}

        print("  Conexões de Imagem atualizadas para pular Vision se não mencionado")

    # PUT Workflow
    allowed = ["id","name","type","typeVersion","position","parameters","credentials",
               "disabled","notes","notesInFlow","executeOnce","alwaysOutputData",
               "retryOnFail","maxTries","waitBetweenTries","continueOnFail","onError"]
    cleaned = [{k:v for k,v in n.items() if k in allowed} for n in wf["nodes"]]

    payload = json.dumps({
        "name": wf["name"], "nodes": cleaned,
        "connections": wf["connections"], "settings": wf.get("settings", {})
    }).encode()

    print(f"==> PUT ({len(payload)} bytes)...")
    try:
        res = json.loads(urllib.request.urlopen(
            urllib.request.Request(BASE, data=payload, method="PUT", headers=H)).read())
        print(f"    OK active={res.get('active')}")
    except urllib.error.HTTPError as e:
        print(f"    ERRO {e.code}: {e.read().decode()[:400]}"); sys.exit(1)

    print("==> deactivate+activate...")
    urllib.request.urlopen(urllib.request.Request(BASE+"/deactivate", data=b"{}", method="POST", headers=H)).read()
    time.sleep(1)
    urllib.request.urlopen(urllib.request.Request(BASE+"/activate", data=b"{}", method="POST", headers=H)).read()
    print("✓ Otimizações aplicadas com sucesso.")

if __name__ == "__main__":
    main()
