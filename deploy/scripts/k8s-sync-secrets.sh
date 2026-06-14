#!/usr/bin/env bash
# Synchronise les secrets applicatifs K8s depuis deploy/.generated/env.production
# et redémarre les pods pour prendre en compte les nouvelles variables.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
GEN_DIR="${ROOT}/deploy/.generated"
ENV_FILE="${GEN_DIR}/env.production"
export KUBECONFIG="${GEN_DIR}/kubeconfig"

[[ -f "$ENV_FILE" ]] || { echo "env.production manquant — lancez bin/framm bootstrap (terraform) d'abord"; exit 1; }
[[ -f "$KUBECONFIG" ]] || { echo "kubeconfig manquant — lancez bin/framm bootstrap (terraform) d'abord"; exit 1; }
command -v kubectl >/dev/null || { echo "kubectl requis"; exit 1; }

# OAuth migration et tuning imapsync : .env racine (secrets GitHub en CI).
ROOT_ENV="${ROOT}/.env"
if [[ -f "$ROOT_ENV" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$ROOT_ENV"
  set +a
fi

set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

ensure_database_connection_limit() {
  local url="${1}"
  local limit="${DATABASE_CONNECTION_LIMIT:-5}"
  if [[ "$url" == *connection_limit=* ]]; then
    printf '%s' "$url"
    return
  fi
  if [[ "$url" == *"?"* ]]; then
    printf '%s&connection_limit=%s&pool_timeout=20' "$url" "$limit"
  else
    printf '%s?connection_limit=%s&pool_timeout=20' "$url" "$limit"
  fi
}

DATABASE_URL_FOR_K8S="$(ensure_database_connection_limit "${K8S_DATABASE_URL}")"

echo "=== Sync secrets K8s (framm-env) ==="
kubectl create namespace framm --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -

kubectl -n framm create secret generic framm-env \
  --from-literal=DATABASE_URL="${DATABASE_URL_FOR_K8S}" \
  --from-literal=AUTH_SECRET="${AUTH_SECRET}" \
  --from-literal=AUTH_URL="${AUTH_URL}" \
  --from-literal=AUTH_TRUST_HOST="true" \
  --from-literal=PLATFORM_DOMAINS="${PLATFORM_DOMAINS}" \
  --from-literal=WEBMAIL_URL="${WEBMAIL_URL}" \
  --from-literal=STALWART_URL="${STALWART_URL}" \
  --from-literal=STALWART_API_KEY="${STALWART_API_KEY}" \
  --from-literal=STALWART_PLATFORM_PGP_PUBLIC_KEY="${STALWART_PLATFORM_PGP_PUBLIC_KEY:-}" \
  --from-literal=STALWART_ENCRYPTION_PUBLIC_KEY_ID="${STALWART_ENCRYPTION_PUBLIC_KEY_ID:-}" \
  --from-literal=PRIMARY_PLATFORM_DOMAIN="${PRIMARY_PLATFORM_DOMAIN}" \
  --from-literal=BUREAU_ADMIN_EMAIL="${BUREAU_ADMIN_EMAIL}" \
  --from-literal=BUREAU_ADMIN_PASSWORD="${BUREAU_ADMIN_PASSWORD}" \
  --from-literal=BUREAU_ORG_NAME="${BUREAU_ORG_NAME:-Kod Digor}" \
  --from-literal=BUREAU_ORG_SLUG="${BUREAU_ORG_SLUG:-kod-digor}" \
  --from-literal=S3_ENDPOINT="${S3_ENDPOINT}" \
  --from-literal=S3_REGION="${S3_REGION}" \
  --from-literal=S3_BUCKET_UPLOADS="${S3_BUCKET_UPLOADS}" \
  --from-literal=S3_BUCKET_BACKUPS="${S3_BUCKET_BACKUPS}" \
  --from-literal=S3_ACCESS_KEY="${S3_ACCESS_KEY}" \
  --from-literal=S3_SECRET_KEY="${S3_SECRET_KEY}" \
  --from-literal=OUTBOUND_SMTP_RELAY_HOST="${OUTBOUND_SMTP_RELAY_HOST:-}" \
  --from-literal=OUTBOUND_SMTP_RELAY_PORT="${OUTBOUND_SMTP_RELAY_PORT:-2587}" \
  --from-literal=OUTBOUND_SMTP_RELAY_USER="${OUTBOUND_SMTP_RELAY_USER:-}" \
  --from-literal=OUTBOUND_SMTP_RELAY_SECRET="${OUTBOUND_SMTP_RELAY_SECRET:-}" \
  --from-literal=GOOGLE_MIGRATION_CLIENT_ID="${GOOGLE_MIGRATION_CLIENT_ID:-}" \
  --from-literal=GOOGLE_MIGRATION_CLIENT_SECRET="${GOOGLE_MIGRATION_CLIENT_SECRET:-}" \
  --from-literal=MICROSOFT_MIGRATION_CLIENT_ID="${MICROSOFT_MIGRATION_CLIENT_ID:-}" \
  --from-literal=MICROSOFT_MIGRATION_CLIENT_SECRET="${MICROSOFT_MIGRATION_CLIENT_SECRET:-}" \
  --from-literal=IMAPSYNC_MAX_PARALLEL="${IMAPSYNC_MAX_PARALLEL:-6}" \
  --from-literal=IMAPSYNC_MAX_BYTES_PER_SECOND="${IMAPSYNC_MAX_BYTES_PER_SECOND:-}" \
  --from-literal=IMAPSYNC_PATH="${IMAPSYNC_PATH:-/usr/bin/imapsync}" \
  --from-literal=MIGRATION_WORKER_CONCURRENCY="${MIGRATION_WORKER_CONCURRENCY:-1}" \
  --from-literal=MIGRATION_STALWART_IMAP_HOST="${MIGRATION_STALWART_IMAP_HOST:-}" \
  --from-literal=MIGRATION_STALWART_IMAP_PORT="${MIGRATION_STALWART_IMAP_PORT:-993}" \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl -n monitoring create secret generic framm-grafana \
  --from-literal=admin-user=admin \
  --from-literal=admin-password="${GRAFANA_ADMIN_PASSWORD}" \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl -n monitoring create secret generic framm-alert-smtp \
  --from-literal=password="${ALERT_SMTP_PASSWORD:-}" \
  --dry-run=client -o yaml | kubectl apply -f -

if kubectl -n framm get deployment web >/dev/null 2>&1; then
  kubectl -n framm rollout restart deployment/web deployment/worker 2>/dev/null || \
    kubectl -n framm rollout restart deployment/web
  kubectl -n framm rollout status deployment/web --timeout=300s
fi

echo "Secrets K8s synchronisés."
