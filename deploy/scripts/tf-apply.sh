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

cd "$TF_DIR"
terraform init -input=false
terraform apply -auto-approve \
  -var="scw_project_id=${SCW_PROJECT_ID}" \
  -var="admin_password=${ADMIN_PASSWORD}" \
  -var="admin_email=${BUREAU_ADMIN_EMAIL}" \
  -var="dns_enabled=${DNS_ENABLED}" \
  -var="app_bzh_enabled=${APP_BZH_ENABLED}" \
  -var="ssh_public_key=${SSH_PUBLIC_KEY}" \
  "$@"
