#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
GEN_DIR="${ROOT}/deploy/.generated"
# shellcheck source=lib/framm-common.sh
source "${ROOT}/deploy/scripts/lib/framm-common.sh"

framm_load_env
mkdir -p "$GEN_DIR"

echo "=== Framm bootstrap ==="

# DNS : activer si la zone Scaleway est prête, sinon attendre
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

# Recréer les VMs si SSH indisponible (cloud-init avec clé SSH)
if ! framm_ssh "$APP_PUBLIC_IP" "true" 2>/dev/null; then
  echo "SSH indisponible — recréation des VMs pour appliquer cloud-init..."
  "${ROOT}/deploy/scripts/tf-apply.sh" \
    -replace="module.app_vm.scaleway_instance_server.this" \
    -replace="module.mail_vm.scaleway_instance_server.this"
  framm_load_tf_outputs
  framm_reset_known_hosts
fi

framm_wait_ssh "$APP_PUBLIC_IP"
framm_wait_ssh "$MAIL_PUBLIC_IP"

"${ROOT}/deploy/scripts/remote-deploy.sh"

framm_wait_dns_public 60 || true

echo "Configuration HTTPS..."
if "${ROOT}/deploy/scripts/setup-tls.sh" app; then
  "${ROOT}/deploy/scripts/setup-tls.sh" mail || true
else
  echo "HTTPS App échoué — réessayez : bin/framm setup-tls"
fi

echo ""
echo "Bootstrap terminé."
echo "Fichier généré : ${GEN_DIR}/env.production"

cd "${ROOT}/terraform/environments/prod"
terraform output

"${ROOT}/deploy/scripts/health-check.sh" || true
