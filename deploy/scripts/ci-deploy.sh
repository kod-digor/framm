#!/usr/bin/env bash
# Déploiement GitOps depuis GitHub Actions (push main/master)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
export FRAMM_CI=true
export FRAMM_ROOT="$ROOT"

# shellcheck source=lib/framm-common.sh
source "${ROOT}/deploy/scripts/lib/framm-common.sh"

framm_ci_setup_ssh
framm_load_deploy_context

echo "GitOps deploy → App ${APP_PUBLIC_IP} / Mail ${MAIL_PUBLIC_IP}"

"${ROOT}/deploy/scripts/update-stack.sh"
