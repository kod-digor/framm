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
trap 'rm -f "$DUMP"' EXIT

echo "Dump depuis la VM App..."
framm_ssh "$APP_PUBLIC_IP" 'docker exec $(docker ps -qf name=postgres) pg_dump -U framm --no-owner --no-privileges framm' > "$DUMP"
echo "Dump : $(du -h "$DUMP" | cut -f1)"

echo "Restauration vers la base managée (via un pod éphémère)..."
kubectl -n framm run framm-db-restore --rm -i --restart=Never \
  --image=postgres:16-alpine \
  --command -- psql "$K8S_DATABASE_URL" -v ON_ERROR_STOP=1 < "$DUMP"

echo "Migration terminée. Vérifiez l'app puis basculez le DNS (TF_VAR_k8s_lb_ip)."
