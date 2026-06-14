#!/usr/bin/env bash
# Applique Terraform prod avec les variables du .env
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=lib/framm-common.sh
source "${ROOT}/deploy/scripts/lib/framm-common.sh"

TF_DIR="${ROOT}/terraform/environments/prod"

framm_load_env

# Prod : true par défaut pour ne pas détruire les records DNS Scaleway au apply
DNS_ENABLED="${DNS_ENABLED:-true}"
APP_BZH_ENABLED="${APP_BZH_ENABLED:-false}"

# IPs autorisées sur l'endpoint public RDB (CIDR). Ex. RDB_ALLOWED_IPS=1.2.3.4,5.6.7.8
RDB_ALLOWED_IPS_TF=""
if [[ -n "${RDB_ALLOWED_IPS:-}" ]]; then
  RDB_ALLOWED_IPS_TF="["
  first=true
  IFS=',' read -ra _rdb_ips <<< "${RDB_ALLOWED_IPS}"
  for ip in "${_rdb_ips[@]}"; do
    ip="${ip// /}"
    [[ -z "$ip" ]] && continue
    [[ "$ip" == */* ]] || ip="${ip}/32"
    $first || RDB_ALLOWED_IPS_TF+=","
    RDB_ALLOWED_IPS_TF+="\"${ip}\""
    first=false
  done
  RDB_ALLOWED_IPS_TF+="]"
fi

TF_EXTRA_ARGS=()
if [[ -n "$RDB_ALLOWED_IPS_TF" && "$RDB_ALLOWED_IPS_TF" != "[]" ]]; then
  TF_EXTRA_ARGS+=(-var="rdb_allowed_ips=${RDB_ALLOWED_IPS_TF}")
fi

# Le backend s3 lit les identifiants via les variables AWS_*
export AWS_ACCESS_KEY_ID="${SCW_ACCESS_KEY}"
export AWS_SECRET_ACCESS_KEY="${SCW_SECRET_KEY}"

"${ROOT}/deploy/scripts/setup-tf-backend.sh"

# Prod + DNS Scaleway : TEM activé par défaut (relais sortant + alertes).
TEM_ENABLED="${TEM_ENABLED:-true}"

cd "$TF_DIR"
terraform init -input=false
terraform apply -auto-approve \
  -var="scw_project_id=${SCW_PROJECT_ID}" \
  -var="admin_password=${ADMIN_PASSWORD}" \
  -var="admin_email=${BUREAU_ADMIN_EMAIL}" \
  -var="dns_enabled=${DNS_ENABLED}" \
  -var="tem_enabled=${TEM_ENABLED}" \
  -var="app_bzh_enabled=${APP_BZH_ENABLED}" \
  -var="ssh_public_key=${SSH_PUBLIC_KEY}" \
  -var="alert_smtp_host=${ALERT_SMTP_HOST:-}" \
  -var="alert_smtp_port=${ALERT_SMTP_PORT:-587}" \
  -var="alert_smtp_user=${ALERT_SMTP_USER:-}" \
  -var="alert_smtp_password=${ALERT_SMTP_PASSWORD:-}" \
  -var="alert_smtp_from=${ALERT_SMTP_FROM:-}" \
  "${TF_EXTRA_ARGS[@]}" \
  "$@"

if [[ "${FRAMM_SKIP_POST_APPLY:-}" != "true" ]]; then
  "${ROOT}/deploy/scripts/post-tf-apply.sh" || {
    echo "AVERTISSEMENT : post-tf-apply échoué — relancez bin/framm k8s-sync-secrets ou bin/framm deploy" >&2
  }
fi
