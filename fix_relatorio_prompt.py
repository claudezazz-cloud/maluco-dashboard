"""
fix_relatorio_prompt.py — Corrige o prompt do Monta Prompt Relatório.

Problema: o bot gerava relatórios com:
- ### headers (proibidos no WhatsApp)
- Seção "Notion" inventada quando dados não disponíveis
- Referências a N8N, nós, workflow, infraestrutura interna

Fix: substituir o system prompt do relatório por versão muito mais restritiva
que proíbe explicitamente seções extras e referências internas.
"""
import json, os, sys, time, urllib.request, urllib.error
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

# Marcador para localizar o system prompt no código JS
OLD_SYSTEM_START = '`${rulesPrompt}\\nVocê é Maluco da IA 👽🍀. DATA ATUAL: ${dia}/${mes}/${ano}.\\n\\nO usuário solicitou um RELATÓRIO'
OLD_SYSTEM_END = 'Seja COMPLETO — liste TODOS os atendimentos, não resuma em \\"vários serviços\\". O objetivo é que ninguém fique para trás.\\n${resumoStats}\\nHISTÓRICO COMPLETO DO GRUPO ${periodoLabel}:\\n${historico.substring(0, 60000)}\\n`'

NEW_SYSTEM = '''`${rulesPrompt}\\nVocê é Maluco da IA 👽🍀. DATA ATUAL: ${dia}/${mes}/${ano}.\\n\\nGere um RELATÓRIO ${periodoLabel} das mensagens do grupo de trabalho da Zazz Internet.\\n\\n🚫 REGRAS ABSOLUTAS (violação = resposta inválida):\\n1. Use APENAS as seções listadas abaixo — ZERO seções extras inventadas\\n2. NUNCA use ### ou ## — PROIBIDO. Use *negrito* e _itálico_ (WhatsApp)\\n3. NUNCA mencione Notion, N8N, banco de dados, Redis, sistema, nó, workflow ou qualquer infraestrutura interna\\n4. Se uma seção não tiver dados, OMITA ela completamente — não escreva nada sobre ela\\n5. Use APENAS o histórico de mensagens abaixo como fonte — não invente fatos\\n\\nESTRUTURA EXATA (copie os emojis e o formato):\\n\\n*📋 RELATÓRIO ${periodoLabel}*\\n_${dia}/${mes}/${ano}_\\n\\n*🟢 SERVIÇOS CONCLUÍDOS:*\\n- [horário] _Cliente/Situação_ — resolvido por _Técnico_ ✅\\n(Se nenhum, escreva: - Nenhum serviço concluído registrado)\\n\\n*🔴 SERVIÇOS PENDENTES:*\\n- [horário] _Cliente/Situação_ — solicitado por _Pessoa_ ⚠️\\n(Se nenhum, escreva: - Nenhum serviço pendente)\\n\\n*📊 RESUMO GERAL:*\\n- Total de atendimentos: X\\n- Concluídos: X\\n- Pendentes: X\\n- Taxa de resolução: X%\\n\\n*💡 DESTAQUES:*\\n- (situações críticas, padrões, observações — omitir seção se não houver nada relevante)\\n${reportType !== 'diario' ? '*📈 TENDÊNCIAS:*\\n- (padrões recorrentes entre dias — omitir se não houver)\\n' : ''}\\n${resumoStats}\\nHISTÓRICO COMPLETO ${periodoLabel}:\\n${historico.substring(0, 60000)}\\n`'''

def main():
    print("Buscando workflow...")
    wf = get_wf()
    nodes = wf.get("nodes", [])

    target = next((n for n in nodes if n.get("name") == "Monta Prompt Relatório"
                   and n.get("type") == "n8n-nodes-base.code"), None)
    if not target:
        print("ERRO: Monta Prompt Relatório não encontrado!")
        sys.exit(1)

    code = target["parameters"].get("jsCode", "")

    # Localiza o system prompt completo entre os marcadores
    start_idx = code.find(OLD_SYSTEM_START)
    if start_idx == -1:
        print("AVISO: marcador inicial não encontrado. Verificando se já foi corrigido...")
        if "REGRAS ABSOLUTAS" in code:
            print("✅ Prompt já foi atualizado anteriormente.")
        else:
            print("ERRO: não conseguiu localizar o system prompt. Inspecione manualmente.")
            # Mostra início do system para diagnóstico
            idx = code.find("system:")
            if idx != -1:
                print("  system prompt atual:")
                print(code[idx:idx+300])
        sys.exit(0)

    end_idx = code.find(OLD_SYSTEM_END)
    if end_idx == -1:
        print("ERRO: marcador final não encontrado. O prompt pode já ter sido modificado.")
        sys.exit(1)

    end_idx += len(OLD_SYSTEM_END)
    old_block = code[start_idx:end_idx]
    new_code = code[:start_idx] + NEW_SYSTEM + code[end_idx:]

    print(f"  System prompt antigo: {len(old_block)} chars")
    print(f"  System prompt novo:   {len(NEW_SYSTEM)} chars")

    target["parameters"]["jsCode"] = new_code
    wf["nodes"] = nodes

    print("Desativando workflow...")
    deactivate()
    print("Enviando workflow corrigido...")
    put_wf(wf)
    print("Reativando workflow...")
    activate()
    print("✅ Monta Prompt Relatório corrigido!")
    print("   Proibições adicionadas: ###/##, seções inventadas, referências internas")

if __name__ == "__main__":
    main()
