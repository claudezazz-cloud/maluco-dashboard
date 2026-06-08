import urllib.request
import json
import urllib.error

url = 'https://api.anthropic.com/v1/models'
headers = {
    'x-api-key': 'REDACTED-ANTHROPIC-KEY',
    'anthropic-version': '2023-06-01'
}

req = urllib.request.Request(url, headers=headers, method='GET')
try:
    with urllib.request.urlopen(req) as response:
        print("Status:", response.status)
        print("Body:", response.read().decode('utf-8'))
except urllib.error.HTTPError as e:
    print("HTTP Error:", e.code)
    print("Error Body:", e.read().decode('utf-8'))
