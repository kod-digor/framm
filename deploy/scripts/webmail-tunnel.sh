#!/usr/bin/env bash
# Tunnel SSH localhost:8080 → webmail Stalwart (port 8080) sur la VM Mail
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=lib/framm-common.sh
source "${ROOT}/deploy/scripts/lib/framm-common.sh"

TUNNEL_PORT="${FRAMM_WEBMAIL_TUNNEL_PORT:-8080}"
LOCAL_BIND="${FRAMM_WEBMAIL_TUNNEL_BIND:-127.0.0.1}"

framm_load_env 2>/dev/null || true
if [[ -z "${MAIL_PUBLIC_IP:-}" ]]; then
  framm_load_tf_outputs
fi

framm_init_ssh

if lsof -iTCP:"${TUNNEL_PORT}" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Tunnel webmail déjà actif sur ${LOCAL_BIND}:${TUNNEL_PORT}"
  echo "URL locale : http://${LOCAL_BIND}:${TUNNEL_PORT}/account"
  exit 0
fi

echo "Tunnel webmail prod: ${LOCAL_BIND}:${TUNNEL_PORT} → ${MAIL_PUBLIC_IP}:8080"
echo "Dans apps/web/.env.local : WEBMAIL_URL=http://${LOCAL_BIND}:${TUNNEL_PORT}"
echo "Puis ouvrir : http://${LOCAL_BIND}:${TUNNEL_PORT}/account"
exec ssh "${SSH_OPTS[@]}" -N -L "${LOCAL_BIND}:${TUNNEL_PORT}:127.0.0.1:8080" "root@${MAIL_PUBLIC_IP}"
