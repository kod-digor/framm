#!/usr/bin/env bash
# Déploiement prod : app sur Kapsule, mail sur VM
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=lib/framm-common.sh
source "${ROOT}/deploy/scripts/lib/framm-common.sh"

if [[ "${FRAMM_CI:-}" == "true" ]]; then
  framm_ci_setup_ssh
  framm_load_deploy_context
else
  framm_load_env
  framm_load_tf_outputs
fi

echo "Mise à jour stack distante..."

"${ROOT}/deploy/scripts/remote-deploy-mail.sh"

echo "Mise à jour secrets K8s..."
"${ROOT}/deploy/scripts/k8s-bootstrap.sh"

"${ROOT}/deploy/scripts/health-check.sh"
echo "Mise à jour terminée"
