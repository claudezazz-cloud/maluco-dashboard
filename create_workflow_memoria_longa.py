"""
create_workflow_memoria_longa.py

Cria o workflow N8N "Bot Memoria Longa" que:
- Roda 1x por dia às 03:00 (cron expression)
- Lê resumos dos últimos 7 dias de bot_memoria_dia
- Lê fatos existentes de bot_memoria_longa (para deduplicação)
- Chama Claude para extrair padrões e fatos relevantes
- Faz upsert em bot_memoria_longa com fuzzy match por similaridade JS

Output: imprime o ID do workflow (salvar em N8N_MEMORIA_LONGA_WF_ID no .env do dashboard).
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


# ── Code: Prepara Prompt Longa ───────────────────────────────────────────────
PREPARA_LONGA_CODE = r"""
// Lê resumos dos últimos 7 dias
const resumos = $('Busca Resumos Semana').all().map(i => i.json);
if (resumos.length === 0) {
  return []; // Sem dados — pula
}

// Lê fatos existentes (para referência de deduplicação no prompt)
const fatosExistentes = $('Busca Fatos Existentes').all().map(i => i.json);

// Monta contexto de resumos agrupados por data
const resumosPorData = {};
for (const r of resumos) {
  const d = (r.data || '?').toString().substring(0, 10);
  if (!resumosPorData[d]) resumosPorData[d] = [];
  resumosPorData[d].push(r.resumo || '');
}
const resumosTexto = Object.entries(resumosPorData)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([data, txts]) => `=== ${data} ===\n${txts.join('\n')}`)
  .join('\n\n')
  .substring(0, 20000);

// Lista de fatos já conhecidos para o Claude não duplicar
const fatosConhecidosTexto = fatosExistentes.length > 0
  ? 'FATOS JÁ REGISTRADOS (não repita estes, só registre novos ou atualizações):\n' +
    fatosExistentes.slice(0, 50).map(f =>
      `- [${f.entidade_tipo}:${f.entidade_id}] ${f.fato}`
    ).join('\n')
  : '';

const prompt = `Você analisa o histórico de uma provedora de internet (Zazz Internet, fibra óptica em Lunardelli-PR) para identificar PADRÕES e FATOS RELEVANTES.

Analise os resumos das conversas dos últimos 7 dias e identifique fatos recorrentes ou relevantes sobre:
- "cliente": problemas crônicos, perfil de comportamento, histórico recorrente
- "colaborador": especialidades, padrões de trabalho, eficiência observada
- "regiao": ruas ou áreas com problemas de infraestrutura recorrentes
- "equipamento": OLTs, ONUs, roteadores com falha repetida
- "empresa": padrões operacionais, decisões estratégicas, gargalos

Para cada fato encontrado, retorne UM objeto JSON:
{
  "entidade_tipo": "cliente|colaborador|regiao|equipamento|empresa",
  "entidade_id": "identificador único (nome do cliente, nome do colaborador, nome da rua, modelo do equipamento)",
  "fato": "frase clara, específica e acionável em 1-2 linhas",
  "categoria": "comportamento|tecnico|comercial|historico",
  "peso": <número 1-10 indicando importância para decisões futuras>
}

Critérios:
- Peso >= 8: fato crítico para operação (ex: "OLT da rua X cai toda semana")
- Peso 5-7: fato relevante mas não urgente
- Peso < 5: observação menor — OMITA, não registre
- IGNORE conversas casuais, cumprimentos, ruído
- IGNORE fatos óbvios (ex: "empresa vende fibra óptica")
- Só registre o que ajuda a operação a tomar DECISÕES MELHORES

${fatosConhecidosTexto}

Resumos dos últimos 7 dias:
${resumosTexto}

Retorne APENAS um array JSON válido. Sem markdown. Sem texto extra. Se não encontrar fatos relevantes, retorne [].`;

const claudeBody = {
  model: "claude-haiku-4-5-20251001",
  max_tokens: 3000,
  messages: [{ role: "user", content: prompt }]
};

// Passa fatos existentes para o próximo node usar em deduplicação
return [{ json: { claudeBody, fatosExistentes } }];
"""

# ── Code: Parse Fatos + Deduplica + Gera SQL ────────────────────────────────
PARSE_FATOS_CODE = r"""
// Similaridade de Jaccard entre duas strings (tokenizada por palavras)
function similaridade(a, b) {
  const tokenize = s => new Set(
    s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
     .split(/\W+/).filter(w => w.length > 2)
  );
  const A = tokenize(a);
  const B = tokenize(b);
  if (A.size === 0 && B.size === 0) return 1;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}

const raw = $input.first().json;
const content = (raw.content && raw.content[0] && raw.content[0].text) ? raw.content[0].text : '[]';
const fatosExistentes = $('Prepara Prompt Longa').first().json.fatosExistentes || [];

let novosFatos = [];
try {
  const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  novosFatos = JSON.parse(cleaned);
  if (!Array.isArray(novosFatos)) novosFatos = [];
} catch(e) {
  console.error('Parse erro:', e.message, content.substring(0, 200));
  return [];
}

// Filtra fatos inválidos e com peso < 5
novosFatos = novosFatos.filter(f =>
  f.entidade_tipo && f.entidade_id && f.fato &&
  typeof f.peso === 'number' && f.peso >= 5
).slice(0, 100); // max 100 fatos por rodada

if (novosFatos.length === 0) return [];

// Para cada fato novo: verifica se já existe similar (Jaccard >= 0.7 + mesma entidade)
const sqlStatements = [];
const now = new Date().toISOString();

for (const fato of novosFatos) {
  const tipo = (fato.entidade_tipo || '').substring(0, 30).replace(/'/g, "''");
  const entId = (fato.entidade_id || '').substring(0, 100).replace(/'/g, "''");
  const fatoTxt = (fato.fato || '').substring(0, 1000).replace(/'/g, "''");
  const categoria = (fato.categoria || 'historico').substring(0, 50).replace(/'/g, "''");
  const peso = Math.min(10, Math.max(1, Math.round(fato.peso || 5)));

  // Verifica duplicata por similaridade Jaccard contra fatos da mesma entidade
  const existentesSimilares = fatosExistentes.filter(e =>
    e.entidade_tipo === tipo &&
    e.entidade_id === entId &&
    similaridade(e.fato, fato.fato) >= 0.7
  );

  if (existentesSimilares.length > 0) {
    // Atualiza ocorrências do fato mais similar
    const melhor = existentesSimilares[0];
    sqlStatements.push(
      `UPDATE bot_memoria_longa SET ocorrencias = ocorrencias + 1, ultima_ocorrencia = '${now}', peso = GREATEST(peso, ${peso}) WHERE id = ${melhor.id}`
    );
  } else {
    // Insere novo fato (ON CONFLICT por unique_fato)
    sqlStatements.push(
      `INSERT INTO bot_memoria_longa (entidade_tipo, entidade_id, fato, categoria, peso, ocorrencias, primeira_ocorrencia, ultima_ocorrencia) ` +
      `VALUES ('${tipo}', '${entId}', '${fatoTxt}', '${categoria}', ${peso}, 1, '${now}', '${now}') ` +
      `ON CONFLICT (entidade_tipo, entidade_id, fato) DO UPDATE SET ` +
      `ocorrencias = bot_memoria_longa.ocorrencias + 1, ultima_ocorrencia = '${now}', peso = GREATEST(bot_memoria_longa.peso, EXCLUDED.peso)`
    );
  }
}

const batchSql = sqlStatements.join('; ');
return [{ json: { batchSql, totalFatos: novosFatos.length, totalSql: sqlStatements.length } }];
"""

PX = 300

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
    "name": "Bot Memoria Longa",
    "nodes": [
        # 1. Schedule — todo dia às 03:00
        {
            "id": "schedule-longa", "name": "Agendamento 03h",
            "type": "n8n-nodes-base.scheduleTrigger", "typeVersion": 1.2,
            "position": [0, 0],
            "parameters": {
                "rule": {"interval": [{"field": "cronExpression", "expression": "0 3 * * *"}]}
            },
        },
        # 2. Busca resumos dos últimos 7 dias
        pg_node(
            "busca-resumos", "Busca Resumos Semana",
            ("SELECT chat_id, data::text, resumo "
             "FROM bot_memoria_dia "
             "WHERE data >= CURRENT_DATE - INTERVAL '7 days' "
             "  AND resumo IS NOT NULL AND resumo <> '' "
             "ORDER BY data DESC, id DESC "
             "LIMIT 100"),
            [PX, 0], execute_once=True, always_output=True
        ),
        # 3. Busca fatos existentes para deduplicação
        pg_node(
            "busca-fatos", "Busca Fatos Existentes",
            ("SELECT id, entidade_tipo, entidade_id, fato, peso, ocorrencias "
             "FROM bot_memoria_longa "
             "WHERE ativo = true "
             "ORDER BY ocorrencias DESC, peso DESC "
             "LIMIT 200"),
            [PX * 2, 0], execute_once=True, always_output=True
        ),
        # 4. Prepara prompt Claude
        {
            "id": "prepara-longa", "name": "Prepara Prompt Longa",
            "type": "n8n-nodes-base.code", "typeVersion": 2,
            "position": [PX * 3, 0],
            "parameters": {"mode": "runOnceForAllItems", "jsCode": PREPARA_LONGA_CODE},
        },
        # 5. Claude Haiku — extrai padrões
        {
            "id": "claude-longa", "name": "Claude Extrai Fatos",
            "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.3,
            "position": [PX * 4, 0],
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
                "options": {"timeout": 90000},
            },
            "credentials": {"httpHeaderAuth": CLAUDE_CRED},
            "retryOnFail": True,
            "maxTries": 3,
            "waitBetweenTries": 3000,
        },
        # 6. Parse + deduplicação + gera SQL
        {
            "id": "parse-fatos", "name": "Parse Fatos e Deduplica",
            "type": "n8n-nodes-base.code", "typeVersion": 2,
            "position": [PX * 5, 0],
            "parameters": {"mode": "runOnceForAllItems", "jsCode": PARSE_FATOS_CODE},
        },
        # 7. Executa batch upsert
        pg_node(
            "salva-fatos", "Salva Fatos Longos",
            "={{ $json.batchSql }}",
            [PX * 6, 0]
        ),
    ],
    "connections": {
        "Agendamento 03h":       {"main": [[{"node": "Busca Resumos Semana",     "type": "main", "index": 0}]]},
        "Busca Resumos Semana":  {"main": [[{"node": "Busca Fatos Existentes",   "type": "main", "index": 0}]]},
        "Busca Fatos Existentes":{"main": [[{"node": "Prepara Prompt Longa",     "type": "main", "index": 0}]]},
        "Prepara Prompt Longa":  {"main": [[{"node": "Claude Extrai Fatos",      "type": "main", "index": 0}]]},
        "Claude Extrai Fatos":   {"main": [[{"node": "Parse Fatos e Deduplica",  "type": "main", "index": 0}]]},
        "Parse Fatos e Deduplica":{"main":[[{"node": "Salva Fatos Longos",       "type": "main", "index": 0}]]},
    },
    "settings": {
        "executionOrder": "v1",
        "saveManualExecutions": True,
        "callerPolicy": "workflowsFromSameOwner",
    },
    "staticData": None,
}


def main():
    print("Verificando se workflow ja existe...")
    existing = req("GET", "/workflows?limit=100")
    for wf in existing.get("data", []):
        if wf.get("name") == "Bot Memoria Longa":
            print(f"  Ja existe: {wf['id']} — deletando para recriar...")
            try:
                req("POST", f"/workflows/{wf['id']}/deactivate")
            except:
                pass
            req("DELETE", f"/workflows/{wf['id']}")
            time.sleep(1)
            break

    print("Criando workflow Bot Memoria Longa...")
    created = req("POST", "/workflows", WF_BODY)
    wf_id = created["id"]
    print(f"  Criado: id = {wf_id}")

    print("Ativando...")
    req("POST", f"/workflows/{wf_id}/activate")
    print("  Ativo!")

    print()
    print("=" * 60)
    print(f"WORKFLOW ID: {wf_id}")
    print(f"Adicione no .env do dashboard:")
    print(f"  N8N_MEMORIA_LONGA_WF_ID={wf_id}")
    print("=" * 60)
    print("Workflow roda automaticamente todo dia as 03:00.")


if __name__ == "__main__":
    main()
