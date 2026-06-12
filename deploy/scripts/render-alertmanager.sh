#!/usr/bin/env bash
# Rend la config Alertmanager en local (deploy/.generated/, jamais commitée —
# elle contient les identifiants SMTP). Sur les VMs, le même rendu est fait
# à chaque déploiement par framm_host_render_alertmanager (lib/host-setup.sh).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_FILE="${ROOT}/deploy/.generated/env.production"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Fichier env.production manquant — lancez bin/framm bootstrap d'abord"
  exit 1
fi

set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

# shellcheck source=lib/host-setup.sh
source "${ROOT}/deploy/scripts/lib/host-setup.sh"
framm_host_render_alertmanager "${ROOT}/deploy/.generated/alertmanager.yml"
