"""
fix_workflow_state.py — Restaura o estado correto do workflow principal.

Roda após QUALQUER outro fix_*.py que faça PUT do workflow completo,
pois esses scripts podem reverter correções anteriores.

Aplica em sequência:
  1. Conexões corretas (cadeia linear sem duplo trigger)
  2. evolutivoSection no lugar certo no Monta Prompt
  3. É Relatório? com expressão compatível com N8N 2.14.x
"""

import json, os, sys, re, time, urllib.request, urllib.error
from dotenv import load_dotenv
load_dotenv()

N8N_URL = os.getenv("N8N_URL", "https://n8n.srv1537041.hstgr.cloud")
N8N_API_KEY = os.getenv("N8N_API_KEY", "")
WORKFLOW_ID = "DiInHUnddtFACSmj"
HEADERS = {"X-N8N-API-KEY": N8N_API_KEY, "Content-Type": "application/json"}
ALLOWED = {"name", "nodes", "connections", "settings", "staticData"}
ALLOWED_SETTINGS = {"executionOrder","saveManualExecutions","callerPolicy",
                    "errorWorkflow","timezone","saveDataSuccessExecution",
                    "saveDataErrorExecution","saveExecutionProgress"}

def req(method, path, body=None):
    url = f"{N8N_URL}/api/v1{path}"
    data = json.dumps(body).encode() if body else None
    r = urllib.request.Request(url, data=data, headers=HEADERS, method=method)
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        print(f"HTTP {e.code}: {e.read().decode()[:500]}")
        raise

def get_wf(): return req("GET", f"/workflows/{WORKFLOW_ID}")
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

# ── Bloco evolutivoSection correto ───────────────────────────────────────────
EVOLUTIVO_BLOCK = """
// CONHECIMENTO EVOLUTIVO (notas Obsidian indexadas)
let evolutivoSection = '';
try {
  const evItems = $('Busca Evolutivo').all().map(i => i.json).filter(i => i.conteudo);
  if (evItems.length > 0) {
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
      if (evolutivoSection.length > 4200) evolutivoSection = evolutivoSection.substring(0, 4200) + '\\n[...truncado...]';
    }
  }
} catch(e) {}

"""

ANCHOR = "// 9. MONTAGEM FINAL DO SYSTEM CONTENT"
REPLACE_EVOLUTIVO = ".replace(/\\{\\{EVOLUTIVO\\}\\}/g, evolutivoSection)"
REPLACE_CACHE = ".replace(/\\{\\{HISTORICO\\}\\}/g, '__CACHE_SPLIT__')"

# ── Fix 1: Conexões ───────────────────────────────────────────────────────────
def fix_connections(conns):
    changed = False

    # Remover Busca Skills → Busca Evolutivo (direto)
    bs_out = conns.get("Busca Skills", {}).get("main", [[]])[0] if conns.get("Busca Skills", {}).get("main") else []
    before = len(bs_out)
    bs_out[:] = [t for t in bs_out if t.get("node") != "Busca Evolutivo"]
    if len(bs_out) < before:
        print("  [conn] Busca Skills → Busca Evolutivo removido ✅")
        changed = True

    # Remover Busca Tarefas Notion → Monta Prompt (direto)
    btn_out = conns.get("Busca Tarefas Notion", {}).get("main", [[]])[0] if conns.get("Busca Tarefas Notion", {}).get("main") else []
    before = len(btn_out)
    btn_out[:] = [t for t in btn_out if t.get("node") != "Monta Prompt"]
    if len(btn_out) < before:
        print("  [conn] Busca Tarefas Notion → Monta Prompt removido ✅")
        changed = True

    # Garantir Busca Tarefas Notion → Busca Evolutivo
    if not any(t.get("node") == "Busca Evolutivo" for t in btn_out):
        btn_out.append({"node": "Busca Evolutivo", "type": "main", "index": 0})
        if "Busca Tarefas Notion" not in conns: conns["Busca Tarefas Notion"] = {"main": [[]]}
        conns["Busca Tarefas Notion"]["main"][0] = btn_out
        print("  [conn] Busca Tarefas Notion → Busca Evolutivo adicionado ✅")
        changed = True

    # Garantir Busca Evolutivo → Monta Prompt
    be_out = conns.get("Busca Evolutivo", {}).get("main", [[]])[0] if conns.get("Busca Evolutivo", {}).get("main") else []
    if not any(t.get("node") == "Monta Prompt" for t in be_out):
        be_out.append({"node": "Monta Prompt", "type": "main", "index": 0})
        if "Busca Evolutivo" not in conns: conns["Busca Evolutivo"] = {"main": [[]]}
        conns["Busca Evolutivo"]["main"][0] = be_out
        print("  [conn] Busca Evolutivo → Monta Prompt garantido ✅")
        changed = True

    # Verificação
    feeds = [src for src, outs in conns.items()
             for ol in outs.get("main", []) for t in ol if t.get("node") == "Monta Prompt"]
    print(f"  [conn] Nós alimentando Monta Prompt: {feeds}")
    if len(feeds) > 1:
        print("  AVISO: ainda há múltiplos feeds para Monta Prompt!")
    return changed

# ── Fix 2: evolutivoSection no Monta Prompt ───────────────────────────────────
def fix_evolutivo_code(code):
    changed = False

    # Remover blocos mal-posicionados
    pattern = r'\n// CONHECIMENTO EVOLUTIVO \(notas Obsidian indexadas\)\nlet evolutivoSection[\s\S]*?} catch\(e\) \{\}\n'
    new_code, n = re.subn(pattern, '\n', code)
    if n > 0:
        print(f"  [evol] {n} bloco(s) removido(s)")
        code = new_code
        changed = True

    # Inserir antes da âncora
    if "let evolutivoSection" not in code:
        anchor_idx = code.find(ANCHOR)
        if anchor_idx == -1:
            print("  [evol] ERRO: âncora não encontrada!")
            return code, False
        line_start = code.rfind("\n", 0, anchor_idx) + 1
        code = code[:line_start] + EVOLUTIVO_BLOCK + code[line_start:]
        print("  [evol] Bloco evolutivoSection inserido ✅")
        changed = True
    else:
        # Verificar posição
        decl_idx = code.find("let evolutivoSection")
        replace_idx = code.find(REPLACE_EVOLUTIVO)
        anchor_idx = code.find(ANCHOR)
        if decl_idx > anchor_idx:
            print(f"  [evol] Bloco fora do lugar (decl:{decl_idx} > anchor:{anchor_idx}) — corrigindo...")
            pattern2 = r'\n// CONHECIMENTO EVOLUTIVO \(notas Obsidian indexadas\)\nlet evolutivoSection[\s\S]*?} catch\(e\) \{\}\n'
            code = re.sub(pattern2, '\n', code)
            anchor_idx = code.find(ANCHOR)
            line_start = code.rfind("\n", 0, anchor_idx) + 1
            code = code[:line_start] + EVOLUTIVO_BLOCK + code[line_start:]
            print("  [evol] Bloco reposicionado ✅")
            changed = True
        else:
            print(f"  [evol] evolutivoSection ok (pos {decl_idx}, antes da âncora {anchor_idx})")

    # Garantir .replace(EVOLUTIVO)
    if REPLACE_EVOLUTIVO not in code:
        if REPLACE_CACHE in code:
            code = code.replace(REPLACE_CACHE, REPLACE_EVOLUTIVO + "\n    " + REPLACE_CACHE)
            print("  [evol] .replace(EVOLUTIVO) adicionado ✅")
            changed = True

    return code, changed

# ── Fix 3: É Relatório? ───────────────────────────────────────────────────────
def fix_e_relatorio(nodes):
    changed = False
    for n in nodes:
        if n.get("name") != "É Relatório?" or n.get("type") != "n8n-nodes-base.if":
            continue
        def patch(obj, depth=0):
            nonlocal changed
            if depth > 10: return
            if isinstance(obj, dict):
                for k, v in obj.items():
                    if k in ("leftValue", "value1") and isinstance(v, str) and "isReport" in v:
                        if "Formata Transcrição" in v or "isExecuted" in v:
                            obj[k] = "={{ $json.isReport ?? false }}"
                            print(f"  [if] Expressão corrigida ✅")
                            changed = True
                    else:
                        patch(v, depth+1)
            elif isinstance(obj, list):
                for i in obj: patch(i, depth+1)
        patch(n.get("parameters", {}))
    return changed

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    print("Buscando workflow...")
    wf = get_wf()
    nodes = wf.get("nodes", [])
    conns = wf.get("connections", {})

    print("\n[1] Verificando conexões...")
    c1 = fix_connections(conns)

    print("\n[2] Verificando Monta Prompt...")
    mp = next((n for n in nodes if n.get("name") == "Monta Prompt"
               and n.get("type") == "n8n-nodes-base.code"), None)
    c2 = False
    if mp:
        new_code, c2 = fix_evolutivo_code(mp["parameters"].get("jsCode", ""))
        if c2:
            mp["parameters"]["jsCode"] = new_code
    else:
        print("  ERRO: Monta Prompt não encontrado!")

    print("\n[3] Verificando É Relatório?...")
    c3 = fix_e_relatorio(nodes)

    if not (c1 or c2 or c3):
        print("\nNada precisou ser corrigido. Workflow ok!")
        # Mesmo assim faz deactivate+activate para limpar cache

    wf["nodes"] = nodes
    wf["connections"] = conns

    print("\nDesativando workflow...")
    deactivate()
    print("Enviando workflow...")
    put_wf(wf)
    print("Reativando workflow...")
    activate()
    print("\n✅ fix_workflow_state concluído!")

if __name__ == "__main__":
    main()
