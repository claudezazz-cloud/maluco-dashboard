import urllib.request
req = urllib.request.Request('https://lanlunar-evolution.cloudfy.live/instance/fetchInstances', headers={'apikey':'REDACTED-EVO-KEY'})
try:
    with urllib.request.urlopen(req) as response:
        print(response.read().decode())
except Exception as e:
    print(f"Error: {e}")
