#!/usr/bin/env bash
# Génère apps/web/.env.local pour le dev avec la DB prod (tunnel K8s requis)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PROD_ENV="${ROOT}/deploy/.generated/env.production"
OUT="${ROOT}/apps/web/.env.local"
TUNNEL_PORT="${FRAMM_DB_TUNNEL_PORT:-5433}"

# shellcheck source=lib/framm-common.sh
source "${ROOT}/deploy/scripts/lib/framm-common.sh"

if [[ ! -f "$PROD_ENV" ]]; then
  echo "Fichier manquant: deploy/.generated/env.production"
  echo "Lancez d'abord: bin/framm bootstrap (ou terraform apply en local)"
  exit 1
fi

set -a
# shellcheck source=/dev/null
source "$PROD_ENV"
set +a

if [[ -z "${RDB_PASSWORD:-}" ]]; then
  echo "RDB_PASSWORD absent de env.production"
  exit 1
fi

framm_urlencode() {
  python3 -c "import urllib.parse, sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$1"
}
RDB_PASSWORD_ENCODED="$(framm_urlencode "$RDB_PASSWORD")"

WEBMAIL_URL="${WEBMAIL_URL:-https://webmail.${PRIMARY_PLATFORM_DOMAIN:-kod-digor.bzh}}"
STALWART_JMAP_URL="${STALWART_URL:-https://mail.${PRIMARY_PLATFORM_DOMAIN:-kod-digor.bzh}}"

framm_load_env 2>/dev/null || true
if [[ -z "${MAIL_PUBLIC_IP:-}" ]]; then
  framm_load_tf_outputs 2>/dev/null || true
fi
if [[ -n "${MAIL_PUBLIC_IP:-}" ]]; then
  framm_init_ssh
  LIVE_STALWART_KEY="$(framm_ssh "$MAIL_PUBLIC_IP" "grep '^STALWART_API_KEY=' /opt/framm/deploy/.generated/env.production | cut -d= -f2-" 2>/dev/null || true)"
  if [[ -n "$LIVE_STALWART_KEY" ]]; then
    STALWART_API_KEY="$LIVE_STALWART_KEY"
    echo "STALWART_API_KEY synchronisée depuis la VM Mail"
  fi
fi

cat > "$OUT" <<EOF
# Dev local → RDB prod via tunnel (bin/framm db-tunnel)
DATABASE_URL=postgresql://framm:${RDB_PASSWORD_ENCODED}@127.0.0.1:${TUNNEL_PORT}/framm?sslmode=require
AUTH_SECRET=${AUTH_SECRET}
AUTH_URL=http://localhost:3000
PLATFORM_DOMAINS=${PLATFORM_DOMAINS:-kod-digor.bzh}
PRIMARY_PLATFORM_DOMAIN=${PRIMARY_PLATFORM_DOMAIN:-kod-digor.bzh}
WEBMAIL_URL=${WEBMAIL_URL}
STALWART_URL=${STALWART_JMAP_URL}
STALWART_API_KEY=${STALWART_API_KEY:-}
OUTBOUND_SMTP_RELAY_HOST=${OUTBOUND_SMTP_RELAY_HOST:-}
OUTBOUND_SMTP_RELAY_PORT=${OUTBOUND_SMTP_RELAY_PORT:-2587}
OUTBOUND_SMTP_RELAY_USER=${OUTBOUND_SMTP_RELAY_USER:-}
OUTBOUND_SMTP_RELAY_SECRET=${OUTBOUND_SMTP_RELAY_SECRET:-}
BUREAU_ADMIN_EMAIL=${BUREAU_ADMIN_EMAIL}
BUREAU_ADMIN_PASSWORD=${BUREAU_ADMIN_PASSWORD}
S3_ENDPOINT=${S3_ENDPOINT:-}
S3_REGION=${S3_REGION:-fr-par}
S3_BUCKET_UPLOADS=${S3_BUCKET_UPLOADS:-}
S3_ACCESS_KEY=${S3_ACCESS_KEY:-}
S3_SECRET_KEY=${S3_SECRET_KEY:-}
EOF

echo "Écrit: apps/web/.env.local (DB prod sur localhost:${TUNNEL_PORT})"
echo "Puis: bin/framm db-tunnel && cd apps/web && npm run dev"
