import urllib.request, json
url = "https://lanlunar-evolution.cloudfy.live/message/sendText/ZazzClaude"
payload = {
  "number": "128363409735124488@g.us",
  "text": "Teste simples de conexão do Maluco da IA! 👽"
}
req = urllib.request.Request(url, data=json.dumps(payload).encode(), headers={'apikey': 'REDACTED-EVO-KEY', 'Content-Type': 'application/json'})
try:
    with urllib.request.urlopen(req) as resp:
        print(resp.read().decode())
except Exception as e:
    print(f"Erro: {e}")
