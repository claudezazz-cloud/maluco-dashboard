#!/usr/bin/env python3
"""Patch no workflow pra aceitar imagens preloaded (enviadas pelo dashboard).

Modificações:
1. Detecta Imagem: extrai dashboardBase64/Mimetype de eImage e repassa como
   preloadedBase64/preloadedMimetype.
2. Adiciona nó IF 'Imagem Preloaded?' entre Detecta Imagem e Baixa Imagem.
3. Prepara Body Imagem: prioriza preloaded de Detecta Imagem.
4. Reconecta: Detecta Imagem -> Imagem Preloaded? -> [true] Prepara Body Imagem
                                                  -> [false] Baixa Imagem -> Prepara Body Imagem
"""
import json, time, urllib.request, urllib.error, uuid, sys
sys.stdout.reconfigure(encoding="utf-8")

API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkNDE5ZWU0MC0wMmFiLTQ1OGUtODMzMi1lN2E1OWEwYzRmMTAiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiOTQyYWFlZDctYTJkOS00MjJjLWE3OWMtZWMzNzQyMmViOWY4IiwiaWF0IjoxNzc0NzkyNzU2LCJleHAiOjE3NzczNDUyMDB9.bdrA_lXECtGYWsEqQB5FCn4CtZATdI2Mxu3LXQufStA"
BASE = "https://n8n.srv1537041.hstgr.cloud/api/v1/workflows/DiInHUnddtFACSmj"
H = {"X-N8N-API-KEY": API_KEY, "Content-Type": "application/json"}

DETECTA_IMAGEM_JS = """const body = $input.first().json.body || $input.first().json;
const eMsg = body.data?.message || {};
const eImage = eMsg.imageMessage;
if (!eImage) { return []; }

const msgTimestamp = Number(body.data?.messageTimestamp || 0);
const nowSec = Math.floor(Date.now() / 1000);
if (msgTimestamp > 0 && nowSec - msgTimestamp > 120) { return []; }

const eKey = body.data?.key || {};
const sender = body.data?.pushName || eKey.participant?.split('@')[0] || 'Desconhecido';
const caption = eImage.caption || '';
const mentionedJid = eImage.contextInfo?.mentionedJid || [];

// Dashboard: imagem pode vir pre-carregada em base64 (evita Baixa Imagem)
const preloadedBase64 = eImage.dashboardBase64 || '';
const preloadedMimetype = (eImage.dashboardMimetype || eImage.mimetype || 'image/jpeg').split(';')[0];

return [{
  json: {
    msgKey: { id: eKey.id, remoteJid: eKey.remoteJid, fromMe: eKey.fromMe || false },
    chatId: eKey.remoteJid,
    messageId: eKey.id,
    sender,
    caption,
    mentionedJid,
    preloadedBase64,
    preloadedMimetype,
    hasPreloaded: !!preloadedBase64
  }
}];
"""

PREPARA_BODY_JS = """const detecta = $('Detecta Imagem').first().json;
const upstream = $input.first().json || {};

// Prefere preloaded (dashboard) sobre Baixa Imagem
const base64 = detecta.preloadedBase64 || upstream.base64 || '';
const mimetype = (detecta.preloadedMimetype || upstream.mimetype || 'image/jpeg').split(';')[0];
const caption = detecta.caption || '';

const userPrompt = caption
  ? 'Legenda do usuário: "' + caption + '". Descreva a imagem considerando essa legenda.'
  : 'Descreva a imagem.';

const body = {
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 300,
  system: 'Você descreve imagens de um grupo de WhatsApp de técnicos de uma provedora de internet (Zazz). Descreva em 1-3 frases CURTAS o que aparece. Se houver texto legível (placa, documento, screenshot), transcreva entre aspas. Se for equipamento/infraestrutura de rede (OLT, ONU, poste, cabo, conector), identifique. Não use emojis. Apenas a descrição, sem preâmbulo.',
  messages: [{
    role: 'user',
    content: [
      { type: 'image', source: { type: 'base64', media_type: mimetype, data: base64 } },
      { type: 'text', text: userPrompt }
    ]
  }]
};

return [{ json: { body: JSON.stringify(body), base64, mimetype, caption } }];
"""


def main():
    print("==> GET workflow...")
    wf = json.loads(urllib.request.urlopen(urllib.request.Request(BASE, headers=H)).read())

    # 1. Atualiza Detecta Imagem e Prepara Body Imagem
    detecta_pos = None
    baixa_pos = None
    for n in wf["nodes"]:
        if n["name"] == "Detecta Imagem":
            n["parameters"]["jsCode"] = DETECTA_IMAGEM_JS
            detecta_pos = n["position"]
            print("  Detecta Imagem: atualizado")
        if n["name"] == "Prepara Body Imagem":
            n["parameters"]["jsCode"] = PREPARA_BODY_JS
            print("  Prepara Body Imagem: atualizado")
        if n["name"] == "Baixa Imagem":
            baixa_pos = n["position"]

    if not detecta_pos or not baixa_pos:
        print("ERRO: Detecta Imagem ou Baixa Imagem não encontrado"); sys.exit(1)

    # 2. Adiciona nó IF 'Imagem Preloaded?' se ainda não existe
    existe_if = any(n["name"] == "Imagem Preloaded?" for n in wf["nodes"])
    if not existe_if:
        if_pos = [detecta_pos[0] + 100, detecta_pos[1]]
        # Empurrar Baixa Imagem e downstream 100px
        for n in wf["nodes"]:
            if n["name"] in ["Baixa Imagem", "Prepara Body Imagem", "Descreve Imagem",
                             "Formata Imagem", "Salva Imagem", "Verifica Menção Imagem"]:
                n["position"][0] += 100

        wf["nodes"].append({
            "id": str(uuid.uuid4()),
            "name": "Imagem Preloaded?",
            "type": "n8n-nodes-base.if",
            "typeVersion": 2,
            "position": if_pos,
            "parameters": {
                "conditions": {
                    "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict"},
                    "conditions": [{
                        "id": str(uuid.uuid4()),
                        "leftValue": "={{ $json.hasPreloaded }}",
                        "rightValue": True,
                        "operator": {"type": "boolean", "operation": "true", "singleValue": True}
                    }],
                    "combinator": "and"
                },
                "options": {}
            }
        })
        print("  Nó 'Imagem Preloaded?' adicionado")
    else:
        print("  Nó 'Imagem Preloaded?' já existe — só atualizando conexões")

    # 3. Reconectar
    conns = wf["connections"]
    conns["Detecta Imagem"] = {"main": [[{"node": "Imagem Preloaded?", "type": "main", "index": 0}]]}
    conns["Imagem Preloaded?"] = {"main": [
        # true (preloaded) -> Prepara Body Imagem
        [{"node": "Prepara Body Imagem", "type": "main", "index": 0}],
        # false -> Baixa Imagem
        [{"node": "Baixa Imagem", "type": "main", "index": 0}]
    ]}
    conns["Baixa Imagem"] = {"main": [[{"node": "Prepara Body Imagem", "type": "main", "index": 0}]]}
    print("  Conexões atualizadas")

    # 4. PUT
    allowed = ["id","name","type","typeVersion","position","parameters","credentials",
               "disabled","notes","notesInFlow","executeOnce","alwaysOutputData",
               "retryOnFail","maxTries","waitBetweenTries","continueOnFail","onError"]
    cleaned = [{k:v for k,v in n.items() if k in allowed} for n in wf["nodes"]]

    payload = json.dumps({
        "name": wf["name"], "nodes": cleaned,
        "connections": wf["connections"], "settings": {}
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
    print("✓ Concluído")


if __name__ == "__main__":
    main()
