#!/usr/bin/env bash
set -euo pipefail

APP_BRANCH="${APP_BRANCH:-main}"
APP_DIR="${APP_DIR:-/opt/rtpg-app}"
DATA_DIR="${DATA_DIR:-/opt/rtpg-data}"

echo "==> Atualizando codigo"
git -C "$APP_DIR" fetch origin "$APP_BRANCH"
git -C "$APP_DIR" checkout "$APP_BRANCH"
git -C "$APP_DIR" pull --ff-only origin "$APP_BRANCH"

cd "$APP_DIR"

echo "==> Instalando dependencias"
npm ci

echo "==> Migrando banco de dados"
RTPG_DATA_DIR="$DATA_DIR" npm run db:push

echo "==> Compilando frontend"
RTPG_DATA_DIR="$DATA_DIR" npm run build

echo "==> Reiniciando app"
pm2 reload rtpg --update-env

echo "==> Deploy concluido"
curl -fsS "http://127.0.0.1:3333/api/health"
echo
