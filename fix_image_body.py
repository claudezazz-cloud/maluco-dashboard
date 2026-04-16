#!/usr/bin/env python3
"""
Fix: substitui a expressão inline complexa no nó 'Descreve Imagem' por um nó Code
'Prepara Body Imagem' que constrói o JSON antes do HTTP.

Fluxo novo:
  Baixa Imagem -> Prepara Body Imagem -> Descreve Imagem -> Formata Imagem
"""
import json
import time
import urllib.request
import urllib.error
import uuid
import sys

sys.stdout.reconfigure(encoding="utf-8")

API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkNDE5ZWU0MC0wMmFiLTQ1OGUtODMzMi1lN2E1OWEwYzRmMTAiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiOTQyYWFlZDctYTJkOS00MjJjLWE3OWMtZWMzNzQyMmViOWY4IiwiaWF0IjoxNzc0NzkyNzU2LCJleHAiOjE3NzczNDUyMDB9.bdrA_lXECtGYWsEqQB5FCn4CtZATdI2Mxu3LXQufStA"
BASE = "https://n8n.srv1537041.hstgr.cloud/api/v1/workflows/DiInHUnddtFACSmj"
HEADERS = {"X-N8N-API-KEY": API_KEY, "Content-Type": "application/json"}

PREPARA_BODY_JS = """const baixa = $input.first().json;
const detecta = $('Detecta Imagem').first().json;

const base64 = baixa.base64 || '';
const mimetype = (baixa.mimetype || 'image/jpeg').split(';')[0];
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
    req = urllib.request.Request(BASE, headers=HEADERS)
    wf = json.loads(urllib.request.urlopen(req).read())

    # Posição do "Baixa Imagem" para calcular a do nó novo
    baixa_pos = None
    descreve_pos = None
    for n in wf["nodes"]:
        if n["name"] == "Baixa Imagem":
            baixa_pos = n["position"]
        if n["name"] == "Descreve Imagem":
            descreve_pos = n["position"]

    if not baixa_pos or not descreve_pos:
        print("ERRO: nós Baixa Imagem ou Descreve Imagem não encontrados")
        sys.exit(1)

    # Inserir Prepara Body Imagem entre os dois (deslocando Descreve Imagem e downstream)
    prepara_pos = [baixa_pos[0] + 100, baixa_pos[1]]
    # Empurrar Descreve Imagem 100px pra direita pra não sobrepor
    for n in wf["nodes"]:
        if n["name"] in ["Descreve Imagem", "Formata Imagem", "Salva Imagem", "Verifica Menção Imagem"]:
            n["position"][0] += 100

    # Evitar duplicata
    if any(n["name"] == "Prepara Body Imagem" for n in wf["nodes"]):
        print("ERRO: Prepara Body Imagem já existe. Abortando.")
        sys.exit(1)

    # Adicionar nó Prepara Body Imagem
    wf["nodes"].append({
        "id": str(uuid.uuid4()),
        "name": "Prepara Body Imagem",
        "type": "n8n-nodes-base.code",
        "typeVersion": 2,
        "position": prepara_pos,
        "parameters": {"jsCode": PREPARA_BODY_JS}
    })
    print("==> Nó 'Prepara Body Imagem' adicionado")

    # Simplificar o jsonBody do Descreve Imagem
    for n in wf["nodes"]:
        if n["name"] == "Descreve Imagem":
            n["parameters"]["jsonBody"] = "={{ $json.body }}"
            print("==> Descreve Imagem: jsonBody simplificado para $json.body")
            break

    # Reconectar: Baixa Imagem -> Prepara Body Imagem -> Descreve Imagem
    conns = wf["connections"]
    conns["Baixa Imagem"] = {"main": [[{"node": "Prepara Body Imagem", "type": "main", "index": 0}]]}
    conns["Prepara Body Imagem"] = {"main": [[{"node": "Descreve Imagem", "type": "main", "index": 0}]]}
    print("==> Conexões ajustadas")

    # PUT
    allowed = ["id", "name", "type", "typeVersion", "position", "parameters",
               "credentials", "disabled", "notes", "notesInFlow", "executeOnce",
               "alwaysOutputData", "retryOnFail", "maxTries", "waitBetweenTries",
               "continueOnFail", "onError"]
    cleaned = [{k: v for k, v in n.items() if k in allowed} for n in wf["nodes"]]

    payload = json.dumps({
        "name": wf["name"],
        "nodes": cleaned,
        "connections": wf["connections"],
        "settings": {}
    }).encode()

    print(f"==> PUT ({len(payload)} bytes)...")
    req2 = urllib.request.Request(BASE, data=payload, method="PUT", headers=HEADERS)
    try:
        with urllib.request.urlopen(req2) as resp2:
            result = json.loads(resp2.read())
            print(f"    DEPLOYED: active={result.get('active')}")
    except urllib.error.HTTPError as e:
        print(f"    ERROR: {e.code} {e.read().decode()[:500]}")
        sys.exit(1)

    # Deactivate + Activate
    print("==> Reload do workflow (deactivate + activate)...")
    urllib.request.urlopen(urllib.request.Request(
        BASE + "/deactivate", data=b"{}", method="POST", headers=HEADERS
    )).read()
    time.sleep(1)
    urllib.request.urlopen(urllib.request.Request(
        BASE + "/activate", data=b"{}", method="POST", headers=HEADERS
    )).read()
    print("✓ Concluído.")


if __name__ == "__main__":
    main()
