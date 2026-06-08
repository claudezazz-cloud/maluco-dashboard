import urllib.request
import json
import time

url = "https://n8n.srv1537041.hstgr.cloud/webhook/whatsapp"
payload = {
    "event": "messages.upsert",
    "data": {
        "key": {
            "id": "teste-bot-" + str(int(time.time())),
            "remoteJid": "554384924456-1616013394@g.us",
            "fromMe": False,
        },
        "message": {
            "extendedTextMessage": {
                "text": "@554396543242 Está reclamando da internet/oferecer upgrade\nMarilza Cruz Dos Santos\n25/05/2026\nDisse que a internet está lento e não está pegando direito",
                "contextInfo": {"mentionedJid": ["554396543242@s.whatsapp.net"]},
            }
        },
        "messageTimestamp": int(time.time()),
        "pushName": "Franquelin Tester",
    }
}

req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers={'Content-Type': 'application/json'})
try:
    with urllib.request.urlopen(req) as response:
        print("Webhook response:", response.read().decode('utf-8'))
except Exception as e:
    print("Error:", e)
