import urllib.request, json, sys

jid = sys.argv[1] if len(sys.argv) > 1 else ""
if not jid:
    print("Forneça o JID do grupo ou contato!")
    sys.exit(1)

url = "https://lanlunar-evolution.cloudfy.live/message/sendInteractive/ZazzClaude"
payload = {
  "number": jid,
  "type": "list",
  "listMessage": {
    "title": "Teste de Botões Interativos 👽",
    "description": "Essa é uma mensagem de teste enviada diretamente pelo Maluco da IA. Escolha uma opção abaixo para ver como o WhatsApp renderiza no seu celular:",
    "buttonText": "Ver Opções",
    "sections": [
      {
        "title": "Confirmação",
        "rows": [
          { "title": "✅ Sim, funciona!", "rowId": "btn_yes" },
          { "title": "❌ Não gostei", "rowId": "btn_no" }
        ]
      }
    ]
  }
}

req = urllib.request.Request(url, data=json.dumps(payload).encode(), headers={'apikey': 'REDACTED-EVO-KEY', 'Content-Type': 'application/json'})
try:
    with urllib.request.urlopen(req) as resp:
        print(resp.read().decode())
except Exception as e:
    print(f"Erro: {e}")
