"""
reverter_status_parado.py — Reverte pedidos alterados de "Parado" → "Ok" nas últimas 15h de volta para "Parado".

Uso:
  python reverter_status_parado.py

Edite NOTION_TOKEN abaixo ou defina a variável de ambiente NOTION_TOKEN.
"""
import os, json, urllib.request, urllib.error
from datetime import datetime, timezone, timedelta

NOTION_TOKEN = os.getenv("NOTION_TOKEN", "SEU_TOKEN_AQUI")
DATABASE_ID  = "d54e5911e8af43dfaed8f2893e59f6ef"

HEADERS = {
    "Authorization": f"Bearer {NOTION_TOKEN}",
    "Content-Type": "application/json",
    "Notion-Version": "2022-06-28",
}

# Janela: entre 14h e 16h atrás (cobre os "15 horas atrás" da UI do Notion)
NOW        = datetime.now(timezone.utc)
AFTER_DT   = NOW - timedelta(hours=16)
BEFORE_DT  = NOW - timedelta(hours=14)

def notion_req(method, path, body=None):
    url  = f"https://api.notion.com/v1{path}"
    data = json.dumps(body).encode() if body else None
    req  = urllib.request.Request(url, data=data, headers=HEADERS, method=method)
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        print(f"  HTTP {e.code}: {e.read().decode()[:400]}")
        raise

def buscar_paginas_ok():
    """Busca páginas com status = Ok, paginando até esgotar."""
    pages, cursor = [], None
    while True:
        body = {
            "page_size": 100,
            "filter": {
                "property": "status",
                "select": {"equals": "Ok"}
            }
        }
        if cursor:
            body["start_cursor"] = cursor
        resp = notion_req("POST", f"/databases/{DATABASE_ID}/query", body)
        pages.extend(resp.get("results", []))
        if not resp.get("has_more"):
            break
        cursor = resp.get("next_cursor")
    return pages

def dentro_janela(page):
    """Verifica se last_edited_time está dentro da janela 14-16h atrás."""
    raw = page.get("last_edited_time", "")
    if not raw:
        return False
    try:
        dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        return AFTER_DT <= dt <= BEFORE_DT
    except Exception:
        return False

def reverter_para_parado(page_id, titulo):
    notion_req("PATCH", f"/pages/{page_id}", {
        "properties": {
            "status": {
                "select": {"name": "Parado"}
            }
        }
    })
    print(f"  [OK] Revertido para Parado: {titulo}")

def titulo_pagina(page):
    for prop in page.get("properties", {}).values():
        if prop.get("type") == "title":
            parts = prop.get("title", [])
            return "".join(p.get("plain_text", "") for p in parts) or "(sem título)"
    return page.get("id", "")

def main():
    if NOTION_TOKEN == "SEU_TOKEN_AQUI":
        print("❌ Defina NOTION_TOKEN no script ou como variável de ambiente.")
        return

    print(f"Janela de busca: {AFTER_DT.strftime('%d/%m %H:%M')} ate {BEFORE_DT.strftime('%d/%m %H:%M')} UTC")
    print("Buscando páginas com status = Ok...")
    pages = buscar_paginas_ok()
    print(f"  {len(pages)} páginas com status Ok encontradas")

    candidatas = [p for p in pages if dentro_janela(p)]
    print(f"  {len(candidatas)} foram editadas na janela de 15h atrás")

    if not candidatas:
        print("Nenhuma página para reverter.")
        return

    print(f"\nRevertendo {len(candidatas)} página(s):")
    for page in candidatas:
        titulo = titulo_pagina(page)
        edited = page.get("last_edited_time", "")
        print(f"  - {titulo}  (editado: {edited})")

    confirm = input(f"\nConfirmar reversão de {len(candidatas)} página(s) para 'Parado'? [s/N] ").strip().lower()
    if confirm != 's':
        print("Cancelado.")
        return

    revertidos = 0
    for page in candidatas:
        try:
            reverter_para_parado(page["id"], titulo_pagina(page))
            revertidos += 1
        except Exception as e:
            print(f"  [ERRO] {page['id']}: {e}")

    print(f"\n✅ {revertidos}/{len(candidatas)} páginas revertidas para 'Parado'.")

if __name__ == "__main__":
    main()
