#!/usr/bin/env python3
"""
Adiciona 6 nós para reconhecimento de imagens (Claude Vision) ao workflow:
  Detecta Imagem -> Baixa Imagem -> Descreve Imagem -> Formata Imagem
                                                       -> Salva Imagem
                                                       -> Verifica Menção Imagem -> É Treinamento?

Também modifica Monta Prompt e Parse Resposta para ler do fluxo de imagem.

Referência: C:\\Users\\franq\\.claude\\plans\\adaptive-wibbling-jellyfish.md
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

ANTHROPIC_CRED_ID = "5srt2WMs9eRq2HRa"
ANTHROPIC_CRED_NAME = "YOUR_ANTHROPIC_API_KEY"
POSTGRES_CRED_ID = "AErqeMtSVfS0MNsb"
POSTGRES_CRED_NAME = "Postgres account"
EVOLUTION_APIKEY = "KGWUTIl4uXDVxFiJMhFgT1LzP8bHRcze"


def short_id():
    return str(uuid.uuid4())


# ============ Código dos Code nodes ============

DETECTA_IMAGEM_JS = """const body = $input.first().json;
const b = body.body || {};
const eData = b.data || b || {};
const eMsg = eData.message || {};
const eImage = eMsg.imageMessage;
if (!eImage) return [];

const msgTimestamp = eData.messageTimestamp || 0;
const nowTimestamp = Math.floor(Date.now() / 1000);
if (msgTimestamp && (nowTimestamp - msgTimestamp) > 120) return [];

const eMsgId = eData.key?.id || '';
const eChat = eData.key?.remoteJid || '';
const fromMe = eData.key?.fromMe || false;
const eSender = eData.pushName || 'Alguém';
const caption = eImage.caption || '';

return [{ json: { msgKey: { id: eMsgId, remoteJid: eChat, fromMe }, chatId: eChat, sender: eSender, messageId: eMsgId, caption } }];
"""

FORMATA_IMAGEM_JS = """const detecta = $('Detecta Imagem').first().json;
const baixa = $('Baixa Imagem').first().json;
const descResp = $input.first().json;
const description = descResp.content?.[0]?.text?.trim() || '(imagem sem descrição)';
const caption = detecta.caption || '';

const combined = caption
  ? caption + ' [descrição automática: ' + description + ']'
  : description;

const botNumbers = ['554396543242', '235437994062039'];
const captionLower = caption.toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');
const isMentionedText = botNumbers.some(n => caption.includes('@' + n) || caption.includes('@' + n.slice(2)));
const isMentionedName = captionLower.includes('maluco') || captionLower.includes('claude');
const isDirectMessage = detecta.chatId && !detecta.chatId.includes('@g.us');
const isMentioned = isMentionedText || isMentionedName || isDirectMessage;

const isReportMensal = captionLower.includes('mensal') || captionLower.includes('mes');
const isReportSemanal = !isReportMensal && (captionLower.includes('semanal') || captionLower.includes('semana'));
const isReport = captionLower.includes('relatorio') || captionLower.includes('resumo');
const reportType = isReportMensal ? 'mensal' : isReportSemanal ? 'semanal' : 'diario';
const isTraining = captionLower.includes('claude aprenda') || captionLower.includes('claude correcao');

return [{
  json: {
    chatId: detecta.chatId,
    textMessage: combined,
    dbRemetente: detecta.sender + ' 🖼️',
    dbMensagem: ('🖼️ ' + combined).substring(0, 1950),
    messageId: detecta.messageId,
    isReport, isTraining, reportType, isMentioned,
    imageBase64: baixa.base64 || '',
    imageMimetype: (baixa.mimetype || 'image/jpeg').split(';')[0]
  }
}];
"""

# Body JSON para o node "Descreve Imagem" — Claude Vision
DESCREVE_IMAGEM_BODY_EXPR = (
    "={{ JSON.stringify({"
    "model: 'claude-haiku-4-5-20251001',"
    "max_tokens: 300,"
    "system: 'Você descreve imagens de um grupo de WhatsApp de técnicos de uma provedora de internet (Zazz). Descreva em 1-3 frases CURTAS o que aparece. Se houver texto legível (placa, documento, screenshot), transcreva entre aspas. Se for equipamento/infraestrutura de rede (OLT, ONU, poste, cabo, conector), identifique. Não use emojis. Apenas a descrição, sem preâmbulo.',"
    "messages: [{role: 'user', content: ["
    "{type: 'image', source: {type: 'base64', media_type: ($json.mimetype || 'image/jpeg').split(';')[0], data: $json.base64}},"
    "{type: 'text', text: ($('Detecta Imagem').first().json.caption ? 'Legenda do usuário: \"' + $('Detecta Imagem').first().json.caption + '\". Descreva a imagem considerando essa legenda.' : 'Descreva a imagem.')}"
    "]}]"
    "}) }}"
)

SALVA_IMAGEM_QUERY_EXPR = (
    "={{ `INSERT INTO mensagens (message_id, remetente, mensagem, chat_id, tipo_atendimento) "
    "VALUES ('${$json.messageId}', '${$json.dbRemetente.replace(/'/g, \"''\")}', "
    "'${$json.dbMensagem.substring(0,2000).replace(/'/g, \"''\")}', "
    "'${($json.chatId || '').replace(/'/g, \"''\")}', NULL) "
    "ON CONFLICT (message_id) DO UPDATE SET mensagem = EXCLUDED.mensagem, remetente = EXCLUDED.remetente` }}"
)


# ============ Definição dos 6 novos nós ============

def build_new_nodes():
    # Posições na Y=9400 (linha dedicada pra imagem, abaixo do áudio em 9152)
    X_START = 10832
    Y = 9400
    STEP = 200

    return [
        {
            "id": short_id(),
            "name": "Detecta Imagem",
            "type": "n8n-nodes-base.code",
            "typeVersion": 2,
            "position": [X_START, Y],
            "parameters": {"jsCode": DETECTA_IMAGEM_JS}
        },
        {
            "id": short_id(),
            "name": "Baixa Imagem",
            "type": "n8n-nodes-base.httpRequest",
            "typeVersion": 4.3,
            "position": [X_START + STEP, Y],
            "parameters": {
                "method": "POST",
                "url": "https://lanlunar-evolution.cloudfy.live/chat/getBase64FromMediaMessage/ZazzClaude",
                "sendHeaders": True,
                "headerParameters": {"parameters": [{"name": "apikey", "value": EVOLUTION_APIKEY}]},
                "sendBody": True,
                "specifyBody": "json",
                "jsonBody": "={{ JSON.stringify({ message: { key: $json.msgKey }, convertToMp4: false }) }}",
                "options": {}
            }
        },
        {
            "id": short_id(),
            "name": "Descreve Imagem",
            "type": "n8n-nodes-base.httpRequest",
            "typeVersion": 4.3,
            "position": [X_START + STEP * 2, Y],
            "credentials": {"httpHeaderAuth": {"id": ANTHROPIC_CRED_ID, "name": ANTHROPIC_CRED_NAME}},
            "parameters": {
                "method": "POST",
                "url": "https://api.anthropic.com/v1/messages",
                "authentication": "genericCredentialType",
                "genericAuthType": "httpHeaderAuth",
                "sendHeaders": True,
                "headerParameters": {"parameters": [
                    {"name": "anthropic-version", "value": "2023-06-01"},
                    {"name": "content-type", "value": "application/json"}
                ]},
                "sendBody": True,
                "specifyBody": "json",
                "jsonBody": DESCREVE_IMAGEM_BODY_EXPR,
                "options": {}
            }
        },
        {
            "id": short_id(),
            "name": "Formata Imagem",
            "type": "n8n-nodes-base.code",
            "typeVersion": 2,
            "position": [X_START + STEP * 3, Y],
            "parameters": {"jsCode": FORMATA_IMAGEM_JS}
        },
        {
            "id": short_id(),
            "name": "Salva Imagem",
            "type": "n8n-nodes-base.postgres",
            "typeVersion": 2.4,
            "position": [X_START + STEP * 4, Y],
            "credentials": {"postgres": {"id": POSTGRES_CRED_ID, "name": POSTGRES_CRED_NAME}},
            "parameters": {
                "operation": "executeQuery",
                "query": SALVA_IMAGEM_QUERY_EXPR,
                "options": {}
            }
        },
        {
            "id": short_id(),
            "name": "Verifica Menção Imagem",
            "type": "n8n-nodes-base.if",
            "typeVersion": 2.3,
            "position": [X_START + STEP * 5, Y],
            "parameters": {
                "conditions": {
                    "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "loose", "version": 2},
                    "conditions": [{
                        "id": "img-mention-chk",
                        "leftValue": "={{ $json.isMentioned }}",
                        "rightValue": True,
                        "operator": {"type": "boolean", "operation": "equals"}
                    }],
                    "combinator": "and"
                },
                "looseTypeValidation": True,
                "options": {}
            }
        }
    ]


# ============ Modificações em Monta Prompt e Parse Resposta ============

def patch_monta_prompt(code):
    # 1) Adicionar fallback para Formata Imagem
    old1 = (
        "let _vM_early;\n"
        "try { _vM_early = $('Verifica Menção').first().json; if (!_vM_early.chatId) _vM_early = null; } catch(e) {}\n"
        "if (!_vM_early) try { _vM_early = $('Formata Transcrição').first().json; } catch(e) { _vM_early = {}; }"
    )
    new1 = (
        "let _vM_early;\n"
        "try { _vM_early = $('Verifica Menção').first().json; if (!_vM_early.chatId) _vM_early = null; } catch(e) {}\n"
        "if (!_vM_early) try { _vM_early = $('Formata Transcrição').first().json; if (!_vM_early.chatId) _vM_early = null; } catch(e) {}\n"
        "if (!_vM_early) try { _vM_early = $('Formata Imagem').first().json; } catch(e) { _vM_early = {}; }"
    )
    if old1 not in code:
        raise RuntimeError("Monta Prompt: bloco de fallback _vM_early não encontrado")
    code = code.replace(old1, new1)

    # 2) Modificar o return para suportar imagem no content do Claude
    old2 = (
        "      messages: [\n"
        "        ...redisHistory.slice(-20),\n"
        "        { role: \"user\", content: textMessage }\n"
        "      ]"
    )
    new2 = (
        "      messages: [\n"
        "        ...redisHistory.slice(-20),\n"
        "        { role: \"user\", content: (_vM_early.imageBase64 ? [ { type: \"text\", text: textMessage }, { type: \"image\", source: { type: \"base64\", media_type: _vM_early.imageMimetype, data: _vM_early.imageBase64 } } ] : textMessage) }\n"
        "      ]"
    )
    if old2 not in code:
        raise RuntimeError("Monta Prompt: bloco messages[] do return não encontrado")
    code = code.replace(old2, new2)
    return code


def patch_parse_resposta(code):
    # 1) _vME (bloco de erro) - adicionar fallback
    old1 = "let _vME; try { _vME = $('Verifica Menção').first().json; } catch(e) { _vME = {}; }"
    new1 = (
        "let _vME; try { _vME = $('Verifica Menção').first().json; if (!_vME.chatId) _vME = null; } catch(e) {}\n"
        "  if (!_vME) try { _vME = $('Formata Transcrição').first().json; if (!_vME.chatId) _vME = null; } catch(e) {}\n"
        "  if (!_vME) try { _vME = $('Formata Imagem').first().json; } catch(e) { _vME = {}; }"
    )
    if old1 not in code:
        raise RuntimeError("Parse Resposta: bloco _vME não encontrado")
    code = code.replace(old1, new1)

    # 2) _vM principal - adicionar fallback Formata Imagem
    old2 = (
        "let _vM; try { _vM = $('Verifica Menção').first().json; if (!_vM.chatId) _vM = null; } catch(e) {}\n"
        "if (!_vM) try { _vM = $('Formata Transcrição').first().json; } catch(e) { _vM = {}; }"
    )
    new2 = (
        "let _vM; try { _vM = $('Verifica Menção').first().json; if (!_vM.chatId) _vM = null; } catch(e) {}\n"
        "if (!_vM) try { _vM = $('Formata Transcrição').first().json; if (!_vM.chatId) _vM = null; } catch(e) {}\n"
        "if (!_vM) try { _vM = $('Formata Imagem').first().json; } catch(e) { _vM = {}; }"
    )
    if old2 not in code:
        raise RuntimeError("Parse Resposta: bloco _vM não encontrado")
    code = code.replace(old2, new2)

    # 3) _msgUsr - adicionar Formata Imagem
    old3 = "let _msgUsr = ''; try { _msgUsr = $('Verifica Menção').first().json?.textMessage || $('Formata Transcrição').first().json?.textMessage || ''; } catch(e) {}"
    new3 = "let _msgUsr = ''; try { _msgUsr = $('Verifica Menção').first().json?.textMessage || $('Formata Transcrição').first().json?.textMessage || $('Formata Imagem').first().json?.textMessage || ''; } catch(e) {}"
    if old3 not in code:
        raise RuntimeError("Parse Resposta: bloco _msgUsr não encontrado")
    code = code.replace(old3, new3)
    return code


# ============ Main ============

def main():
    print("==> GET workflow atual...")
    req = urllib.request.Request(BASE, headers=HEADERS)
    with urllib.request.urlopen(req) as resp:
        wf = json.loads(resp.read())

    existing_names = {n["name"] for n in wf["nodes"]}

    # 1) Evitar duplicar se rodar o script 2x
    if any(n in existing_names for n in ["Detecta Imagem", "Baixa Imagem", "Descreve Imagem",
                                          "Formata Imagem", "Salva Imagem", "Verifica Menção Imagem"]):
        print("ERRO: já existe algum nó de imagem no workflow. Abortando para evitar duplicata.")
        sys.exit(1)

    # 2) Adicionar os 6 nós
    new_nodes = build_new_nodes()
    wf["nodes"].extend(new_nodes)
    print(f"==> {len(new_nodes)} nós novos adicionados")

    # 3) Patch Monta Prompt
    for n in wf["nodes"]:
        if n["name"] == "Monta Prompt":
            n["parameters"]["jsCode"] = patch_monta_prompt(n["parameters"]["jsCode"])
            print("==> Monta Prompt: jsCode atualizado")
            break

    # 4) Patch Parse Resposta
    for n in wf["nodes"]:
        if n["name"] == "Parse Resposta":
            n["parameters"]["jsCode"] = patch_parse_resposta(n["parameters"]["jsCode"])
            print("==> Parse Resposta: jsCode atualizado")
            break

    # 5) Adicionar conexões
    conns = wf["connections"]
    # Filter1 → Detecta Imagem (adicionar ao array existente)
    filter1_targets = conns["Filter1"]["main"][0]
    filter1_targets.append({"node": "Detecta Imagem", "type": "main", "index": 0})

    conns["Detecta Imagem"] = {"main": [[{"node": "Baixa Imagem", "type": "main", "index": 0}]]}
    conns["Baixa Imagem"] = {"main": [[{"node": "Descreve Imagem", "type": "main", "index": 0}]]}
    conns["Descreve Imagem"] = {"main": [[{"node": "Formata Imagem", "type": "main", "index": 0}]]}
    conns["Formata Imagem"] = {"main": [[
        {"node": "Salva Imagem", "type": "main", "index": 0},
        {"node": "Verifica Menção Imagem", "type": "main", "index": 0}
    ]]}
    conns["Verifica Menção Imagem"] = {"main": [[{"node": "É Treinamento?", "type": "main", "index": 0}]]}
    print("==> Conexões adicionadas")

    # 6) PUT
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

    print(f"==> PUT workflow ({len(payload)} bytes)...")
    req2 = urllib.request.Request(BASE, data=payload, method="PUT", headers=HEADERS)
    try:
        with urllib.request.urlopen(req2) as resp2:
            result = json.loads(resp2.read())
            print(f"    DEPLOYED: {result.get('name')} | Active: {result.get('active')}")
    except urllib.error.HTTPError as e:
        print(f"    ERROR: {e.code} {e.read().decode()[:500]}")
        sys.exit(1)

    # 7) Deactivate + Activate — OBRIGATÓRIO por causa do cache do task runner
    print("==> Desativando workflow...")
    r = urllib.request.Request(BASE + "/deactivate", data=b"{}", method="POST", headers=HEADERS)
    with urllib.request.urlopen(r) as x:
        print(f"    active = {json.loads(x.read()).get('active')}")
    time.sleep(1)
    print("==> Reativando workflow...")
    r = urllib.request.Request(BASE + "/activate", data=b"{}", method="POST", headers=HEADERS)
    with urllib.request.urlopen(r) as x:
        print(f"    active = {json.loads(x.read()).get('active')}")

    print("\n✓ Deploy concluído.")
    print("Próximo passo: mandar uma imagem no grupo e consultar 'SELECT mensagem FROM mensagens ORDER BY id DESC LIMIT 3' no Postgres.")


if __name__ == "__main__":
    main()
