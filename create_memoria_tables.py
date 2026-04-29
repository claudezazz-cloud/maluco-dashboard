"""
create_memoria_tables.py — Cria tabelas bot_memoria_dia e bot_memoria_longa via workflow N8N temporário.
"""
import json, urllib.request, urllib.error, ssl, time, uuid

N8N_URL    = "https://n8n.srv1537041.hstgr.cloud"
API_KEY    = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkNDE5ZWU0MC0wMmFiLTQ1OGUtODMzMi1lN2E1OWEwYzRmMTAiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMDEzY2FkYmQtMmM4Yi00ZjZlLWFjYmQtOTY2ODI1MGUwZDcxIiwiaWF0IjoxNzc3MzgxNDEzfQ.tKyTjOHjsWaMBk0sonCHoXjupA5QErEEuqEj-ZSEY1s"
PG_CRED_ID = "AErqeMtSVfS0MNsb"
ctx = ssl.create_default_context()
HEADERS = {"X-N8N-API-KEY": API_KEY, "Content-Type": "application/json"}

DDL = """
CREATE TABLE IF NOT EXISTS bot_memoria_dia (
  id SERIAL PRIMARY KEY,
  chat_id VARCHAR(100) NOT NULL,
  data DATE NOT NULL,
  resumo TEXT NOT NULL DEFAULT '',
  total_mensagens INT DEFAULT 0,
  solicitacoes_abertas JSONB DEFAULT '[]',
  solicitacoes_resolvidas JSONB DEFAULT '[]',
  decisoes JSONB DEFAULT '[]',
  pessoas_ativas JSONB DEFAULT '[]',
  gerado_em TIMESTAMP DEFAULT NOW(),
  UNIQUE(chat_id, data)
);
CREATE INDEX IF NOT EXISTS idx_memoria_dia_chat_data ON bot_memoria_dia(chat_id, data DESC);

CREATE TABLE IF NOT EXISTS bot_memoria_longa (
  id SERIAL PRIMARY KEY,
  entidade_tipo VARCHAR(30) NOT NULL,
  entidade_id VARCHAR(100) NOT NULL,
  fato TEXT NOT NULL,
  categoria VARCHAR(50),
  peso INT DEFAULT 5,
  ocorrencias INT DEFAULT 1,
  fonte_message_ids JSONB DEFAULT '[]',
  primeira_ocorrencia TIMESTAMP DEFAULT NOW(),
  ultima_ocorrencia TIMESTAMP DEFAULT NOW(),
  ativo BOOLEAN DEFAULT true,
  validado_por VARCHAR(100),
  CONSTRAINT unique_fato UNIQUE(entidade_tipo, entidade_id, fato)
);
CREATE INDEX IF NOT EXISTS idx_memoria_longa_entidade
  ON bot_memoria_longa(entidade_tipo, entidade_id) WHERE ativo = true;

CREATE TABLE IF NOT EXISTS bot_memoria_longa (id int) ON CONFLICT DO NOTHING
"""

# Clean DDL — remove the last broken line, it was a typo placeholder
DDL_CLEAN = """
CREATE TABLE IF NOT EXISTS bot_memoria_dia (
  id SERIAL PRIMARY KEY,
  chat_id VARCHAR(100) NOT NULL,
  data DATE NOT NULL,
  resumo TEXT NOT NULL DEFAULT '',
  total_mensagens INT DEFAULT 0,
  solicitacoes_abertas JSONB DEFAULT '[]',
  solicitacoes_resolvidas JSONB DEFAULT '[]',
  decisoes JSONB DEFAULT '[]',
  pessoas_ativas JSONB DEFAULT '[]',
  gerado_em TIMESTAMP DEFAULT NOW(),
  UNIQUE(chat_id, data)
);
CREATE INDEX IF NOT EXISTS idx_memoria_dia_chat_data ON bot_memoria_dia(chat_id, data DESC);
CREATE TABLE IF NOT EXISTS bot_memoria_longa (
  id SERIAL PRIMARY KEY,
  entidade_tipo VARCHAR(30) NOT NULL,
  entidade_id VARCHAR(100) NOT NULL,
  fato TEXT NOT NULL,
  categoria VARCHAR(50),
  peso INT DEFAULT 5,
  ocorrencias INT DEFAULT 1,
  fonte_message_ids JSONB DEFAULT '[]',
  primeira_ocorrencia TIMESTAMP DEFAULT NOW(),
  ultima_ocorrencia TIMESTAMP DEFAULT NOW(),
  ativo BOOLEAN DEFAULT true,
  validado_por VARCHAR(100),
  CONSTRAINT unique_fato UNIQUE(entidade_tipo, entidade_id, fato)
);
CREATE INDEX IF NOT EXISTS idx_memoria_longa_entidade
  ON bot_memoria_longa(entidade_tipo, entidade_id) WHERE ativo = true
"""


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


def main():
    webhook_path = f"create-memoria-{uuid.uuid4().hex[:8]}"
    ddl_escaped  = DDL_CLEAN.replace("'", "''").replace("\\", "\\\\")
    js_code = (
        "const sql = " + json.dumps(DDL_CLEAN, ensure_ascii=False) + ";\n"
        "return [{ json: { sql } }];\n"
    )

    wf_body = {
        "name": f"TEMP Create Memoria Tables {webhook_path}",
        "nodes": [
            {
                "id": "trig", "name": "Webhook",
                "type": "n8n-nodes-base.webhook", "typeVersion": 2,
                "position": [0, 0],
                "parameters": {
                    "httpMethod": "GET", "path": webhook_path,
                    "responseMode": "lastNode",
                },
                "webhookId": webhook_path,
            },
            {
                "id": "code", "name": "DDL",
                "type": "n8n-nodes-base.code", "typeVersion": 2,
                "position": [300, 0],
                "parameters": {"mode": "runOnceForAllItems", "jsCode": js_code},
            },
            {
                "id": "pg", "name": "Create Tables",
                "type": "n8n-nodes-base.postgres", "typeVersion": 2.5,
                "position": [600, 0],
                "parameters": {
                    "operation": "executeQuery",
                    "query": "={{ $json.sql }}",
                    "options": {},
                },
                "credentials": {"postgres": {"id": PG_CRED_ID, "name": "Postgres account"}},
            },
        ],
        "connections": {
            "Webhook": {"main": [[{"node": "DDL", "type": "main", "index": 0}]]},
            "DDL":     {"main": [[{"node": "Create Tables", "type": "main", "index": 0}]]},
        },
        "settings": {"executionOrder": "v1"},
    }

    print("Criando workflow temporario...")
    created = req("POST", "/workflows", wf_body)
    wf_id   = created["id"]
    print(f"  id: {wf_id}")

    try:
        req("POST", f"/workflows/{wf_id}/activate")
        time.sleep(2)
        r = urllib.request.Request(f"{N8N_URL}/webhook/{webhook_path}", method="GET")
        with urllib.request.urlopen(r, context=ctx, timeout=60) as resp:
            out = resp.read().decode("utf-8")
            print(f"  resposta: {out[:200]}")
    finally:
        try: req("POST", f"/workflows/{wf_id}/deactivate")
        except: pass
        try: req("DELETE", f"/workflows/{wf_id}")
        except: pass

    print("OK — tabelas bot_memoria_dia e bot_memoria_longa criadas.")


if __name__ == "__main__":
    main()
