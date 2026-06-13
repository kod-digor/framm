#!/usr/bin/env bash
# Tunnel localhost:5433 → base managée (RDB) via un pod proxy sur Kapsule
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=lib/framm-common.sh
source "${ROOT}/deploy/scripts/lib/framm-common.sh"

TUNNEL_PORT="${FRAMM_DB_TUNNEL_PORT:-5433}"
LOCAL_BIND="${FRAMM_DB_TUNNEL_BIND:-127.0.0.1}"
PROD_ENV="${ROOT}/deploy/.generated/env.production"
export KUBECONFIG="${ROOT}/deploy/.generated/kubeconfig"
TUNNEL_POD="framm-db-tunnel"

framm_load_env 2>/dev/null || true
if [[ -f "$PROD_ENV" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$PROD_ENV"
  set +a
fi

[[ -n "${RDB_HOST:-}" && -n "${RDB_PORT:-}" ]] || {
  echo "RDB_HOST / RDB_PORT introuvables — lancez bin/framm bootstrap"
  exit 1
}
[[ -f "$KUBECONFIG" ]] || {
  echo "kubeconfig manquant — lancez bin/framm bootstrap"
  exit 1
}
command -v kubectl >/dev/null || { echo "kubectl requis"; exit 1; }

if lsof -iTCP:"${TUNNEL_PORT}" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Tunnel déjà actif sur ${LOCAL_BIND}:${TUNNEL_PORT}"
  exit 0
fi

kubectl create namespace framm --dry-run=client -o yaml | kubectl apply -f - >/dev/null

if ! kubectl -n framm get pod "$TUNNEL_POD" >/dev/null 2>&1; then
  echo "Démarrage du proxy DB sur Kapsule (${RDB_HOST}:${RDB_PORT})..."
  kubectl -n framm run "$TUNNEL_POD" \
    --restart=Always \
    --image=alpine/socat \
    --port=5432 \
    -- socat "tcp-listen:5432,fork,reuseaddr" "tcp:${RDB_HOST}:${RDB_PORT}"
  kubectl -n framm wait --for=condition=Ready "pod/${TUNNEL_POD}" --timeout=120s
fi

echo "Tunnel DB prod: ${LOCAL_BIND}:${TUNNEL_PORT} → RDB via Kapsule"
exec kubectl -n framm port-forward "pod/${TUNNEL_POD}" "${LOCAL_BIND}:${TUNNEL_PORT}:5432"
