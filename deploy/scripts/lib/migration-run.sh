#!/usr/bin/env bash
# Wrapper imapsync pour la VM mail Framm.
# Usage : migration-run.sh <migration_id> (optionnel — le worker Framm lance imapsync directement)
#
# Installation sur la VM mail :
#   apt install imapsync   # ou depuis https://imapsync.lamiral.info/
#
# Variables d'environnement (docker-compose.mail.yml / env.production) :
#   MIGRATION_STALWART_IMAP_HOST — hostname IMAP cible (défaut : hostname STALWART_URL)
#   MIGRATION_STALWART_IMAP_PORT — port IMAP cible (défaut : 993)
#   IMAPSYNC_PATH — chemin binaire imapsync si hors PATH
#   IMAPSYNC_MAX_PARALLEL — dossiers synchronisés en parallèle (défaut : 4)
#   IMAPSYNC_MAX_BYTES_PER_SECOND — limite débit optionnelle (ex. 5000000)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=framm-common.sh
source "${SCRIPT_DIR}/framm-common.sh"

IMAPSYNC_BIN="${IMAPSYNC_PATH:-imapsync}"
MAX_PARALLEL="${IMAPSYNC_MAX_PARALLEL:-4}"

if ! command -v "${IMAPSYNC_BIN}" >/dev/null 2>&1; then
  log_error "imapsync introuvable (${IMAPSYNC_BIN}). Installez imapsync sur la VM mail."
  exit 127
fi

log_info "imapsync disponible : $(command -v "${IMAPSYNC_BIN}")"
log_info "Parallélisme dossiers (--maxparallel) : ${MAX_PARALLEL}"
log_info "Les migrations sont orchestrées par le worker Framm (apps/web/src/worker/migration-worker.ts)."
log_info "Exemple de flags imapsync utilisés : --maxparallel ${MAX_PARALLEL} --automap --usecache"
log_info "Ce script sert de vérification et point d'entrée manuel si nécessaire."

exit 0
