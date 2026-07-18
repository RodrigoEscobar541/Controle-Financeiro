#!/usr/bin/env bash
# vps-deploy.sh — deploy automático do bot na VPS (Contabo).
#
# Chamado por um cron a cada ~2 min: faz `git fetch` (barato) e SÓ age quando
# há commit novo em origin/main — aí puxa, faz uma checagem de sintaxe e
# reinicia o bot pelo pm2. Sem novidade, sai em silêncio (idempotente).
#
# Instalação (uma vez, na VPS):
#   chmod +x /root/Controle-Financeiro/scripts/vps-deploy.sh
#   crontab -e   → adicionar a linha:
#   */2 * * * * /root/Controle-Financeiro/scripts/vps-deploy.sh >> /root/deploy-cf.log 2>&1
#
# Requisitos: repo em $REPO_DIR, git autenticado (deploy key SSH), pm2 com o
# processo $APP_NAME rodando, Node/npm no PATH.

set -euo pipefail

REPO_DIR="/root/Controle-Financeiro"
BOT_DIR="$REPO_DIR/Bot Render"   # atenção: o caminho tem espaço
APP_NAME="controle-financeiro-bot"
BRANCH="main"

# O cron roda com PATH mínimo: garante node/npm/pm2 no caminho.
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$PATH"

cd "$REPO_DIR"

git fetch origin "$BRANCH" --quiet
LOCAL="$(git rev-parse HEAD)"
REMOTE="$(git rev-parse "origin/$BRANCH")"

# Nada novo: encerra sem barulho (a maioria dos ticks cai aqui).
[ "$LOCAL" = "$REMOTE" ] && exit 0

echo "[$(date '+%F %T')] deploy: ${LOCAL:0:7} -> ${REMOTE:0:7}"

# Só avança em fast-forward (nunca cria merge nem descarta commit local).
git merge --ff-only "origin/$BRANCH"

# Instala dependências só se o package.json do bot mudou (barato no dia a dia).
if ! git diff --quiet "$LOCAL" "$REMOTE" -- "Bot Render/package.json" 2>/dev/null; then
  ( cd "$BOT_DIR" && npm install --no-audit --no-fund )
fi

# Portão leve (o projeto não tem testes): checa a sintaxe do index.js. Um erro
# de sintaxe aqui aborta o deploy antes de derrubar o bot que já roda.
if node --check "$BOT_DIR/index.js"; then
  pm2 restart "$APP_NAME" --update-env
  echo "[$(date '+%F %T')] deploy OK — $APP_NAME reiniciado"
else
  echo "[$(date '+%F %T')] SINTAXE INVÁLIDA em index.js — deploy abortado, $APP_NAME NÃO reiniciado" >&2
  exit 1
fi
