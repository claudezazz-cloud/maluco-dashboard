import urllib.request
import json
import urllib.error

url = 'https://api.anthropic.com/v1/messages'
headers = {
    'x-api-key': 'REDACTED-ANTHROPIC-KEY',
    'anthropic-version': '2023-06-01',
    'content-type': 'application/json'
}
data = {
    'model': 'claude-3-5-haiku-20241022',
    'max_tokens': 10,
    'messages': [
        {'role': 'user', 'content': 'Hello'}
    ]
}

req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), headers=headers, method='POST')
try:
    with urllib.request.urlopen(req) as response:
        print("Status:", response.status)
        print("Body:", response.read().decode('utf-8'))
except urllib.error.HTTPError as e:
    print("HTTP Error:", e.code)
    print("Error Body:", e.read().decode('utf-8'))
