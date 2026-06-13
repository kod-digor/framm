#!/usr/bin/env bash
# Point d'entrée historique — délègue au déploiement mail + Kapsule
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
exec "${ROOT}/deploy/scripts/remote-deploy-mail.sh"
