#!/usr/bin/env bash
set -euo pipefail

APP_BRANCH="${APP_BRANCH:-main}"
APP_DIR="${APP_DIR:-/opt/rtpg-app}"
DATA_DIR="${DATA_DIR:-/opt/rtpg-data}"

echo "==> Atualizando codigo"
git -C "$APP_DIR" fetch origin "$APP_BRANCH"
git -C "$APP_DIR" checkout "$APP_BRANCH"
git -C "$APP_DIR" reset --hard "origin/$APP_BRANCH"

cd "$APP_DIR"

echo "==> Instalando dependencias"
npm install --production=false

echo "==> Migrando banco de dados"
RTPG_DATA_DIR="$DATA_DIR" npm run db:push

echo "==> Compilando frontend"
RTPG_DATA_DIR="$DATA_DIR" npm run build

echo "==> Reiniciando app"
# Kill any orphaned tsx child processes before reloading (prevents EADDRINUSE crash loop)
OLD_PIDS=$(lsof -i :${PORT:-3333} -t 2>/dev/null || true)
if [ -n "$OLD_PIDS" ]; then
  echo "Killing orphaned processes on port ${PORT:-3333}: $OLD_PIDS"
  kill -9 $OLD_PIDS 2>/dev/null || true
  sleep 1
fi
pm2 restart rtpg --update-env || pm2 start scripts/start.mjs --name rtpg --interpreter node

echo "==> Deploy concluido"
curl -fsS "http://127.0.0.1:3333/api/health"
echo
