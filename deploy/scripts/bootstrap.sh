#!/usr/bin/env bash
# Bootstrap prod : Terraform, VM Mail, cluster Kapsule
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
GEN_DIR="${ROOT}/deploy/.generated"
# shellcheck source=lib/framm-common.sh
source "${ROOT}/deploy/scripts/lib/framm-common.sh"

framm_load_env
mkdir -p "$GEN_DIR"

echo "=== Framm bootstrap ==="

if [[ "${DNS_ENABLED:-false}" != "true" ]]; then
  if scw dns record list "${PRIMARY_PLATFORM_DOMAIN}" &>/dev/null; then
    export DNS_ENABLED=true
    echo "Zone DNS active — DNS_ENABLED=true"
    "${ROOT}/deploy/scripts/tf-apply.sh"
  else
    echo "Zone DNS pas encore active — attente registrar..."
    "${ROOT}/deploy/scripts/wait-dns-and-apply.sh" "${PRIMARY_PLATFORM_DOMAIN}" 60 30
    export DNS_ENABLED=true
  fi
else
  "${ROOT}/deploy/scripts/tf-apply.sh"
fi

"${ROOT}/deploy/scripts/render-alertmanager.sh"
framm_load_tf_outputs

if ! framm_ssh "$MAIL_PUBLIC_IP" "true" 2>/dev/null; then
  echo "SSH Mail indisponible — recréation VM Mail..."
  "${ROOT}/deploy/scripts/tf-apply.sh" \
    -replace="module.mail_vm.scaleway_instance_server.this"
  framm_load_tf_outputs
  framm_reset_known_hosts
fi

"${ROOT}/deploy/scripts/remote-deploy-mail.sh"

echo "=== Bootstrap Kubernetes (app) ==="
"${ROOT}/deploy/scripts/k8s-bootstrap.sh"

framm_wait_dns_public 60 || true

echo "Configuration HTTPS (VM Mail)..."
"${ROOT}/deploy/scripts/setup-tls.sh" mail || true

echo ""
echo "Bootstrap terminé."
echo "App : Kapsule (LB ${APP_PUBLIC_IP}) — TLS via cert-manager"
echo "Fichier généré : ${GEN_DIR}/env.production"

cd "${ROOT}/terraform/environments/prod"
terraform output

"${ROOT}/deploy/scripts/health-check.sh" || true
