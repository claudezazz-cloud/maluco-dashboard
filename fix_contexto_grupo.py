"""
fix_contexto_grupo.py

1. Cria POP "LEIA SEMPRE" com regras críticas de formatação e remetente
2. Atualiza "Verifica Menção": extrai quoted message (mensagem citada/reply)
   e inclui no retorno como `quotedText`
3. Atualiza "Monta Prompt":
   - Usa quotedText quando textMessage está vazio (@menção sem texto)
   - Remove trava que matava o fluxo em menções sem texto
   - Inclui quotedText como contexto na mensagem do usuário para o Claude
"""
import json, time, urllib.request, urllib.error, ssl, uuid, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

N8N_URL     = "https://n8n.srv1537041.hstgr.cloud"
N8N_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkNDE5ZWU0MC0wMmFiLTQ1OGUtODMzMi1lN2E1OWEwYzRmMTAiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMDEzY2FkYmQtMmM4Yi00ZjZlLWFjYmQtOTY2ODI1MGUwZDcxIiwiaWF0IjoxNzc3MzgxNDEzfQ.tKyTjOHjsWaMBk0sonCHoXjupA5QErEEuqEj-ZSEY1s"
WORKFLOW_ID = "DiInHUnddtFACSmj"
PG_CRED_ID  = "AErqeMtSVfS0MNsb"
ctx = ssl.create_default_context()

HEADERS = {"X-N8N-API-KEY": N8N_API_KEY, "Content-Type": "application/json"}
ALLOWED = {"name", "nodes", "connections", "settings", "staticData"}
ALLOWED_SETTINGS = {
    "executionOrder","saveManualExecutions","callerPolicy",
    "errorWorkflow","timezone","saveDataSuccessExecution",
    "saveDataErrorExecution","saveExecutionProgress"
}

POP_LEIA_SEMPRE = """REGRAS ABSOLUTAS DE FORMATAÇÃO (WhatsApp):
- NUNCA use ##, ###, ====, ---- ou qualquer marcação de título/cabeçalho Markdown
- Negrito: *texto* (somente asterisco simples)
- Itálico: _texto_
- Listas: use - ou 1. 2. 3.
- Blocos de código: PROIBIDOS
- NUNCA use ** (dois asteriscos) — WhatsApp não renderiza

REGRA DE REMETENTE:
- Ao identificar quem enviou uma mensagem, use SEMPRE o campo Remetente exatamente como aparece no histórico: [HH:MM] Remetente: mensagem
- NUNCA confunda o remetente com nomes citados dentro do texto da mensagem
- Exemplo: se a linha diz "[09:30] Franquelin: o Russo foi lá", quem enviou foi Franquelin, não Russo

CONTEXTO DO GRUPO:
- Quando alguém te mencionar sem escrever nada, olhe as últimas mensagens do grupo para entender o que estava sendo discutido
- Use o histórico recente para responder com contexto, sem pedir para a pessoa repetir o que disse"""


def req(method, path, body=None):
    url  = f"{N8N_URL}/api/v1{path}"
    data = json.dumps(body, ensure_ascii=False).encode("utf-8") if body else None
    r    = urllib.request.Request(url, data=data, headers=HEADERS, method=method)
    try:
        with urllib.request.urlopen(r, context=ctx, timeout=30) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        print(f"HTTP {e.code}: {e.read().decode()[:500]}")
        raise

def get_wf():
    return req("GET", f"/workflows/{WORKFLOW_ID}")

def put_wf(wf):
    body = {k: v for k, v in wf.items() if k in ALLOWED}
    if "settings" in body:
        body["settings"] = {k: v for k, v in body["settings"].items() if k in ALLOWED_SETTINGS}
    return req("PUT", f"/workflows/{WORKFLOW_ID}", body)

def deactivate():
    try: req("POST", f"/workflows/{WORKFLOW_ID}/deactivate")
    except: pass

def activate():
    time.sleep(1)
    req("POST", f"/workflows/{WORKFLOW_ID}/activate")

def find_node(nodes, name):
    return next((n for n in nodes if n.get("name") == name), None)


# ─────────────────────────────────────────────
# PASSO 1: Cria POP "LEIA SEMPRE" via wf temp
# ─────────────────────────────────────────────

def create_pop_leia_sempre():
    print("\n[1] Criando POP LEIA SEMPRE...")
    pop_escaped = POP_LEIA_SEMPRE.replace("'", "''")
    sql = (
        f"INSERT INTO dashboard_pops (titulo, categoria, conteudo, prioridade, ativo) "
        f"SELECT 'LEIA SEMPRE: Formatação e Remetente', 'Regras', '{pop_escaped}', 'sempre', true "
        f"WHERE NOT EXISTS (SELECT 1 FROM dashboard_pops WHERE titulo = 'LEIA SEMPRE: Formatação e Remetente')"
    )

    webhook_path = f"pop-leia-{uuid.uuid4().hex[:8]}"
    js_code = "const sql = " + json.dumps(sql, ensure_ascii=False) + ";\nreturn [{ json: { sql } }];\n"

    wf_body = {
        "name": f"TEMP POP LEIA SEMPRE {webhook_path}",
        "nodes": [
            {
                "id": "trig", "name": "Webhook",
                "type": "n8n-nodes-base.webhook", "typeVersion": 2,
                "position": [0, 0],
                "parameters": {"httpMethod": "GET", "path": webhook_path, "responseMode": "lastNode"},
                "webhookId": webhook_path,
            },
            {
                "id": "code", "name": "Build SQL",
                "type": "n8n-nodes-base.code", "typeVersion": 2,
                "position": [300, 0],
                "parameters": {"mode": "runOnceForAllItems", "jsCode": js_code},
            },
            {
                "id": "pg", "name": "Insert POP",
                "type": "n8n-nodes-base.postgres", "typeVersion": 2.5,
                "position": [600, 0],
                "parameters": {"operation": "executeQuery", "query": "={{ $json.sql }}", "options": {}},
                "credentials": {"postgres": {"id": PG_CRED_ID, "name": "Postgres account"}},
            },
        ],
        "connections": {
            "Webhook": {"main": [[{"node": "Build SQL", "type": "main", "index": 0}]]},
            "Build SQL": {"main": [[{"node": "Insert POP", "type": "main", "index": 0}]]},
        },
        "settings": {"executionOrder": "v1"},
    }

    created = req("POST", "/workflows", wf_body)
    wf_id = created["id"]
    try:
        req("POST", f"/workflows/{wf_id}/activate")
        time.sleep(2)
        r = urllib.request.Request(f"{N8N_URL}/webhook/{webhook_path}", method="GET")
        with urllib.request.urlopen(r, context=ctx, timeout=60) as resp:
            out = resp.read().decode("utf-8")
            print(f"  OK: {out[:100]}")
    finally:
        try: req("POST", f"/workflows/{wf_id}/deactivate")
        except: pass
        try: req("DELETE", f"/workflows/{wf_id}")
        except: pass


# ─────────────────────────────────────────────
# PASSO 2 & 3: Atualiza nodes do workflow
# ─────────────────────────────────────────────

def update_workflow_nodes():
    print("\n[2] Buscando workflow principal...")
    wf = get_wf()
    nodes = wf.get("nodes", [])

    # ── Verifica Menção ──
    vm = find_node(nodes, "Verifica Menção")
    if not vm:
        print("  ERRO: Verifica Menção não encontrado!")
        return False

    code_vm = vm["parameters"]["jsCode"]

    OLD_VM_RETURN = 'return [{ json: { chatId, textMessage, isReport, isTraining, reportType, isSkillCommand, skillName, skillArgs } }];'
    NEW_VM_RETURN = r"""// Extrai contexto de mensagem citada (quoted/reply)
const ctxInfoV = eMsg.extendedTextMessage?.contextInfo || eMsg.imageMessage?.contextInfo || eMsg.audioMessage?.contextInfo || {};
const quotedMsgV = ctxInfoV.quotedMessage;
let quotedText = '';
if (quotedMsgV) {
  quotedText = (quotedMsgV.conversation || quotedMsgV.extendedTextMessage?.text || quotedMsgV.imageMessage?.caption || '').substring(0, 500);
}

return [{ json: { chatId, textMessage, quotedText, isReport, isTraining, reportType, isSkillCommand, skillName, skillArgs } }];"""

    if OLD_VM_RETURN in code_vm:
        vm["parameters"]["jsCode"] = code_vm.replace(OLD_VM_RETURN, NEW_VM_RETURN)
        print("  ✅ Verifica Menção: quoted text adicionado")
    elif "quotedText" in code_vm:
        print("  ℹ️  Verifica Menção: já tem quotedText — pulando")
    else:
        print("  ⚠️  Verifica Menção: marcador não encontrado, pulando")

    # ── Monta Prompt ──
    mp = find_node(nodes, "Monta Prompt")
    if not mp:
        print("  ERRO: Monta Prompt não encontrado!")
        return False

    code_mp = mp["parameters"]["jsCode"]
    changed = False

    # 2a. Adiciona leitura de quotedText após textMessage
    OLD_TXT = "const textMessage = _vM_early.textMessage || '';"
    NEW_TXT = """const textMessage = _vM_early.textMessage || '';
const quotedText = _vM_early.quotedText || '';"""
    if OLD_TXT in code_mp and "quotedText" not in code_mp:
        code_mp = code_mp.replace(OLD_TXT, NEW_TXT)
        changed = True
        print("  ✅ Monta Prompt: quotedText lido de Verifica Menção")

    # 2b. POP scoring usa textMessage || quotedText
    OLD_PALAVRAS = "const msgPalavras = [...new Set(normaliza(textMessage).split(/\\s+/).filter(w => w.length > 2 && !stopwords.includes(w)))];"
    NEW_PALAVRAS = "const msgPalavras = [...new Set(normaliza(textMessage || quotedText).split(/\\s+/).filter(w => w.length > 2 && !stopwords.includes(w)))];"
    if OLD_PALAVRAS in code_mp:
        code_mp = code_mp.replace(OLD_PALAVRAS, NEW_PALAVRAS)
        changed = True
        print("  ✅ Monta Prompt: POP scoring usa quoted quando textMessage vazio")

    # 2c. Trava mais flexível
    OLD_TRAVA = "// 11. TRAVA FINAL\nif (!textMessage) return [];"
    NEW_TRAVA = """// 11. TRAVA FINAL - permite @menção sem texto se houver contexto
const userMsg = textMessage || (quotedText ? '[respondendo à mensagem: "' + quotedText + '"]' : '[mencionou o bot]');
if (!textMessage && !quotedText && !historicoSection) return [];"""
    if OLD_TRAVA in code_mp:
        code_mp = code_mp.replace(OLD_TRAVA, NEW_TRAVA)
        changed = True
        print("  ✅ Monta Prompt: trava relaxada + userMsg construído")

    # 2d. Claude user content usa userMsg em vez de textMessage
    OLD_USER_CONTENT = '{ role: "user", content: ((_vM_early.allImages && _vM_early.allImages.length) ? [ { type: "text", text: textMessage }, ..._vM_early.allImages.map(i => ({ type: "image", source: { type: "base64", media_type: i.mimetype, data: i.base64 } })) ] : (_vM_early.imageBase64 ? [ { type: "text", text: textMessage }, { type: "image", source: { type: "base64", media_type: _vM_early.imageMimetype, data: _vM_early.imageBase64 } } ] : textMessage)) }'
    NEW_USER_CONTENT = '{ role: "user", content: ((_vM_early.allImages && _vM_early.allImages.length) ? [ { type: "text", text: userMsg }, ..._vM_early.allImages.map(i => ({ type: "image", source: { type: "base64", media_type: i.mimetype, data: i.base64 } })) ] : (_vM_early.imageBase64 ? [ { type: "text", text: userMsg }, { type: "image", source: { type: "base64", media_type: _vM_early.imageMimetype, data: _vM_early.imageBase64 } } ] : userMsg)) }'
    if OLD_USER_CONTENT in code_mp:
        code_mp = code_mp.replace(OLD_USER_CONTENT, NEW_USER_CONTENT)
        changed = True
        print("  ✅ Monta Prompt: mensagem do usuário usa userMsg com fallback")

    # 2e. mensagemUsuario no output também usa userMsg
    OLD_MSG_USUARIO = "mensagemUsuario: textMessage,"
    NEW_MSG_USUARIO = "mensagemUsuario: userMsg,"
    if OLD_MSG_USUARIO in code_mp:
        code_mp = code_mp.replace(OLD_MSG_USUARIO, NEW_MSG_USUARIO)
        changed = True
        print("  ✅ Monta Prompt: mensagemUsuario usa userMsg")

    if changed:
        mp["parameters"]["jsCode"] = code_mp
    else:
        if "quotedText" in code_mp:
            print("  ℹ️  Monta Prompt: já atualizado — pulando")
        else:
            print("  ⚠️  Monta Prompt: nenhum marcador encontrado — verifique manualmente")

    wf["nodes"] = nodes
    return wf


def main():
    # Passo 1: POP LEIA SEMPRE
    create_pop_leia_sempre()

    # Passo 2 & 3: Workflow
    wf = update_workflow_nodes()
    if not wf:
        print("ABORTANDO — erro nos nodes")
        return

    print("\n[3] Desativando workflow...")
    deactivate()
    print("[4] Enviando workflow corrigido...")
    put_wf(wf)
    print("[5] Reativando workflow...")
    activate()

    print("\n✅ Concluído!")
    print("   - POP 'LEIA SEMPRE: Formatação e Remetente' criado (prioridade=sempre)")
    print("   - Verifica Menção: extrai quoted message de replies")
    print("   - Monta Prompt: usa quoted quando @menção sem texto, trava relaxada")


if __name__ == "__main__":
    main()
