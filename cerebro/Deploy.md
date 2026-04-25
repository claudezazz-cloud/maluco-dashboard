# Deploy

← volta para [[Maluco da IA]] | infra em [[Infraestrutura]]

Dois caminhos: **Dashboard** (Next.js + PM2) e **Workflow N8N** (API/scripts).

## Dashboard

### Automatizado
```bash
bash deploy.sh
```
Faz: `git pull` + `npm install` + `npm run build` + `pm2 restart`.

### Manual
```bash
ssh root@195.200.7.239
cd /opt/zazz/dashboard
git pull origin main
npm install
npm run build
pm2 restart maluco-dashboard --update-env
```

Ver [[Dashboard]] para variáveis de ambiente necessárias.

## Workflow N8N

### Via interface web
1. Editar `workflow_v2.json` localmente
2. No painel N8N: **Import from file** → selecionar o arquivo
3. Configurar credentials (PostgreSQL, Redis)
4. **Importante**: chaves `x-api-key` de nós HTTP que chamam a Anthropic vão em **Authentication > Generic Credential Type > Header Auth** (não no campo direto, GitHub bloqueia push com segredo no código)
5. Ativar o workflow

### Via scripts Python (mais usado)
Existem diversos `fix_*.py` na raiz que batem na API do N8N:

```python
# Padrão:
wf = req("GET", f"/workflows/{WF_ID}")
# ...modifica wf...
req("PUT", f"/workflows/{WF_ID}", clean)
req("POST", f"/workflows/{WF_ID}/deactivate")
time.sleep(1)
req("POST", f"/workflows/{WF_ID}/activate")  # recarrega cache de código
```

O deactivate/activate é **obrigatório** porque o N8N tem cache interno de `jsCode` dos nós de código.

### Filtro de settings

O N8N rejeita PUT se `settings` tiver propriedades extras. Use sempre:

```python
ALLOWED = {"executionOrder","saveDataErrorExecution","saveDataSuccessExecution",
           "saveManualExecutions","saveExecutionProgress","timezone",
           "errorWorkflow","callerPolicy","executionTimeout"}
wf['settings'] = {k: v for k, v in wf['settings'].items() if k in ALLOWED}
```

## Configurações obrigatórias de nós

Ver [[Workflow N8N]] → seção "Nós com configurações obrigatórias".

## Setup inicial

Rodar o nó **SETUP** uma vez para criar a coluna `tipo_atendimento` em `mensagens` (ver [[Banco de Dados]]).
