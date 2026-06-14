#!/usr/bin/env bash
# CI : terraform apply + propagation env (relais TEM OUTBOUND_SMTP_RELAY_*).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
export FRAMM_CI=true
export FRAMM_ROOT="$ROOT"

# shellcheck source=lib/framm-common.sh
source "${ROOT}/deploy/scripts/lib/framm-common.sh"

for var in SCW_ACCESS_KEY SCW_SECRET_KEY SCW_PROJECT_ID ADMIN_PASSWORD BUREAU_ADMIN_EMAIL; do
  if [[ -z "${!var:-}" ]]; then
    echo "Secret CI ${var} absent — synchronisation Terraform sautée"
    exit 0
  fi
done

framm_ci_setup_ssh

# tf-apply.sh charge deploy/.env — en CI on le génère depuis les secrets GitHub.
ENV_FILE="${ROOT}/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  cat > "$ENV_FILE" <<EOF
SCW_ACCESS_KEY=${SCW_ACCESS_KEY}
SCW_SECRET_KEY=${SCW_SECRET_KEY}
SCW_PROJECT_ID=${SCW_PROJECT_ID}
ADMIN_PASSWORD=${ADMIN_PASSWORD}
BUREAU_ADMIN_EMAIL=${BUREAU_ADMIN_EMAIL}
DNS_ENABLED=true
TEM_ENABLED=true
EOF
  if [[ -n "${MAIL_PUBLIC_IP:-}" ]]; then
    echo "MAIL_PUBLIC_IP=${MAIL_PUBLIC_IP}" >> "$ENV_FILE"
  fi
fi

echo "=== Terraform apply (prod) ==="
"${ROOT}/deploy/scripts/tf-apply.sh"

echo "=== Propagation post-Terraform ==="
"${ROOT}/deploy/scripts/post-tf-apply.sh"

echo "Synchronisation Terraform terminée."
