#!/bin/bash
# Deploy da dashboard para o servidor Hostinger
# Execute: bash deploy.sh

SERVER="root@195.200.7.239"
DIR="/opt/zazz/dashboard"

echo "==> Fazendo deploy para $SERVER..."

ssh "$SERVER" "
  set -e
  cd $DIR
  echo '==> git pull...'
  git pull origin main
  echo '==> npm install (se houver novos pacotes)...'
  npm install
  echo '==> npm run build...'
  npm run build
  echo '==> pm2 restart...'
  pm2 restart dashboard --update-env
  echo '==> Status:'
  pm2 status dashboard
  echo ''
  echo 'Deploy concluido!'
"
