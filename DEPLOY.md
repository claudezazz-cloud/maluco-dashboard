# Deploy no CloudFy

## 1. Copiar arquivos para o servidor
Suba a pasta `dashboard/` para o servidor CloudFy via SFTP ou Git.

## 2. Criar arquivo .env
```bash
cp .env.example .env
nano .env
```
Preencha com os dados reais do banco, N8N API key e JWT secret.

## 3. Instalar dependências e buildar
```bash
npm install
npm run build
```

## 4. Inicializar o banco de dados
Acesse no navegador:
```
https://seu-dominio/api/setup
```
Isso cria as tabelas e o usuário admin.

## 5. Iniciar com PM2
```bash
pm2 start ecosystem.config.js
pm2 save
```

## 6. Configurar domínio/proxy no CloudFy
No painel CloudFy, apontar o subdomínio (ex: `dashboard.suaempresa.com.br`) para a porta `3001`.

## Credenciais padrão
- Email: valor de `ADMIN_EMAIL` no .env
- Senha: valor de `ADMIN_PASSWORD` no .env

## Após primeiro acesso
Mude a senha no painel e proteja ou delete a rota `/api/setup`.
