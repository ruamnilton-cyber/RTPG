#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy.sh – Instala e atualiza o RTPG Gestão em uma instância Lightsail
# (Ubuntu 22.04 / 24.04)
#
# Uso (primeira vez):
#   chmod +x deploy.sh
#   GITHUB_REPO=https://github.com/SEU_USUARIO/rtpg-gestao.git bash deploy.sh
#
# Uso (atualizar):
#   bash /opt/rtpg-app/deploy.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e

APP_DIR="/opt/rtpg-app"
DATA_DIR="/opt/rtpg-data"
SERVICE_USER="${SUDO_USER:-$USER}"

echo "═══════════════════════════════════════════"
echo "  RTPG Gestão – Deploy para Lightsail"
echo "═══════════════════════════════════════════"

# ── 1. Dependências do sistema ───────────────────────────────────────────────
echo ""
echo "▶ Instalando dependências do sistema..."
sudo apt-get update -qq
sudo apt-get install -y curl git python3 nginx

# Node.js 20
if ! command -v node &>/dev/null || [[ "$(node -v)" != v20* ]]; then
  echo "  → Instalando Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - -qq
  sudo apt-get install -y nodejs
fi
echo "  Node.js: $(node -v)"

# PM2
if ! command -v pm2 &>/dev/null; then
  echo "  → Instalando PM2..."
  sudo npm install -g pm2 --quiet
fi
echo "  PM2: $(pm2 -v)"

# ── 2. Código-fonte ──────────────────────────────────────────────────────────
echo ""
echo "▶ Atualizando código-fonte..."
if [ -d "$APP_DIR/.git" ]; then
  cd "$APP_DIR"
  git pull --rebase
else
  REPO="${GITHUB_REPO:-}"
  if [ -z "$REPO" ]; then
    echo "  ERRO: defina GITHUB_REPO=https://github.com/USUARIO/REPO.git"
    exit 1
  fi
  sudo git clone "$REPO" "$APP_DIR"
  sudo chown -R "$SERVICE_USER":"$SERVICE_USER" "$APP_DIR"
  cd "$APP_DIR"
fi

# ── 3. Diretório de dados persistente ───────────────────────────────────────
echo ""
echo "▶ Preparando diretório de dados em $DATA_DIR..."
sudo mkdir -p "$DATA_DIR/storage"
sudo chown -R "$SERVICE_USER":"$SERVICE_USER" "$DATA_DIR"

# ── 4. Variáveis de ambiente ─────────────────────────────────────────────────
if [ ! -f "$APP_DIR/.env" ]; then
  echo ""
  echo "▶ Criando .env a partir do .env.example..."
  cp "$APP_DIR/.env.example" "$APP_DIR/.env"

  # Gera JWT_SECRET aleatório
  JWT=$(openssl rand -hex 32)
  sed -i "s|mude-isso-para-uma-string-segura-em-producao|$JWT|g" "$APP_DIR/.env"
  echo "  JWT_SECRET gerado automaticamente."
  echo "  ATENÇÃO: revise o arquivo $APP_DIR/.env antes de continuar."
fi

# Carrega variáveis
set -o allexport
# shellcheck source=/dev/null
source "$APP_DIR/.env"
set +o allexport

# ── 5. Dependências Node ─────────────────────────────────────────────────────
echo ""
echo "▶ Instalando dependências Node..."
cd "$APP_DIR"
npm install --include=dev --quiet

# ── 6. Banco de dados ────────────────────────────────────────────────────────
echo ""
echo "▶ Inicializando banco de dados..."
RTPG_DATA_DIR="$DATA_DIR" node scripts/prisma-runner.mjs generate
RTPG_DATA_DIR="$DATA_DIR" python3 scripts/bootstrap_db.py

# Seed somente na primeira vez (banco vazio)
DB_FILE="$DATA_DIR/storage/rtpg.sqlite"
if [ -f "$DB_FILE" ] && [ "$(sqlite3 "$DB_FILE" 'SELECT COUNT(*) FROM User;' 2>/dev/null)" = "0" ]; then
  echo "  → Aplicando seed inicial..."
  RTPG_DATA_DIR="$DATA_DIR" node scripts/prisma-runner.mjs db seed
elif [ ! -f "$DB_FILE" ]; then
  echo "  → Aplicando seed inicial..."
  RTPG_DATA_DIR="$DATA_DIR" node scripts/prisma-runner.mjs db seed
fi

# ── 7. Build do frontend ─────────────────────────────────────────────────────
echo ""
echo "▶ Gerando build do frontend..."
npm run build

# ── 8. PM2 ───────────────────────────────────────────────────────────────────
echo ""
echo "▶ Iniciando/reiniciando serviço com PM2..."
if pm2 list | grep -q "rtpg"; then
  pm2 reload rtpg --update-env
else
  pm2 start ecosystem.config.cjs --env production
fi
pm2 save

# Configura PM2 para iniciar com o sistema (somente na primeira vez)
if ! systemctl is-enabled pm2-"$SERVICE_USER" &>/dev/null 2>&1; then
  sudo env PATH="$PATH:/usr/bin" pm2 startup systemd -u "$SERVICE_USER" --hp "$HOME" | tail -1 | bash || true
  pm2 save
fi

# ── 9. Nginx ─────────────────────────────────────────────────────────────────
NGINX_CONF="/etc/nginx/sites-available/rtpg"
if [ ! -f "$NGINX_CONF" ]; then
  echo ""
  echo "▶ Configurando Nginx..."

  DOMAIN="${DOMAIN:-_}"  # use _ como fallback (aceita qualquer domínio)
  sudo tee "$NGINX_CONF" > /dev/null <<NGINX
server {
    listen 80;
    server_name $DOMAIN;

    client_max_body_size 20M;

    location / {
        proxy_pass         http://127.0.0.1:3333;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade \$http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
NGINX

  sudo ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/rtpg
  sudo rm -f /etc/nginx/sites-enabled/default
  sudo nginx -t && sudo systemctl reload nginx
  echo "  Nginx configurado para domínio: $DOMAIN"
  echo ""
  echo "  Para HTTPS com Let's Encrypt:"
  echo "    sudo apt install certbot python3-certbot-nginx"
  echo "    sudo certbot --nginx -d $DOMAIN"
fi

echo ""
echo "═══════════════════════════════════════════"
echo "  Deploy concluído!"
echo "  Acesse: http://$(curl -s ifconfig.me 2>/dev/null || echo 'IP_LIGHTSAIL'):3333"
echo "  Ou pelo seu domínio configurado no Route 53."
echo ""
echo "  Usuário inicial: admin@rtpg.local"
echo "  Senha inicial:   admin123"
echo "═══════════════════════════════════════════"
