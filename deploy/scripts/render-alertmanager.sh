#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_FILE="${ROOT}/deploy/.generated/env.production"
OUT="${ROOT}/deploy/observability/alertmanager/alertmanager.yml"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Fichier env.production manquant — lancez bin/framm bootstrap d'abord"
  exit 1
fi

set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

EMAIL="${ALERT_EMAIL:-${BUREAU_ADMIN_EMAIL}}"

cat > "$OUT" << EOF
route:
  receiver: bureau
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h

receivers:
  - name: bureau
    email_configs:
      - to: ${EMAIL}
        send_resolved: true
EOF

echo "Alertmanager configuré pour ${EMAIL}"
