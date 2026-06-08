import urllib.request, json
req = urllib.request.Request('https://evolution.srv1537041.hstgr.cloud/group/fetchAllGroups/Telegram-Whatsapp?getParticipants=false', headers={'apikey':'ZazzEvolution2026!'})
try:
    with urllib.request.urlopen(req, timeout=10) as response:
        groups = json.loads(response.read().decode())
        for g in groups:
            print(f"Group: {g.get('subject')} -> {g.get('id')}")
except Exception as e:
    print(f"Error: {e}")
