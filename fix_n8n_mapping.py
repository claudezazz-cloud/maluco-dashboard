#!/usr/bin/env python3
"""Add chamado→POP mapping to the instruction header."""
import json
import urllib.request

API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkNDE5ZWU0MC0wMmFiLTQ1OGUtODMzMi1lN2E1OWEwYzRmMTAiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiOTQyYWFlZDctYTJkOS00MjJjLWE3OWMtZWMzNzQyMmViOWY4IiwiaWF0IjoxNzc0NzkyNzU2LCJleHAiOjE3NzczNDUyMDB9.bdrA_lXECtGYWsEqQB5FCn4CtZATdI2Mxu3LXQufStA"
BASE = "https://n8n.srv1537041.hstgr.cloud/api/v1/workflows/DiInHUnddtFACSmj"

req = urllib.request.Request(BASE, headers={"X-N8N-API-KEY": API_KEY})
with urllib.request.urlopen(req) as resp:
    wf = json.loads(resp.read())

for node in wf["nodes"]:
    if node["name"] == "Monta Prompt":
        code = node["parameters"]["jsCode"]

        # Replace the old instruction with a better one that includes a mapping
        old_instruction = "  pops += '\\n--- PROCEDIMENTOS (POPs) ---\\nIMPORTANTE: Quando abordar chamados, SEMPRE busque o POP correspondente abaixo e aplique seus passos. Nao diga que nao localizou POP se existe um relacionado ao assunto.\\n\\n';"

        # Build the new instruction with explicit mapping
        # Using \\n for JS newline escapes (in the Python string, \\ = literal backslash)
        new_instruction = (
            "  pops += '\\n--- PROCEDIMENTOS (POPs) ---\\n"
            "REGRA: Voce TEM todos os POPs abaixo. NUNCA diga que nao localizou POP. "
            "Use este mapa para associar chamados aos POPs:\\n"
            "- Perca de Equipamento = POP explicativo do processo de retira de equipamentos\\n"
            "- Retencao / SPC / Cobranca = Processos Operacionais junto ao CCR\\n"
            "- Mudanca de Contrato / Modificacao = Mudanca Contratual\\n"
            "- Servico Instavel / Instabilidade = Reclamacao Servico com Instabilidade\\n"
            "- Servico Indisponivel = Reclamacao Servico Indisponivel\\n"
            "- Divergencia Financeira / Boletos = Alteracao e Correcao de Financeiro\\n"
            "- Assinatura / Contrato / Vendas = Processo e fluxograma de uma nova venda\\n"
            "- Mudanca de Endereco = Mudanca de Endereco\\n"
            "- Mudanca de Senha = Mudanca de Senha Wifi\\n"
            "- Instalacao / Modificacao tecnica = Modificacao da Instalacao\\n"
            "- Comprovante = Comprovante de Pagamento\\n"
            "- Desconto = Descontos de indicacao\\n"
            "Sempre aplique os PASSOS do POP correspondente.\\n\\n';"
        )

        if old_instruction in code:
            code = code.replace(old_instruction, new_instruction)
            node["parameters"]["jsCode"] = code
            print("OK: Replaced instruction with mapping")
        else:
            print("FAIL: old instruction not found")
            # Show what's there
            idx = code.find("PROCEDIMENTOS")
            if idx >= 0:
                line_start = code.rfind("\n", 0, idx)
                line_end = code.find("\n", idx)
                print("Current: " + repr(code[line_start:line_end]))
            exit(1)
        break

# Deploy
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

req2 = urllib.request.Request(BASE, data=payload, method="PUT", headers={
    "X-N8N-API-KEY": API_KEY,
    "Content-Type": "application/json"
})
try:
    with urllib.request.urlopen(req2) as resp2:
        result = json.loads(resp2.read())
        print("DEPLOYED: {} | Active: {}".format(result.get("name"), result.get("active")))
except urllib.error.HTTPError as e:
    print("ERROR: {} {}".format(e.code, e.read().decode()[:300]))
