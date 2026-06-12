#!/usr/bin/env bash
# Applique Terraform prod avec les variables du .env
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=lib/framm-common.sh
source "${ROOT}/deploy/scripts/lib/framm-common.sh"

TF_DIR="${ROOT}/terraform/environments/prod"

framm_load_env

DNS_ENABLED="${DNS_ENABLED:-false}"
APP_BZH_ENABLED="${APP_BZH_ENABLED:-false}"

# Le backend s3 lit les identifiants via les variables AWS_*
export AWS_ACCESS_KEY_ID="${SCW_ACCESS_KEY}"
export AWS_SECRET_ACCESS_KEY="${SCW_SECRET_KEY}"

"${ROOT}/deploy/scripts/setup-tf-backend.sh"

cd "$TF_DIR"
terraform init -input=false
terraform apply -auto-approve \
  -var="scw_project_id=${SCW_PROJECT_ID}" \
  -var="admin_password=${ADMIN_PASSWORD}" \
  -var="admin_email=${BUREAU_ADMIN_EMAIL}" \
  -var="dns_enabled=${DNS_ENABLED}" \
  -var="tem_enabled=${TEM_ENABLED:-false}" \
  -var="app_bzh_enabled=${APP_BZH_ENABLED}" \
  -var="ssh_public_key=${SSH_PUBLIC_KEY}" \
  -var="alert_smtp_host=${ALERT_SMTP_HOST:-}" \
  -var="alert_smtp_port=${ALERT_SMTP_PORT:-587}" \
  -var="alert_smtp_user=${ALERT_SMTP_USER:-}" \
  -var="alert_smtp_password=${ALERT_SMTP_PASSWORD:-}" \
  -var="alert_smtp_from=${ALERT_SMTP_FROM:-}" \
  "$@"
