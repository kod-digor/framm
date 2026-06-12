#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=/dev/null
source "${ROOT}/deploy/.generated/env.production" 2>/dev/null || true

METRICS_DIR="/var/lib/node_exporter/textfile_collector"
DATE=$(date +%Y%m%d-%H%M%S)
FILE="/tmp/framm-pg-${DATE}.sql.gz"

report() {
  mkdir -p "$METRICS_DIR"
  {
    echo "framm_backup_postgres_success $1"
    if [[ "$1" == "1" ]]; then
      echo "framm_backup_postgres_last_success_seconds $(date +%s)"
    fi
  } > "${METRICS_DIR}/backup_pg.prom.$$"
  mv "${METRICS_DIR}/backup_pg.prom.$$" "${METRICS_DIR}/backup_pg.prom"
}
trap 'report 0' ERR
trap 'rm -f "$FILE"' EXIT

# Échouer bruyamment plutôt que de sauter l'upload en silence : un backup
# qui reste sur la VM ne protège de rien.
command -v aws >/dev/null || { echo "aws CLI manquant (apt-get install awscli)"; exit 1; }
[[ -n "${S3_BUCKET_BACKUPS:-}" ]] || { echo "S3_BUCKET_BACKUPS absent de env.production"; exit 1; }

docker exec "$(docker ps -qf name=postgres)" pg_dump -U framm framm | gzip > "$FILE"

AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY" AWS_SECRET_ACCESS_KEY="$S3_SECRET_KEY" \
  aws s3 cp "$FILE" "s3://${S3_BUCKET_BACKUPS}/postgres/${DATE}.sql.gz" \
  --endpoint-url "${S3_ENDPOINT}"

report 1
echo "Backup PostgreSQL envoyé : s3://${S3_BUCKET_BACKUPS}/postgres/${DATE}.sql.gz"
