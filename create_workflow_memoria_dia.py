"""
create_workflow_memoria_dia.py

Cria o workflow N8N "Bot Memoria Dia" que:
- Roda a cada 30 minutos via Schedule Trigger
- Para cada chat ativo hoje (>= 3 mensagens), lê todas as mensagens do dia
- Chama Claude Haiku para extrair resumo estruturado em JSON
- Faz upsert na tabela bot_memoria_dia

Retry: o HTTP Request do Claude tem retryOnFail = 3x.
Output: imprime o ID do workflow criado (salvar em N8N_MEMORIA_DIA_WF_ID no .env do dashboard).
"""
import json, urllib.request, urllib.error, ssl, time, sys, io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

N8N_URL     = "https://n8n.srv1537041.hstgr.cloud"
API_KEY     = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkNDE5ZWU0MC0wMmFiLTQ1OGUtODMzMi1lN2E1OWEwYzRmMTAiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMDEzY2FkYmQtMmM4Yi00ZjZlLWFjYmQtOTY2ODI1MGUwZDcxIiwiaWF0IjoxNzc3MzgxNDEzfQ.tKyTjOHjsWaMBk0sonCHoXjupA5QErEEuqEj-ZSEY1s"
PG_CRED_ID  = "AErqeMtSVfS0MNsb"
CLAUDE_CRED = {"id": "5srt2WMs9eRq2HRa", "name": "YOUR_ANTHROPIC_API_KEY"}
ctx = ssl.create_default_context()
HEADERS = {"X-N8N-API-KEY": API_KEY, "Content-Type": "application/json"}


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


# ── Code node: Prepara Prompt Dia ──────────────────────────────────────────
PREPARA_PROMPT_CODE = r"""
// Lê chat_id e total do item atual (vindo de Por Chat)
const chatId    = $json.chat_id || '';
const totalEsperado = parseInt($json.total || 0);

// Lê mensagens do Postgres (node anterior em linha)
const msgs = $input.all().map(i => i.json).filter(m => m.remetente || m.mensagem);

if (msgs.length < 3) {
  // Poucas mensagens — não vale resumo, loop de volta
  return [];
}

const today = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().split('T')[0];

const historico = msgs.map(m => {
  let hora = '??:??';
  try {
    const d = new Date(new Date(m.data_hora).getTime() - 3 * 60 * 60 * 1000);
    hora = d.toISOString().substring(11, 16);
  } catch(e) {}
  return `[${hora}] ${m.remetente || 'Alguém'}: ${(m.mensagem || '').substring(0, 300)}`;
}).join('\n');

const prompt = `Você analisa mensagens de um grupo de trabalho de uma provedora de internet (Zazz Internet, fibra óptica).
Gere um resumo estruturado em JSON com EXATAMENTE estes campos:
- "resumo": string, parágrafo de 3-5 frases descrevendo o que aconteceu hoje
- "solicitacoes_abertas": array de objetos {cliente, descricao, hora} — serviços solicitados que NÃO foram resolvidos ainda
- "solicitacoes_resolvidas": array de objetos {cliente, descricao, hora, resolvido_por} — serviços concluídos
- "decisoes": array de strings com decisões importantes tomadas no grupo
- "pessoas_ativas": array de strings com nomes que participaram

Regras:
- Use APENAS as mensagens abaixo como fonte. Não invente dados.
- Se não houver solicitações, use array vazio [].
- Retorne APENAS o JSON válido, sem markdown, sem texto extra.

Mensagens do dia (chat: ${chatId}, ${msgs.length} mensagens):
${historico.substring(0, 24000)}`;

const claudeBody = {
  model: "claude-haiku-4-5-20251001",
  max_tokens: 1500,
  messages: [{ role: "user", content: prompt }]
};

return [{ json: { chatId, data: today, totalMsgs: msgs.length, claudeBody } }];
"""

# ── Code node: Parse Resumo Dia ─────────────────────────────────────────────
PARSE_RESUMO_CODE = r"""
const chatId     = $('Prepara Prompt Dia').first().json.chatId;
const data       = $('Prepara Prompt Dia').first().json.data;
const totalMsgs  = $('Prepara Prompt Dia').first().json.totalMsgs;

const raw = $input.first().json;
// Claude response: raw.content[0].text
const text = (raw.content && raw.content[0] && raw.content[0].text) ? raw.content[0].text : '';

let parsed = {};
try {
  // Remove possíveis blocos markdown antes do JSON
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  parsed = JSON.parse(cleaned);
} catch(e) {
  // Se Claude retornou JSON inválido, salva o texto bruto como resumo
  parsed = {
    resumo: text.substring(0, 1000) || 'Resumo não disponível.',
    solicitacoes_abertas: [],
    solicitacoes_resolvidas: [],
    decisoes: [],
    pessoas_ativas: []
  };
}

const resumo              = (parsed.resumo || '').substring(0, 2000);
const solicitacoes_abertas    = JSON.stringify(Array.isArray(parsed.solicitacoes_abertas) ? parsed.solicitacoes_abertas.slice(0,50) : []);
const solicitacoes_resolvidas = JSON.stringify(Array.isArray(parsed.solicitacoes_resolvidas) ? parsed.solicitacoes_resolvidas.slice(0,50) : []);
const decisoes            = JSON.stringify(Array.isArray(parsed.decisoes) ? parsed.decisoes.slice(0,20) : []);
const pessoas_ativas      = JSON.stringify(Array.isArray(parsed.pessoas_ativas) ? parsed.pessoas_ativas.slice(0,20) : []);

return [{ json: { chatId, data, totalMsgs, resumo, solicitacoes_abertas, solicitacoes_resolvidas, decisoes, pessoas_ativas } }];
"""

# ── Workflow definition ──────────────────────────────────────────────────────

PX = 300  # spacing horizontal

def pg_node(node_id, name, query_sql, position, execute_once=False, always_output=False):
    n = {
        "id": node_id, "name": name,
        "type": "n8n-nodes-base.postgres", "typeVersion": 2.5,
        "position": list(position),
        "parameters": {
            "operation": "executeQuery",
            "query": query_sql,
            "options": {"alwaysOutputData": always_output} if always_output else {},
        },
        "credentials": {"postgres": {"id": PG_CRED_ID, "name": "Postgres account"}},
    }
    if execute_once:
        n["executeOnce"] = True
    return n


WF_BODY = {
    "name": "Bot Memoria Dia",
    "nodes": [
        # 1. Schedule Trigger — a cada 30 min
        {
            "id": "schedule-dia", "name": "Agendamento 30min",
            "type": "n8n-nodes-base.scheduleTrigger", "typeVersion": 1.2,
            "position": [0, 0],
            "parameters": {
                "rule": {"interval": [{"field": "cronExpression", "expression": "*/30 * * * *"}]}
            },
        },
        # 2. Busca chats ativos hoje com >= 3 mensagens
        pg_node(
            "busca-chats", "Busca Chats Ativos",
            ("SELECT chat_id, COUNT(*) as total "
             "FROM mensagens "
             "WHERE data_hora >= (NOW() AT TIME ZONE 'America/Sao_Paulo')::date "
             "  AND chat_id IS NOT NULL AND chat_id <> '' "
             "GROUP BY chat_id "
             "HAVING COUNT(*) >= 3 "
             "ORDER BY total DESC "
             "LIMIT 30"),
            [PX, 0], execute_once=True
        ),
        # 3. Loop sobre cada chat
        {
            "id": "por-chat", "name": "Por Chat",
            "type": "n8n-nodes-base.splitInBatches", "typeVersion": 3,
            "position": [PX * 2, 0],
            "parameters": {"batchSize": 1, "options": {}},
        },
        # 4. Busca mensagens do chat atual hoje (LIMIT 200 → ~24k tokens input)
        pg_node(
            "busca-msgs", "Busca Mensagens Hoje",
            ("SELECT remetente, mensagem, data_hora "
             "FROM mensagens "
             "WHERE chat_id = '{{ $json.chat_id }}' "
             "  AND data_hora >= (NOW() AT TIME ZONE 'America/Sao_Paulo')::date "
             "ORDER BY data_hora ASC "
             "LIMIT 200"),
            [PX * 3, 0]
        ),
        # 5. Prepara prompt para Claude
        {
            "id": "prepara-prompt", "name": "Prepara Prompt Dia",
            "type": "n8n-nodes-base.code", "typeVersion": 2,
            "position": [PX * 4, 0],
            "parameters": {"mode": "runOnceForAllItems", "jsCode": PREPARA_PROMPT_CODE},
        },
        # 6. Claude Haiku — extrai resumo
        {
            "id": "claude-dia", "name": "Claude Extrai Resumo",
            "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.3,
            "position": [PX * 5, 0],
            "parameters": {
                "method": "POST",
                "url": "https://api.anthropic.com/v1/messages",
                "authentication": "genericCredentialType",
                "genericAuthType": "httpHeaderAuth",
                "sendHeaders": True,
                "headerParameters": {
                    "parameters": [
                        {"name": "anthropic-version", "value": "2023-06-01"},
                        {"name": "content-type",      "value": "application/json"},
                    ]
                },
                "sendBody": True,
                "specifyBody": "json",
                "jsonBody": "={{ JSON.stringify($json.claudeBody) }}",
                "options": {"timeout": 60000},
            },
            "credentials": {"httpHeaderAuth": CLAUDE_CRED},
            "retryOnFail": True,
            "maxTries": 3,
            "waitBetweenTries": 2000,
        },
        # 7. Parse resposta Claude
        {
            "id": "parse-resumo", "name": "Parse Resumo Dia",
            "type": "n8n-nodes-base.code", "typeVersion": 2,
            "position": [PX * 6, 0],
            "parameters": {"mode": "runOnceForAllItems", "jsCode": PARSE_RESUMO_CODE},
        },
        # 8. Upsert na tabela bot_memoria_dia
        pg_node(
            "salva-dia", "Salva Memoria Dia",
            ("INSERT INTO bot_memoria_dia "
             "(chat_id, data, resumo, total_mensagens, solicitacoes_abertas, solicitacoes_resolvidas, decisoes, pessoas_ativas, gerado_em) "
             "VALUES "
             "('{{ $json.chatId }}', '{{ $json.data }}'::date, '{{ $json.resumo.replace(/'/g, \"''\") }}', "
             "{{ $json.totalMsgs }}, '{{ $json.solicitacoes_abertas }}'::jsonb, '{{ $json.solicitacoes_resolvidas }}'::jsonb, "
             "'{{ $json.decisoes }}'::jsonb, '{{ $json.pessoas_ativas }}'::jsonb, NOW()) "
             "ON CONFLICT (chat_id, data) DO UPDATE SET "
             "  resumo = EXCLUDED.resumo, "
             "  total_mensagens = EXCLUDED.total_mensagens, "
             "  solicitacoes_abertas = EXCLUDED.solicitacoes_abertas, "
             "  solicitacoes_resolvidas = EXCLUDED.solicitacoes_resolvidas, "
             "  decisoes = EXCLUDED.decisoes, "
             "  pessoas_ativas = EXCLUDED.pessoas_ativas, "
             "  gerado_em = NOW()"),
            [PX * 7, 0]
        ),
    ],
    "connections": {
        "Agendamento 30min":  {"main": [[{"node": "Busca Chats Ativos",  "type": "main", "index": 0}]]},
        "Busca Chats Ativos": {"main": [[{"node": "Por Chat",            "type": "main", "index": 0}]]},
        # Por Chat output 0 → processa, output 1 → done (sem conexão = termina)
        "Por Chat": {"main": [
            [{"node": "Busca Mensagens Hoje", "type": "main", "index": 0}],
            [],  # done — sem próximo nó
        ]},
        "Busca Mensagens Hoje": {"main": [[{"node": "Prepara Prompt Dia",   "type": "main", "index": 0}]]},
        "Prepara Prompt Dia":   {"main": [[{"node": "Claude Extrai Resumo", "type": "main", "index": 0}]]},
        "Claude Extrai Resumo": {"main": [[{"node": "Parse Resumo Dia",     "type": "main", "index": 0}]]},
        "Parse Resumo Dia":     {"main": [[{"node": "Salva Memoria Dia",    "type": "main", "index": 0}]]},
        # Loop de volta para Por Chat (avança para próximo chat)
        "Salva Memoria Dia":    {"main": [[{"node": "Por Chat",             "type": "main", "index": 0}]]},
    },
    "settings": {
        "executionOrder": "v1",
        "saveManualExecutions": True,
        "callerPolicy": "workflowsFromSameOwner",
        "errorWorkflow": "",
    },
    "staticData": None,
}


def main():
    print("Verificando se workflow ja existe...")
    existing = req("GET", "/workflows?limit=100")
    for wf in existing.get("data", []):
        if wf.get("name") == "Bot Memoria Dia":
            print(f"  Ja existe: {wf['id']} — deletando para recriar...")
            try:
                req("POST", f"/workflows/{wf['id']}/deactivate")
            except:
                pass
            req("DELETE", f"/workflows/{wf['id']}")
            time.sleep(1)
            break

    print("Criando workflow Bot Memoria Dia...")
    created = req("POST", "/workflows", WF_BODY)
    wf_id = created["id"]
    print(f"  Criado: id = {wf_id}")

    print("Ativando...")
    req("POST", f"/workflows/{wf_id}/activate")
    print(f"  Ativo!")

    print()
    print("=" * 60)
    print(f"WORKFLOW ID: {wf_id}")
    print(f"Adicione no .env do dashboard:")
    print(f"  N8N_MEMORIA_DIA_WF_ID={wf_id}")
    print("=" * 60)
    print("Workflow roda automaticamente a cada 30 minutos.")


if __name__ == "__main__":
    main()
