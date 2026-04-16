import json

with open("/tmp/exec10434.json") as f:
    data = json.load(f)

nodes = data.get("data", {}).get("resultData", {}).get("runData", {})

# Check Busca POPs output
if "Busca POPs" in nodes:
    bp = nodes["Busca POPs"]
    out = bp[0].get("data", {}).get("main", [[]])[0]
    print("Busca POPs returned {} items".format(len(out)))
    for item in out[:5]:
        j = item.get("json", {})
        titulo = j.get("titulo", "?")[:50]
        prio = j.get("prioridade", "?")
        cat = j.get("categoria", "?")
        print("  {} | prio={} | cat={}".format(titulo, prio, cat))
    if len(out) > 5:
        print("  ... and {} more".format(len(out) - 5))
else:
    print("Busca POPs NOT in execution!")

# Check system content
mp = nodes.get("Monta Prompt", [{}])[0]
mpout = mp.get("data", {}).get("main", [[]])[0]
if mpout:
    system = mpout[0].get("json", {}).get("claudeBody", {}).get("system", "")
    checks = ["Mudanca Contratual", "Mudança Contratual", "retira de equipamentos",
              "Alteracao", "Alteração", "Comprovante", "CCR", "Fluxo ATENDIMENTO",
              "PROCEDIMENTOS", "Fluxo COMERCIAL", "Instabilidade"]
    for p in checks:
        print("  [{}]: {}".format(p, p in system))
