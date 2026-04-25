"""
Adiciona o nó "Busca Evolutivo" (Postgres) ao workflow do N8N e atualiza
o código do "Monta Prompt" para injetar o contexto {{EVOLUTIVO}}.

Uso:
  python fix_evolutivo_workflow.py

Requer: N8N_URL e N8N_API_KEY no .env ou como variáveis de ambiente.
"""

import json, os, sys, time, urllib.request, urllib.error
from dotenv import load_dotenv

load_dotenv()

N8N_URL = os.getenv("N8N_URL", "https://n8n.srv1537041.hstgr.cloud")
N8N_API_KEY = os.getenv("N8N_API_KEY", "")
WORKFLOW_ID = "DiInHUnddtFACSmj"

HEADERS = {
    "X-N8N-API-KEY": N8N_API_KEY,
    "Content-Type": "application/json",
}

def req(method, path, body=None):
    url = f"{N8N_URL}/api/v1{path}"
    data = json.dumps(body).encode() if body else None
    r = urllib.request.Request(url, data=data, headers=HEADERS, method=method)
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        print(f"HTTP {e.code}: {e.read().decode()}")
        raise

def get_workflow():
    return req("GET", f"/workflows/{WORKFLOW_ID}")

def put_workflow(wf):
    # N8N API only accepts these top-level fields on PUT
    allowed = {"name", "nodes", "connections", "settings", "staticData"}
    body = {k: v for k, v in wf.items() if k in allowed}
    # Filter settings to only known-good fields
    allowed_settings = {"executionOrder", "saveManualExecutions", "callerPolicy",
                        "errorWorkflow", "timezone", "saveDataSuccessExecution",
                        "saveDataErrorExecution", "saveExecutionProgress"}
    if "settings" in body:
        body["settings"] = {k: v for k, v in body["settings"].items() if k in allowed_settings}
    return req("PUT", f"/workflows/{WORKFLOW_ID}", body)

def deactivate():
    try: req("POST", f"/workflows/{WORKFLOW_ID}/deactivate")
    except: pass

def activate():
    time.sleep(1)
    req("POST", f"/workflows/{WORKFLOW_ID}/activate")

# ── Novo nó "Busca Evolutivo" ──────────────────────────────────────────────────
# Posicionado ao lado de "Busca Tarefas Notion" [14320, 9168] — abaixo
BUSCA_EVOLUTIVO_NODE = {
    "parameters": {
        "operation": "executeQuery",
        "query": (
            "SELECT d.titulo, d.caminho, c.conteudo "
            "FROM evolutive_chunks c "
            "JOIN evolutive_documents d ON d.id = c.document_id "
            "JOIN evolutive_sources s ON s.id = d.source_id "
            "WHERE s.ativo = true AND d.ativo = true AND d.erro IS NULL "
            "ORDER BY d.titulo, c.ordem"
        ),
        "options": {},
    },
    "id": "busca-evolutivo-2026",
    "name": "Busca Evolutivo",
    "type": "n8n-nodes-base.postgres",
    "typeVersion": 2.4,
    "position": [14320, 9360],
    "executeOnce": True,
    "alwaysOutputData": True,
    "credentials": {"postgres": {"id": "AErqeMtSVfS0MNsb", "name": "Postgres account"}},
}

# ── Trecho de código a INSERIR no Monta Prompt ────────────────────────────────
# Inserido após o bloco de REGRAS (linha com rulesPrompt) e antes de SYSTEM PROMPT
EVOLUTIVO_CODE = '''
// CONHECIMENTO EVOLUTIVO (notas Obsidian indexadas)
let evolutivoSection = '';
try {
  const evItems = $('Busca Evolutivo').all().map(i => i.json).filter(i => i.conteudo);
  if (evItems.length > 0) {
    // Keyword ranking (mesma lógica dos POPs)
    const evScored = evItems.map(item => {
      const texto = normaliza((item.titulo || '') + ' ' + (item.conteudo || '').substring(0, 600));
      let score = 0;
      for (const p of msgPalavras) { if (texto.includes(p)) score++; }
      return { item, score };
    });
    evScored.sort((a, b) => b.score - a.score);
    const top = evScored.slice(0, 5).filter(e => e.score > 0 || evItems.length <= 5);
    if (top.length > 0) {
      const linhas = top.map(e => {
        const titulo = e.item.titulo ? `[${e.item.titulo}]\\n` : '';
        return titulo + e.item.conteudo.substring(0, 1200);
      }).join('\\n\\n---\\n\\n');
      evolutivoSection = '\\n\\n## Conhecimento Evolutivo (complementar, nao normativo — POPs tem prioridade):\\n' + linhas;
      // Limite de segurança: ~4000 chars
      if (evolutivoSection.length > 4200) evolutivoSection = evolutivoSection.substring(0, 4200) + '\\n[...truncado...]';
    }
  }
} catch(e) {}
'''

def main():
    print("Buscando workflow...")
    wf = get_workflow()
    nodes = wf.get("nodes", [])
    conns = wf.get("connections", {})

    # Verificar se já existe
    if any(n.get("id") == "busca-evolutivo-2026" for n in nodes):
        print("Nó 'Busca Evolutivo' já existe. Pulando adição de nó.")
    else:
        print("Adicionando nó 'Busca Evolutivo'...")
        nodes.append(BUSCA_EVOLUTIVO_NODE)

    # Conectar "Busca Skills" → "Busca Evolutivo" e "Busca Evolutivo" → "Monta Prompt"
    # "Busca Tarefas Notion" já conecta a "Monta Prompt". Adicionamos "Busca Evolutivo" também.
    if "Busca Skills" not in conns:
        conns["Busca Skills"] = {"main": [[]]}
    # Garantir que "Busca Evolutivo" está nas saídas de Busca Skills (index 0)
    busca_skills_main = conns["Busca Skills"].get("main", [[]])
    if not busca_skills_main:
        busca_skills_main = [[]]
    while len(busca_skills_main) < 1:
        busca_skills_main.append([])
    already_connected = any(t.get("node") == "Busca Evolutivo" for t in busca_skills_main[0])
    if not already_connected:
        busca_skills_main[0].append({"node": "Busca Evolutivo", "type": "main", "index": 0})
    conns["Busca Skills"]["main"] = busca_skills_main

    # Conectar "Busca Evolutivo" → "Monta Prompt"
    if "Busca Evolutivo" not in conns:
        conns["Busca Evolutivo"] = {"main": [[]]}
    busca_ev_main = conns["Busca Evolutivo"].get("main", [[]])
    if not busca_ev_main:
        busca_ev_main = [[]]
    already = any(t.get("node") == "Monta Prompt" for t in busca_ev_main[0])
    if not already:
        busca_ev_main[0].append({"node": "Monta Prompt", "type": "main", "index": 0})
    conns["Busca Evolutivo"]["main"] = busca_ev_main

    # Atualizar código do Monta Prompt
    for node in nodes:
        if node.get("name") == "Monta Prompt" and node.get("type") == "n8n-nodes-base.code":
            code = node["parameters"].get("jsCode", "")
            if "Busca Evolutivo" in code:
                print("Código do Monta Prompt já contém bloco evolutivo. Pulando.")
            else:
                # Inserir após o bloco de REGRAS (após linha rulesPrompt)
                marker = "const rulesPrompt ="
                marker_end = "rulesPrompt;\n"
                idx = code.find(marker_end)
                if idx == -1:
                    marker_end = "rulesPrompt\n"
                    idx = code.find(marker_end)
                if idx != -1:
                    insert_at = idx + len(marker_end)
                    code = code[:insert_at] + EVOLUTIVO_CODE + code[insert_at:]
                    print("Código evolutivo inserido no Monta Prompt.")
                else:
                    print("AVISO: marcador para inserção não encontrado. Inserindo no início do código.")
                    code = EVOLUTIVO_CODE + "\n" + code

                # Adicionar .replace para {{EVOLUTIVO}} antes do __CACHE_SPLIT__
                if "{{EVOLUTIVO}}" not in code:
                    cache_marker = ".replace(/\\{\\{HISTORICO\\}\\}/g, '__CACHE_SPLIT__')"
                    if cache_marker in code:
                        code = code.replace(
                            cache_marker,
                            ".replace(/\\{\\{EVOLUTIVO\\}\\}/g, evolutivoSection)\n    " + cache_marker
                        )
                        print("Placeholder {{EVOLUTIVO}} adicionado ao replace chain.")

                node["parameters"]["jsCode"] = code
            break

    wf["nodes"] = nodes
    wf["connections"] = conns

    print("Desativando workflow...")
    deactivate()

    print("Enviando workflow atualizado...")
    put_workflow(wf)

    print("Reativando workflow...")
    activate()

    print("Pronto! Nó 'Busca Evolutivo' adicionado e Monta Prompt atualizado.")
    print("Lembre de adicionar {{EVOLUTIVO}} no system prompt via deploy_system_prompt.py")

if __name__ == "__main__":
    main()
