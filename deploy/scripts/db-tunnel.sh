#!/usr/bin/env bash
# Tunnel SSH localhost:5433 → Postgres prod sur la VM App
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=lib/framm-common.sh
source "${ROOT}/deploy/scripts/lib/framm-common.sh"

TUNNEL_PORT="${FRAMM_DB_TUNNEL_PORT:-5433}"
LOCAL_BIND="${FRAMM_DB_TUNNEL_BIND:-127.0.0.1}"

framm_load_env 2>/dev/null || true
if [[ -z "${APP_PUBLIC_IP:-}" ]]; then
  PROD_ENV="${ROOT}/deploy/.generated/env.production"
  if [[ -f "$PROD_ENV" ]]; then
    # shellcheck source=/dev/null
    source "$PROD_ENV"
  else
    framm_load_tf_outputs
  fi
fi

if [[ -z "${APP_PUBLIC_IP:-}" ]]; then
  echo "APP_PUBLIC_IP introuvable (deploy/.generated/env.production ou terraform output)"
  exit 1
fi

framm_init_ssh

if lsof -iTCP:"${TUNNEL_PORT}" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Tunnel déjà actif sur ${LOCAL_BIND}:${TUNNEL_PORT}"
  exit 0
fi

echo "Tunnel DB prod: ${LOCAL_BIND}:${TUNNEL_PORT} → ${APP_PUBLIC_IP}:5432"
exec ssh "${SSH_OPTS[@]}" -N -L "${LOCAL_BIND}:${TUNNEL_PORT}:127.0.0.1:5432" "root@${APP_PUBLIC_IP}"
