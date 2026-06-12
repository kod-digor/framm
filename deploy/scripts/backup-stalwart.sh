#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=/dev/null
source "${ROOT}/deploy/.generated/env.production" 2>/dev/null || true

METRICS_DIR="/var/lib/node_exporter/textfile_collector"
DATE=$(date +%Y%m%d-%H%M%S)
FILE="/tmp/framm-stalwart-${DATE}.tar.gz"

report() {
  mkdir -p "$METRICS_DIR"
  {
    echo "framm_backup_stalwart_success $1"
    if [[ "$1" == "1" ]]; then
      echo "framm_backup_stalwart_last_success_seconds $(date +%s)"
    fi
  } > "${METRICS_DIR}/backup_stalwart.prom.$$"
  mv "${METRICS_DIR}/backup_stalwart.prom.$$" "${METRICS_DIR}/backup_stalwart.prom"
}
trap 'report 0' ERR
trap 'rm -f "$FILE"' EXIT

command -v aws >/dev/null || { echo "aws CLI manquant (apt-get install awscli)"; exit 1; }
[[ -n "${S3_BUCKET_BACKUPS:-}" ]] || { echo "S3_BUCKET_BACKUPS absent de env.production"; exit 1; }
[[ -n "$(ls -A /opt/framm/mail-data 2>/dev/null)" ]] || { echo "/opt/framm/mail-data vide — rien à sauvegarder ?"; exit 1; }

tar -czf "$FILE" -C /opt/framm mail-data stalwart 2>/dev/null || tar -czf "$FILE" -C /opt/framm mail-data

AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY" AWS_SECRET_ACCESS_KEY="$S3_SECRET_KEY" \
  aws s3 cp "$FILE" "s3://${S3_BUCKET_BACKUPS}/stalwart/${DATE}.tar.gz" \
  --endpoint-url "${S3_ENDPOINT}"

report 1
echo "Backup Stalwart envoyé : s3://${S3_BUCKET_BACKUPS}/stalwart/${DATE}.tar.gz"
