#!/usr/bin/env bash
set -euo pipefail

APP_DOMAIN="${APP_DOMAIN:-rtpgapp.com}"

echo "==> Instalando Certbot"
sudo apt-get update
sudo apt-get install -y certbot python3-certbot-nginx

echo "==> Emitindo certificado SSL"
sudo certbot --nginx -d "$APP_DOMAIN" -d "www.$APP_DOMAIN" --redirect

echo "==> Testando renovacao automatica"
sudo certbot renew --dry-run
