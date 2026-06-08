import urllib.request, json, sys

jid = sys.argv[1] if len(sys.argv) > 1 else ""
url = "https://lanlunar-evolution.cloudfy.live/message/sendText/ZazzClaude"
payload = {
  "number": jid,
  "textMessage": {
    "text": "Teste simples do bot"
  }
}
req = urllib.request.Request(url, data=json.dumps(payload).encode(), headers={'apikey': 'REDACTED-EVO-KEY', 'Content-Type': 'application/json'})
try:
    with urllib.request.urlopen(req) as resp:
        print(resp.read().decode())
except Exception as e:
    print(f"Erro: {e}")
