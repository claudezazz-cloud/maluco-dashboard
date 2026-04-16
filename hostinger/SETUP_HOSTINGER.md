# Setup Completo - Hostinger VPS

## Pre-requisitos
- Conta Hostinger com VPS (minimo KVM 2 - 8GB RAM)
- Um dominio apontado para o IP do VPS
- Acesso SSH ao VPS

---

## PASSO 1: Comprar e acessar o VPS

1. No painel Hostinger, va em **VPS Hosting**
2. Escolha plano **KVM 2** (8GB RAM, 2 vCPU) ou superior
3. Na instalacao, escolha **Ubuntu 22.04** como sistema operacional
4. Anote o **IP do servidor** e a **senha root**
5. Acesse via SSH:
```bash
ssh root@SEU_IP_AQUI
```

---

## PASSO 2: Configurar DNS

No painel do seu dominio (Hostinger ou onde registrou):

1. Crie um registro **A** apontando para o IP do VPS:
   - `n8n.seudominio.com.br` -> IP do VPS (para N8N)
   - `painel.seudominio.com.br` -> IP do VPS (para Dashboard)

2. Aguarde propagacao DNS (5-30 minutos)

3. Teste:
```bash
ping n8n.seudominio.com.br
```

---

## PASSO 3: Instalar Docker no VPS

Conecte via SSH e execute:

```bash
# Atualizar sistema
apt update && apt upgrade -y

# Instalar Docker
curl -fsSL https://get.docker.com | sh

# Instalar Docker Compose
apt install docker-compose-plugin -y

# Verificar instalacao
docker --version
docker compose version
```

---

## PASSO 4: Criar estrutura do projeto

```bash
# Criar pasta do projeto
mkdir -p /opt/claudebot
cd /opt/claudebot
```

---

## PASSO 5: Enviar arquivos para o VPS

**No seu PC (PowerShell):**

```powershell
# Enviar pasta hostinger
scp -r "d:\N8N ClaudeBot Versao 5\hostinger\*" root@SEU_IP:/opt/claudebot/

# Enviar pasta dashboard
scp -r "d:\N8N ClaudeBot Versao 5\dashboard" root@SEU_IP:/opt/claudebot/
```

**Ou use o FileZilla:**
1. Conecte via SFTP (IP, porta 22, usuario root)
2. Copie a pasta `hostinger/` para `/opt/claudebot/`
3. Copie a pasta `dashboard/` para `/opt/claudebot/`

A estrutura final deve ser:
```
/opt/claudebot/
  docker-compose.yml
  Dockerfile.dashboard
  nginx.conf
  .env.example
  .env          (voce vai criar)
  dashboard/
    package.json
    app/
    lib/
    ...
```

---

## PASSO 6: Configurar variaveis de ambiente

```bash
cd /opt/claudebot

# Copiar template
cp .env.example .env

# Editar com seus valores
nano .env
```

Preencha:
- `DOMAIN` = seu dominio (ex: `n8n.seudominio.com.br`)
- `POSTGRES_PASSWORD` = senha forte (ex: `MinhaSenha$ecreta2026`)
- `N8N_PASSWORD` = senha do painel N8N
- `JWT_SECRET` = string aleatoria longa (gere com: `openssl rand -hex 32`)

Salve: `Ctrl+O`, `Enter`, `Ctrl+X`

---

## PASSO 7: Configurar Nginx com seu dominio

```bash
# Trocar placeholder pelo seu dominio
sed -i 's/SEU_DOMINIO_AQUI/n8n.seudominio.com.br/g' nginx.conf
```

---

## PASSO 8: Gerar certificado SSL (primeira vez)

Antes do Nginx funcionar com HTTPS, precisamos gerar o certificado.

```bash
# 1. Iniciar apenas Nginx em modo HTTP temporario
# Crie um nginx temporario
cat > /tmp/nginx-temp.conf << 'EOF'
events { worker_connections 1024; }
http {
    server {
        listen 80;
        server_name _;
        location /.well-known/acme-challenge/ { root /var/www/certbot; }
        location / { return 200 'OK'; }
    }
}
EOF

# 2. Criar pasta para certbot
mkdir -p /opt/claudebot/certbot-www

# 3. Rodar nginx temporario
docker run -d --name nginx-temp \
  -p 80:80 \
  -v /tmp/nginx-temp.conf:/etc/nginx/nginx.conf:ro \
  -v /opt/claudebot/certbot-www:/var/www/certbot \
  nginx:alpine

# 4. Gerar certificado (troque pelo seu dominio e email)
docker run --rm \
  -v /opt/claudebot/certbot-data:/etc/letsencrypt \
  -v /opt/claudebot/certbot-www:/var/www/certbot \
  certbot/certbot certonly --webroot \
  --webroot-path=/var/www/certbot \
  -d n8n.seudominio.com.br \
  -d painel.seudominio.com.br \
  --email seu@email.com \
  --agree-tos --no-eff-email

# 5. Parar nginx temporario
docker rm -f nginx-temp
```

Se o certificado foi gerado com sucesso, voce vera:
```
Congratulations! Your certificate and chain have been saved
```

---

## PASSO 9: Subir tudo com Docker Compose

```bash
cd /opt/claudebot

# Subir todos os servicos
docker compose up -d

# Verificar se todos estao rodando
docker compose ps

# Ver logs em tempo real
docker compose logs -f
```

Deve mostrar 5 containers rodando:
- postgres (healthy)
- redis (healthy)
- n8n (running)
- dashboard (running)
- nginx (running)

---

## PASSO 10: Configurar N8N

1. Acesse `https://n8n.seudominio.com.br`
2. Login com usuario/senha do .env
3. **Importante:** Va em Settings > API > Create API Key
4. Copie a API Key e coloque no `.env` como `N8N_API_KEY`
5. Reinicie o dashboard:
```bash
docker compose restart dashboard
```

---

## PASSO 11: Inicializar Dashboard

1. Acesse `https://painel.seudominio.com.br`
2. Na primeira vez, acesse `https://painel.seudominio.com.br/api/setup` no navegador
3. Deve retornar: `{"ok": true, "message": "Setup concluido"}`
4. Login com admin@maluco.ia / admin123 (ou o que configurou no .env)

---

## PASSO 12: Configurar credenciais no N8N

No N8N, va em **Credentials** e crie:

### PostgreSQL (postgres_claudebot)
- Host: `postgres` (nome do container, NAO localhost)
- Port: `5432`
- Database: `claudebot`
- User: `claudebot`
- Password: (a senha do .env)
- SSL: Desativado

### Redis (redis_claudebot)
- Host: `redis` (nome do container)
- Port: `6379`
- Password: (vazio)

---

## PASSO 13: Importar Workflow

1. No N8N, va em **Workflows > Import from file**
2. Importe o `workflow_v2.json`
3. **IMPORTANTE:** Atualize as credenciais em CADA node:
   - Todos os nodes Postgres: trocar para `postgres_claudebot`
   - Todos os nodes Redis: trocar para `redis_claudebot`
4. O webhook URL mudara para: `https://n8n.seudominio.com.br/webhook/...`
5. Atualize a URL do webhook na **Evolution API** (WhatsApp)

---

## PASSO 14: Configurar Evolution API

Na Evolution API, atualize o webhook da instancia ZazzClaude:
- Webhook URL: `https://n8n.seudominio.com.br/webhook/SEU_WEBHOOK_PATH`

---

## PASSO 15: Reverter os truncamentos de memoria

Agora que voce tem 8GB de RAM, pode reverter os limites agressivos:

No `workflow_v2.json`, antes de importar, voce pode:
- Busca POPs: voltar `LIMIT 10` para `LIMIT 30`
- POPs conteudo: voltar para `LEFT(conteudo, 5000)` e `substring(0, 5000)`
- System prompt: voltar para `40000`
- Chamados: remover o `.substring(0, 8000)` (sem limite)
- Redis history: voltar para `.slice(-20)` e `.slice(-8)` -> `.slice(-10)`
- Orçamento 20KB: pode remover ou aumentar para 80000

**Ou simplesmente use o workflow como esta** - os limites nao atrapalham, so protegem.

---

## Comandos uteis

```bash
# Ver status dos containers
docker compose ps

# Ver logs de um servico
docker compose logs -f n8n
docker compose logs -f dashboard

# Reiniciar um servico
docker compose restart n8n

# Parar tudo
docker compose down

# Atualizar N8N para ultima versao
docker compose pull n8n
docker compose up -d n8n

# Backup do banco
docker exec postgres pg_dump -U claudebot claudebot > backup_$(date +%Y%m%d).sql

# Restaurar backup
cat backup.sql | docker exec -i postgres psql -U claudebot claudebot

# Ver uso de memoria
docker stats
```

---

## Renovacao SSL automatica

O container `certbot` renova automaticamente a cada 12 horas.
Para forcar renovacao manual:

```bash
docker compose run --rm certbot renew
docker compose restart nginx
```

---

## Troubleshooting

### Container nao sobe
```bash
docker compose logs nome_do_servico
```

### N8N nao conecta no Postgres
- Verifique se o Postgres esta healthy: `docker compose ps`
- Use `postgres` como host (nao `localhost`)

### Dashboard nao conecta
- Verifique se chamou `/api/setup` pelo menos uma vez
- Verifique as variaveis de ambiente: `docker compose exec dashboard env`

### Webhook nao recebe mensagens
- Verifique se o DNS esta propagado
- Verifique se o SSL esta ativo
- Atualize a URL do webhook na Evolution API
