#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=/dev/null
source "${ROOT}/deploy/.generated/env.production" 2>/dev/null || true

DATE=$(date +%Y%m%d-%H%M%S)
FILE="/tmp/framm-pg-${DATE}.sql.gz"

docker exec "$(docker ps -qf name=postgres)" pg_dump -U framm framm | gzip > "$FILE"

if command -v aws &>/dev/null && [[ -n "${S3_BUCKET_BACKUPS:-}" ]]; then
  AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY" AWS_SECRET_ACCESS_KEY="$S3_SECRET_KEY" \
    aws s3 cp "$FILE" "s3://${S3_BUCKET_BACKUPS}/postgres/${DATE}.sql.gz" \
    --endpoint-url "${S3_ENDPOINT}"
fi

echo "backup_postgres_success 1" > /var/lib/node_exporter/textfile_collector/backup_pg.prom
rm -f "$FILE"
