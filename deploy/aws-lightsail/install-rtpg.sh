#!/usr/bin/env bash
set -euo pipefail

APP_DOMAIN="${APP_DOMAIN:-rtpgapp.com}"
APP_REPO="${APP_REPO:-https://github.com/ruamnilton-cyber/profeng.git}"
APP_BRANCH="${APP_BRANCH:-codex/rtpg-transfer}"
APP_DIR="${APP_DIR:-/opt/rtpg-app}"
DATA_DIR="${DATA_DIR:-/opt/rtpg-data}"
APP_PORT="${APP_PORT:-3333}"

if [ "$(id -u)" -eq 0 ]; then
  echo "Execute como usuario normal com sudo disponivel, nao como root."
  exit 1
fi

echo "==> Instalando pacotes de sistema"
sudo apt-get update
sudo apt-get install -y ca-certificates curl git nginx python3 build-essential

if ! command -v node >/dev/null 2>&1 || ! node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 20 ? 0 : 1)"; then
  echo "==> Instalando Node.js 20"
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

echo "==> Instalando PM2"
sudo npm install -g pm2

echo "==> Preparando diretorios persistentes"
sudo mkdir -p "$DATA_DIR"
sudo chown -R "$USER":"$USER" "$DATA_DIR"

if [ -d "$APP_DIR/.git" ]; then
  echo "==> Atualizando repositorio existente"
  git -C "$APP_DIR" fetch origin "$APP_BRANCH"
  git -C "$APP_DIR" checkout "$APP_BRANCH"
  git -C "$APP_DIR" pull --ff-only origin "$APP_BRANCH"
else
  echo "==> Clonando repositorio"
  if [ -e "$APP_DIR" ]; then
    BACKUP_DIR="${APP_DIR}.backup.$(date +%Y%m%d-%H%M%S)"
    echo "Pasta existente encontrada em $APP_DIR. Movendo para $BACKUP_DIR."
    sudo mv "$APP_DIR" "$BACKUP_DIR"
  fi
  sudo mkdir -p "$APP_DIR"
  sudo chown -R "$USER":"$USER" "$APP_DIR"
  git clone --branch "$APP_BRANCH" "$APP_REPO" "$APP_DIR"
fi

cd "$APP_DIR"

echo "==> Criando .env de producao"
cat > .env <<ENV
NODE_ENV=production
PORT=$APP_PORT
RTPG_DATA_DIR=$DATA_DIR
APP_BASE_URL=https://$APP_DOMAIN
SAAS_TRIAL_DAYS=3
SAAS_PIX_KEY=
SAAS_PIX_RECIPIENT_NAME=RTPG GESTAO
SAAS_PIX_CITY=RIO DE JANEIRO
SAAS_CARD_CHECKOUT_URL=
SAAS_BILLING_WEBHOOK_SECRET=
OPENAI_API_KEY=
OPENAI_MENU_IMPORT_MODEL=gpt-4.1-mini
ENV

echo "==> Instalando dependencias e compilando"
npm ci
npm run db:generate
RTPG_DATA_DIR="$DATA_DIR" npm run db:push
RTPG_DATA_DIR="$DATA_DIR" APP_BASE_URL="https://$APP_DOMAIN" npm run build

echo "==> Subindo app com PM2"
pm2 delete rtpg >/dev/null 2>&1 || true
pm2 start ecosystem.config.cjs
pm2 save

echo "==> Habilitando PM2 no boot"
PM2_STARTUP_CMD="$(pm2 startup systemd -u "$USER" --hp "$HOME" | tail -n 1 || true)"
if echo "$PM2_STARTUP_CMD" | grep -q "sudo"; then
  eval "$PM2_STARTUP_CMD"
fi
pm2 save

echo "==> Configurando Nginx"
sudo tee /etc/nginx/sites-available/rtpgapp.com >/dev/null <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name $APP_DOMAIN www.$APP_DOMAIN;

    client_max_body_size 20M;

    location / {
        proxy_pass http://127.0.0.1:$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
NGINX

sudo ln -sf /etc/nginx/sites-available/rtpgapp.com /etc/nginx/sites-enabled/rtpgapp.com
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl reload nginx

echo "==> Testando healthcheck local"
curl -fsS "http://127.0.0.1:$APP_PORT/api/health"
echo
echo "RTPG instalado. Aponte o DNS A de $APP_DOMAIN e www.$APP_DOMAIN para o IP estatico da instancia."
