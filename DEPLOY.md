# DEPLOY — Maluco da IA

Guia de referência para Claude Code fazer deploy do **workflow N8N** e da **dashboard Next.js** no servidor Hostinger VPS.

---

## Infraestrutura

| Item | Valor |
|------|-------|
| Servidor | Hostinger VPS KVM 2 |
| IP | `195.200.7.239` |
| SSH | `ssh root@195.200.7.239` |
| N8N | https://n8n.srv1537041.hstgr.cloud |
| Dashboard | https://dashboard.srv1537041.hstgr.cloud |
| Evolution API | https://evolution.srv1537041.hstgr.cloud |
| Workflow ID | `DiInHUnddtFACSmj` |

### Credenciais (em memória — não commitar)
- **N8N_API_KEY**: ver `fix_n8n_*.py` (JWT na constante `API_KEY`)
- **N8N_POPS_TOKEN**: `MALUCO_POPS_2026`
- **Redis password**: `ZazzRedis2026!`
- **Postgres**: usuário `zazz`, db `zazzdb`, container `n8n-postgres-1`

---

## 1. Deploy do Workflow N8N via API

### Padrão: editar nó específico e fazer PUT

O workflow tem ~50 nós. Sempre use o padrão abaixo (não sobrescreva o workflow inteiro a partir do arquivo local — ele pode estar desatualizado em relação ao deployado).

```python
#!/usr/bin/env python3
import json, urllib.request

API_KEY = "<JWT_TOKEN>"  # ver fix_n8n_*.py existentes
BASE = "https://n8n.srv1537041.hstgr.cloud/api/v1/workflows/DiInHUnddtFACSmj"

# 1) GET workflow atual
req = urllib.request.Request(BASE, headers={"X-N8N-API-KEY": API_KEY})
with urllib.request.urlopen(req) as resp:
    wf = json.loads(resp.read())

# 2) Modificar o nó desejado
for node in wf["nodes"]:
    if node["name"] == "Monta Prompt":   # ou outro nome de nó
        code = node["parameters"]["jsCode"]
        old = "TRECHO ANTIGO"
        new = "TRECHO NOVO"
        if old in code:
            node["parameters"]["jsCode"] = code.replace(old, new)
        else:
            print("FAIL: trecho nao encontrado")
            exit(1)
        break

# 3) PUT — filtrar campos permitidos
allowed = ["id", "name", "type", "typeVersion", "position", "parameters",
           "credentials", "disabled", "notes", "notesInFlow", "executeOnce",
           "alwaysOutputData", "retryOnFail", "maxTries", "waitBetweenTries",
           "continueOnFail", "onError"]
cleaned = [{k: v for k, v in n.items() if k in allowed} for n in wf["nodes"]]

payload = json.dumps({
    "name": wf["name"],
    "nodes": cleaned,
    "connections": wf["connections"],
    "settings": {}
}).encode()

req2 = urllib.request.Request(BASE, data=payload, method="PUT", headers={
    "X-N8N-API-KEY": API_KEY,
    "Content-Type": "application/json"
})
with urllib.request.urlopen(req2) as resp2:
    result = json.loads(resp2.read())
    print(f"DEPLOYED: {result.get('name')} | Active: {result.get('active')}")
```

### ⚠️ CRÍTICO: Forçar reload depois do PUT

**O N8N cacheia o código compilado do Code node.** Um PUT via API modifica o JSON mas o task runner continua executando a versão antiga. **Sempre** desativar e reativar o workflow depois de qualquer PUT que altere `jsCode`:

```python
# Após o PUT:
import time
urllib.request.urlopen(urllib.request.Request(
    BASE + "/deactivate", data=b"{}", method="POST",
    headers={"X-N8N-API-KEY": API_KEY, "Content-Type": "application/json"}
))
time.sleep(1)
urllib.request.urlopen(urllib.request.Request(
    BASE + "/activate", data=b"{}", method="POST",
    headers={"X-N8N-API-KEY": API_KEY, "Content-Type": "application/json"}
))
```

### Armadilhas de escaping (IMPORTANTE)

Ao editar `jsCode` via Python + JSON:

| Em Python string | Em JSON (after json.dump) | Em JS (runtime) | Uso |
|---|---|---|---|
| `"\\n"` (2 chars: `\` + `n`) | `"\\n"` | `"\n"` (quebra de linha JS) | ✅ **CORRETO** |
| `"\n"` (1 char: newline real) | `"\n"` (newline real no JSON) | quebra a string JS se estiver entre aspas simples | ❌ causa SyntaxError |
| `"\\\\n"` (3 chars) | `"\\\\n"` | `"\\n"` (barra literal + n) | ❌ não é newline |

**Regra:** dentro de strings JS com aspas simples, o escape deve ficar `\\n` no código Python.

### Verificar deploy

```python
# Ler código e checar marcadores
req = urllib.request.Request(BASE, headers={"X-N8N-API-KEY": API_KEY})
wf = json.loads(urllib.request.urlopen(req).read())
for node in wf["nodes"]:
    if node["name"] == "Monta Prompt":
        assert "TRECHO NOVO" in node["parameters"]["jsCode"]
        print("OK")
```

Verificar execução real em `/api/v1/executions/{id}?includeData=true`:

```python
url = "https://n8n.srv1537041.hstgr.cloud/api/v1/executions/<ID>?includeData=true"
req = urllib.request.Request(url, headers={"X-N8N-API-KEY": API_KEY})
data = json.loads(urllib.request.urlopen(req).read())
nodes = data["data"]["resultData"]["runData"]
# Verificar output de um nó específico
mp_out = nodes["Monta Prompt"][0]["data"]["main"][0][0]["json"]
print(mp_out.get("popsUsados"))
```

### Nós que NÃO podem perder configurações especiais

Ao editar estes nós, preservar `executeOnce: true`:
- `Busca POPs`, `Busca System Prompt`, `Busca Colaboradores`, `Busca Histórico 10`
- `Busca Histórico Redis`, `Busca Chamados Redis`, `Busca Clientes`, `Busca Regras`, `Busca Skills`

`Busca Regras` também precisa de `alwaysOutputData: true`.

---

## 2. Deploy da Dashboard

### Método automático (preferido)

Do Windows local:
```bash
bash deploy.sh        # do diretório raiz do projeto
# ou duplo-clique em deploy.bat
```

Isso executa no servidor:
```bash
cd /opt/zazz/dashboard
git pull origin main
npm install
npm run build
pm2 restart maluco-dashboard --update-env
```

### Método manual (SSH)

```bash
ssh root@195.200.7.239
cd /opt/zazz/dashboard
git pull origin main
npm install    # só se package.json mudou
npm run build
pm2 restart maluco-dashboard --update-env
pm2 status maluco-dashboard
pm2 logs maluco-dashboard --lines 50   # para debug
```

### Pré-requisitos antes do deploy

1. **Commitar e fazer push das mudanças locais** (o servidor faz `git pull`):
   ```bash
   git add dashboard/
   git commit -m "feat: ..."
   git push origin main
   ```
2. Se modificou `package.json`, rode `npm install` local antes para atualizar `package-lock.json`.
3. Se mudou env vars, atualize `.env` no servidor **antes** do build:
   ```bash
   ssh root@195.200.7.239 "nano /opt/zazz/dashboard/.env"
   ```

### Variáveis de ambiente (em `/opt/zazz/dashboard/.env`)

```
PG_URL=postgresql://zazz:<senha>@localhost:5432/zazzdb
REDIS_URL=redis://:ZazzRedis2026!@localhost:6379
JWT_SECRET=<secret>
N8N_URL=https://n8n.srv1537041.hstgr.cloud
N8N_API_KEY=<jwt>
N8N_POPS_TOKEN=MALUCO_POPS_2026
```

### Quando o PM2 restart não basta

Se mudou arquivos em `app/` mas as mudanças não aparecem:
```bash
pm2 delete maluco-dashboard
cd /opt/zazz/dashboard
npm run build
pm2 start ecosystem.config.js
pm2 save
```

---

## 3. Deploy do Docker Compose (Evolution, Postgres, Redis, N8N)

Arquivo: `/docker/n8n/docker-compose.yml` no servidor.

```bash
ssh root@195.200.7.239
cd /docker/n8n

# Sempre fazer backup antes
cp docker-compose.yml docker-compose.yml.bak.$(date +%s)

# Editar
nano docker-compose.yml

# Aplicar mudanças de um serviço específico (menos disruptivo)
docker compose up -d evolution    # só recria Evolution
# ou
docker compose up -d              # recria todos que mudaram

# Logs para validar
docker compose logs -f evolution --tail 100
```

### Restart sem mudar config (ex: limpar estado)

```bash
docker compose restart n8n
docker compose restart evolution
```

---

## 4. Checklist pós-deploy

Depois de qualquer deploy, validar:

**Dashboard:**
- [ ] `curl -I https://dashboard.srv1537041.hstgr.cloud` retorna 200/302
- [ ] `pm2 status maluco-dashboard` mostra `online`
- [ ] `pm2 logs maluco-dashboard --lines 20` sem erros de startup

**N8N workflow:**
- [ ] `active: true` no retorno do PUT
- [ ] Workflow desativado+reativado (força reload de jsCode)
- [ ] Enviar mensagem de teste no grupo WhatsApp
- [ ] Verificar última execução em `/api/v1/executions?workflowId=DiInHUnddtFACSmj&limit=1`
- [ ] Na página `/conversas`, a nova mensagem apareceu com `popsUsados` populado (quando aplicável)

---

## 5. Troubleshooting

| Sintoma | Causa provável | Fix |
|---------|----------------|-----|
| PUT retorna 200 mas execução usa código antigo | Task runner cacheou `jsCode` | Deactivate + activate via API |
| `SyntaxError: Invalid or unexpected token` no nó Code | `\n` literal dentro de string com aspas simples | Usar `\\n` no Python string |
| Dashboard retorna 502 | PM2 offline ou build falhou | `pm2 logs` → `pm2 restart` |
| `popsUsados` vazio em mensagem normal | `isListingPops` sendo ativado errado | Ver `Monta Prompt` linha ~174 |
| Bot responde "Não localizei POP" | POPs não injetados OU Haiku não mapeou chamado→POP | Verificar header de instrução em `Monta Prompt` linha ~186 |
| Scheduled task não dispara | Schedule Trigger desativado ou cron errado | Conferir `ativo=true` em `dashboard_solicitacoes_programadas` |

### Comandos úteis de diagnóstico

```bash
# Postgres direto
docker exec -it n8n-postgres-1 psql -U zazz -d zazzdb -c "SELECT id, mensagem, pops_usados, tokens_input FROM bot_conversas ORDER BY id DESC LIMIT 5;"

# Redis
docker exec -it n8n-redis-1 redis-cli -a ZazzRedis2026! KEYS 'conv:*'

# N8N logs
docker compose logs n8n --tail 100 -f

# Dashboard
pm2 logs maluco-dashboard --lines 100
```

---

## 6. Ordem recomendada em mudanças que tocam vários componentes

Exemplo: adicionar nova funcionalidade que precisa de dashboard + workflow:

1. **Dashboard primeiro** (git push → `bash deploy.sh`)
   - APIs novas precisam estar de pé antes do workflow bater nelas
2. **Validar dashboard** (checklist acima)
3. **Workflow depois** (PUT via Python + deactivate/activate)
4. **Testar ponta-a-ponta** no WhatsApp

Se inverter a ordem e o workflow rodar primeiro, ele vai dar 404 nas APIs novas e cair em erro.
