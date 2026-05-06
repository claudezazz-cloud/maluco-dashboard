"""
fix_filtra_decide_multigrupo.py
Remove o early-exit por grupoNotif nos nós Filtra e Decide / Filtra Entrega.

Bug: ambos verificavam se grupo_notificacao_ok / grupo_notificacao_entrega estava
preenchido em dashboard_config e saíam cedo se vazio — nunca chegando em
Busca Grupos OK / Busca Grupos Entrega (adicionados pelo fix multi-grupo).

Fix: remover o if (!grupoNotif) ... que bloqueia o fluxo.
"""
import json, time, urllib.request, urllib.error

N8N_URL     = "https://n8n.srv1537041.hstgr.cloud"
N8N_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkNDE5ZWU0MC0wMmFiLTQ1OGUtODMzMi1lN2E1OWEwYzRmMTAiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMDEzY2FkYmQtMmM4Yi00ZjZlLWFjYmQtOTY2ODI1MGUwZDcxIiwiaWF0IjoxNzc3MzgxNDEzfQ.tKyTjOHjsWaMBk0sonCHoXjupA5QErEEuqEj-ZSEY1s"
WORKFLOW_ID = "Urf233bK6RqoSlQs"

HEADERS = {"X-N8N-API-KEY": N8N_API_KEY, "Content-Type": "application/json"}
ALLOWED = {"name", "nodes", "connections", "settings", "staticData"}
ALLOWED_SETTINGS = {"executionOrder","saveManualExecutions","callerPolicy",
                    "errorWorkflow","timezone","saveDataSuccessExecution",
                    "saveDataErrorExecution","saveExecutionProgress"}

def req(method, path, body=None):
    url  = f"{N8N_URL}/api/v1{path}"
    data = json.dumps(body).encode() if body else None
    r    = urllib.request.Request(url, data=data, headers=HEADERS, method=method)
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        print(f"HTTP {e.code}: {e.read().decode()[:500]}")
        raise

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

# Código novo para "Filtra e Decide" — sem early exit por grupoNotif
NEW_FILTRA_E_DECIDE = r"""
const notionResp = $('Busca Ok Notion').first().json;
const results = notionResp?.results || [];

// IDs já vistos (armazenados como JSON array de strings)
let vistos = [];
try {
  const raw = $('Busca Visto Redis').first().json?.propertyName
           || $('Busca Visto Redis').first().json?.value
           || '[]';
  vistos = JSON.parse(raw);
  if (!Array.isArray(vistos)) vistos = [];
} catch(e) { vistos = []; }

// Janela de detecção: 12 minutos (cobre o intervalo de 5min + margem)
const JANELA_MS = 12 * 60 * 1000;
const agora = Date.now();

const novas = [];
const novosIds = [];

for (const page of results) {
  const pageId = (page.id || '').replace(/-/g, '');
  if (!pageId) continue;
  if (vistos.includes(pageId)) continue;  // já notificado

  // Verificar se foi editado na janela de tempo
  const editado = page.last_edited_time ? new Date(page.last_edited_time).getTime() : 0;
  if (agora - editado > JANELA_MS) continue;  // muito antigo

  const props = page.properties || {};
  const titulo = props['Descrição']?.title?.map(t => t.plain_text).join('') || '(sem título)';
  const cliente = props['Cliente']?.rich_text?.map(t => t.plain_text).join('') || '';
  const resp = (props['Responsável']?.people || []).map(p => p.name || '').filter(Boolean).join(', ');

  novas.push({ titulo, cliente, resp });
  novosIds.push(pageId);
}

if (novas.length === 0) return [{ json: { temNovas: false, msg: '', novosIds: [] } }];

// Monta mensagem
let msg = `✅ *${novas.length === 1 ? 'Tarefa concluída' : novas.length + ' tarefas concluídas'} no Notion!*\n`;
for (const t of novas) {
  const clienteStr = t.cliente ? ` — ${t.cliente}` : '';
  const respStr = t.resp ? ` _(${t.resp})_` : '';
  msg += `\n• *${t.titulo}*${clienteStr}${respStr}`;
}

// IDs atualizados para salvar
const todosIds = [...new Set([...vistos, ...novosIds])].slice(-200);  // manter últimos 200

return [{ json: { temNovas: true, msg, novosIds: todosIds } }];
""".strip()

# Código novo para "Filtra Entrega" — sem early exit por grupoNotif
NEW_FILTRA_ENTREGA = r"""
const notionResp = $('Busca Tarefas Vencendo').first().json;
const results    = notionResp?.results || [];

// IDs já avisados hoje
let vistos = [];
try {
  const raw = $('Busca Visto Entrega').first().json?.propertyName
           || $('Busca Visto Entrega').first().json?.value
           || '[]';
  vistos = JSON.parse(raw);
  if (!Array.isArray(vistos)) vistos = [];
} catch(e) { vistos = []; }

const hoje = new Date().toISOString().split('T')[0];
const novas = [];
const novosIds = [];

for (const page of results) {
  const pageId = (page.id || '').replace(/-/g, '');
  if (!pageId || vistos.includes(pageId)) continue;

  const props = page.properties || {};
  const titulo  = (props['Descrição']  || props['Descricao'])?.title?.map(t => t.plain_text).join('') || '(sem titulo)';
  const cliente = props['Cliente']?.rich_text?.map(t => t.plain_text).join('') || '';
  const entrega = props['Entrega']?.date?.start || hoje;
  const resp    = ((props['Responsável'] || props['Responsavel'])?.people || [])
                    .map(p => p.name || '').filter(Boolean).join(', ');

  novas.push({ titulo, cliente, entrega, resp });
  novosIds.push(pageId);
}

if (novas.length === 0) {
  return [{ json: { temEntrega: false, msg: '', novosIds: vistos } }];
}

let msg = `⏰ *${novas.length === 1 ? 'Tarefa com entrega hoje' : novas.length + ' tarefas com entrega hoje'}!*\n`;
for (const t of novas) {
  const clienteStr = t.cliente ? ` — ${t.cliente}` : '';
  const respStr    = t.resp    ? ` _(${t.resp})_`    : '';
  msg += `\n• *${t.titulo}*${clienteStr}${respStr}`;
}
msg += `\n\n_Verifique o Notion para mais detalhes._`;

const todosIds = [...new Set([...vistos, ...novosIds])].slice(-200);

return [{ json: { temEntrega: true, msg, novosIds: todosIds } }];
""".strip()

def main():
    print("Buscando workflow...")
    wf    = req("GET", f"/workflows/{WORKFLOW_ID}")
    nodes = wf.get("nodes", [])
    changed = False

    for node in nodes:
        name = node.get("name", "")
        if name == "Filtra e Decide":
            old = node["parameters"].get("jsCode", "")
            if "if (!grupoNotif)" in old:
                node["parameters"]["jsCode"] = NEW_FILTRA_E_DECIDE
                print("  [OK] Filtra e Decide: early exit por grupoNotif removido")
                changed = True
            else:
                print("  Filtra e Decide: early exit já removido")

        elif name == "Filtra Entrega":
            old = node["parameters"].get("jsCode", "")
            if "if (!grupoNotif)" in old:
                node["parameters"]["jsCode"] = NEW_FILTRA_ENTREGA
                print("  [OK] Filtra Entrega: early exit por grupoNotif removido")
                changed = True
            else:
                print("  Filtra Entrega: early exit já removido")

    if not changed:
        print("Nada a alterar.")
        return

    wf["nodes"] = nodes

    print("Desativando workflow...")
    deactivate()
    print("Enviando correção...")
    put_wf(wf)
    print("Reativando workflow...")
    activate()
    print()
    print("Pronto! Alertas agora disparam mesmo sem dashboard_config preenchido.")
    print("  - OK: Filtra e Decide → Tem Novas? → Busca Grupos OK → Envia")
    print("  - Entrega: Filtra Entrega → Tem Entrega? → Busca Grupos Entrega → Envia")

if __name__ == "__main__":
    main()
