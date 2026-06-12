#!/usr/bin/env bash
# Restaure un backup PostgreSQL depuis S3 — à lancer sur la VM App.
# Usage : restore-postgres.sh [clé-s3]    (par défaut : le backup le plus récent)
# DESTRUCTIF : écrase la base courante. Demande confirmation (FRAMM_FORCE=1 pour passer outre).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=/dev/null
source "${ROOT}/deploy/.generated/env.production"

export AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY"
export AWS_SECRET_ACCESS_KEY="$S3_SECRET_KEY"

KEY="${1:-}"
if [[ -z "$KEY" ]]; then
  KEY="$(aws s3 ls "s3://${S3_BUCKET_BACKUPS}/postgres/" --endpoint-url "$S3_ENDPOINT" \
    | awk '{print $4}' | sort | tail -1)"
fi
[[ -n "$KEY" ]] || { echo "Aucun backup trouvé dans s3://${S3_BUCKET_BACKUPS}/postgres/"; exit 1; }

echo "Backup sélectionné : ${KEY}"
if [[ "${FRAMM_FORCE:-}" != "1" ]]; then
  read -r -p "Cette restauration ÉCRASE la base framm. Continuer ? (oui/non) " answer
  [[ "$answer" == "oui" ]] || { echo "Abandon"; exit 1; }
fi

FILE="/tmp/framm-pg-restore.sql.gz"
trap 'rm -f "$FILE"' EXIT
aws s3 cp "s3://${S3_BUCKET_BACKUPS}/postgres/${KEY}" "$FILE" --endpoint-url "$S3_ENDPOINT"

PG="$(docker ps -qf name=postgres)"
gunzip -c "$FILE" | docker exec -i "$PG" psql -U framm framm

echo "Restauration terminée depuis ${KEY}"
