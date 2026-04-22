# Routerbox Auto-Export

Script Playwright que loga no Routerbox, exporta o XLSX de chamados em aberto, e envia pro dashboard. Pensado pra rodar via cron de hora em hora.

## Por que existe

A Routerbox não libera API (alegação: multi-tenancy). Como `routerbox.zazzinternet.com` é nosso subdomínio, scraping headless é a alternativa segura — dura ~1min e elimina o trabalho manual de exportar planilha 8x ao dia.

Custo: zero (Playwright + cron). Risco: o layout do Routerbox pode mudar — o script tem screenshots automáticos pra debug.

## Arquitetura

```
[Cron VPS — toda hora]
   ↓
[scrape.js — Playwright headless]
   1. Abre RB_LOGIN_URL
   2. Login (RB_USER/RB_PASS)
   3. /app_menu/app_menu.php?menu=atendimentos
   4. Botões → Excel (intercepta download)
   5. Parse XLSX local (mesma lógica do frontend)
   6. POST {headers, chamados} → DASHBOARD_URL/api/chamados/auto-import
      Header: x-auto-token: $CHAMADOS_AUTO_TOKEN
   ↓
[Endpoint /api/chamados/auto-import]
   ↓
[Redis chamados:data atualizado — TTL 24h]
   ↓
[Bot já usa no próximo prompt — zero mudança no Workflow N8N]
```

## Deploy no VPS

### 1. Subir o código

```bash
ssh root@195.200.7.239
mkdir -p /opt/zazz/routerbox-auto
cd /opt/zazz/routerbox-auto
# copia scrape.js, package.json, .env.example via scp ou clona o repo
```

Se usar git submodule ou clone do repo principal, esses arquivos vivem em `routerbox-auto/`.

### 2. Instalar Node 20+ e dependências

```bash
node --version  # precisa ser >=18
npm install
npx playwright install chromium       # baixa o navegador (~150MB, 1x só)
npx playwright install-deps chromium  # libs do sistema (X libs etc)
```

### 3. Configurar `.env`

```bash
cp .env.example .env
nano .env
```

Preencher `RB_USER`, `RB_PASS`, `CHAMADOS_AUTO_TOKEN` (mesmo token configurado no dashboard).

**Recomendação:** crie um usuário dedicado no Routerbox tipo `bot.export` com permissão **só de leitura** dos atendimentos. Se a senha vazar, o estrago é mínimo.

### 4. Testar manualmente

```bash
# dry-run: faz tudo até parsear o XLSX, NÃO posta
DRY_RUN=1 HEADLESS=1 node scrape.js

# pleno (vai realmente atualizar o bot)
node scrape.js
```

Se falhar, olhe `screenshots/erro-*.png` pra ver onde travou.

### 5. Configurar cron

```bash
crontab -e
# Toda hora aos 5min (evita sobreposição com outros jobs)
5 * * * * cd /opt/zazz/routerbox-auto && /usr/bin/node scrape.js >> /var/log/routerbox-auto.log 2>&1
```

Logrotate (opcional):

```bash
cat > /etc/logrotate.d/routerbox-auto <<EOF
/var/log/routerbox-auto.log {
  weekly
  rotate 4
  compress
  missingok
  notifempty
}
EOF
```

### 6. Configurar token no dashboard

```bash
cd /opt/zazz/dashboard
echo "CHAMADOS_AUTO_TOKEN=mesmo-token-do-env" >> .env.local
pm2 restart maluco-dashboard --update-env
```

## Verificação

```bash
# Após cron rodar:
tail -f /var/log/routerbox-auto.log

# Status no dashboard:
curl -s https://dashboard.srv1537041.hstgr.cloud/api/chamados \
  -H "Cookie: auth_token=…"  # ou abre /chamados no browser

# Direto no Redis:
docker exec -it n8n-redis-1 redis-cli -a ZazzRedis2026! get chamados:data | head -c 300
```

## Quando o Routerbox mudar de layout

O script tem 3 pontos sensíveis:

1. **Login** (`scrape.js:login`): seletores tentam `input[name="usuario|user|login"]` e `input[name="senha|password|pass"]`. Se falhar, screenshot em `login-no-fields-*.png` mostra o HTML real — ajustar `userSel`/`passSel`.
2. **URL de Atendimentos**: hardcoded em `navegarParaAtendimentos`. Se mudar, atualizar.
3. **Botão Excel**: procura por texto `"Botões"` → `"Excel"`. Se mudar de label, ajustar locators.

Sempre rodar `DRY_RUN=1` após mexer pra garantir que o XLSX sai correto antes de postar no bot.

## Variáveis de ambiente

| Var | Default | Descrição |
|-----|---------|-----------|
| `RB_LOGIN_URL` | `https://routerbox.zazzinternet.com/routerbox/app_login/` | Página de login do Routerbox |
| `RB_USER` | — | Usuário (cria um dedicado tipo `bot.export`) |
| `RB_PASS` | — | Senha |
| `DASHBOARD_URL` | `https://dashboard.srv1537041.hstgr.cloud` | Base do dashboard |
| `CHAMADOS_AUTO_TOKEN` | `CHAMADOS_AUTO_2026` | Token do header `x-auto-token` |
| `HEADLESS` | `1` | `0` pra abrir o navegador (debug local) |
| `TIMEOUT_MS` | `120000` | Timeout por step (login, navegação, download) |
| `SCREENSHOT_ON_ERROR` | `1` | Salva PNG full-page em erro |
| `DRY_RUN` | `0` | `1` pra não postar no dashboard |
