#!/usr/bin/env bash
# Propagation post-Terraform : env.production → VM mail + secrets K8s.
# Appelé automatiquement par tf-apply.sh ; idempotent.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_FILE="${ROOT}/deploy/.generated/env.production"

[[ -f "$ENV_FILE" ]] || {
  echo "post-tf-apply : env.production absent — rien à propager"
  exit 0
}

# shellcheck source=lib/framm-common.sh
source "${ROOT}/deploy/scripts/lib/framm-common.sh"

if [[ "${FRAMM_CI:-}" == "true" ]]; then
  framm_ci_setup_ssh
  framm_load_deploy_context
else
  framm_load_env
  framm_load_tf_outputs 2>/dev/null || true
fi

if [[ -n "${MAIL_PUBLIC_IP:-}" ]]; then
  echo "=== Propagation env.production → VM mail ==="
  if framm_wait_ssh "$MAIL_PUBLIC_IP" 3 2>/dev/null; then
    framm_push_env
    framm_ssh "$MAIL_PUBLIC_IP" bash <<'REMOTE'
set -euo pipefail
set -a
# shellcheck source=/dev/null
source /opt/framm/deploy/.generated/env.production
set +a
# shellcheck source=lib/stalwart-setup.sh
source /opt/framm/deploy/scripts/lib/stalwart-setup.sh
framm_stalwart_configure_outbound_relay || true
REMOTE
  else
    echo "AVERTISSEMENT : VM mail injoignable — env.production non poussé" >&2
  fi
else
  echo "AVERTISSEMENT : MAIL_PUBLIC_IP inconnu — env.production non poussé sur la VM mail" >&2
fi

if [[ -f "${ROOT}/deploy/.generated/kubeconfig" ]]; then
  "${ROOT}/deploy/scripts/k8s-sync-secrets.sh"
else
  echo "AVERTISSEMENT : kubeconfig absent — secrets K8s non synchronisés" >&2
fi
