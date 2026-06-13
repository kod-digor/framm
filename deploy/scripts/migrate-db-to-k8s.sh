#!/usr/bin/env bash
# Copie la base PostgreSQL de la VM App vers la base managée (RDB) utilisée
# par le cluster. À lancer pendant la fenêtre de bascule, app web arrêtée ou
# en lecture seule de préférence.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=lib/framm-common.sh
source "${ROOT}/deploy/scripts/lib/framm-common.sh"

framm_load_env
framm_load_tf_outputs

ENV_FILE="${ROOT}/deploy/.generated/env.production"
set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a
export KUBECONFIG="${ROOT}/deploy/.generated/kubeconfig"

DUMP="/tmp/framm-pg-migration.sql"
LEGACY_APP_IP="${LEGACY_APP_PUBLIC_IP:-${APP_PUBLIC_IP:-}}"
[[ -n "$LEGACY_APP_IP" ]] || { echo "LEGACY_APP_PUBLIC_IP ou APP_PUBLIC_IP requis (IP VM App avant bascule)"; exit 1; }
trap 'rm -f "$DUMP"' EXIT

echo "Dump depuis la VM App (${LEGACY_APP_IP})..."
framm_ssh "$LEGACY_APP_IP" 'docker exec $(docker ps -qf name=postgres) pg_dump -U framm --no-owner --no-privileges framm' > "$DUMP"
echo "Dump : $(du -h "$DUMP" | cut -f1)"

[[ -n "${RDB_HOST:-}" && -n "${RDB_PASSWORD:-}" ]] || {
  echo "RDB_HOST et RDB_PASSWORD requis dans env.production — lancez bin/framm bootstrap"
  exit 1
}
RDB_PORT="${RDB_PORT:-5432}"

echo "Restauration vers la base managée (${RDB_HOST})..."
# Variables PG* : évite les caractères spéciaux non encodés dans l'URL
kubectl -n framm run framm-db-restore --rm -i --restart=Never \
  --image=postgres:16-alpine \
  --env="PGSSLMODE=require" \
  --env="PGHOST=${RDB_HOST}" \
  --env="PGPORT=${RDB_PORT}" \
  --env="PGUSER=framm" \
  --env="PGDATABASE=framm" \
  --env="PGPASSWORD=${RDB_PASSWORD}" \
  --command -- psql -v ON_ERROR_STOP=1 < "$DUMP"

echo "Migration terminée. Vérifiez l'app sur Kapsule puis synchronisez ArgoCD (framm-web)."
