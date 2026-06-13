#!/usr/bin/env bash
# Déploiement CI : VM Mail uniquement (app sur Kapsule)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
export FRAMM_CI=true
export FRAMM_ROOT="$ROOT"

# shellcheck source=lib/framm-common.sh
source "${ROOT}/deploy/scripts/lib/framm-common.sh"

framm_ci_setup_ssh
export MAIL_PUBLIC_IP="${MAIL_PUBLIC_IP:?MAIL_PUBLIC_IP requis}"

echo "GitOps deploy → Mail ${MAIL_PUBLIC_IP}"

framm_rsync_mail

framm_ssh "$MAIL_PUBLIC_IP" bash <<'REMOTE'
set -euo pipefail
set -a
source /opt/framm/deploy/.generated/env.production
set +a
# shellcheck source=lib/stalwart-setup.sh
source /opt/framm/deploy/scripts/lib/stalwart-setup.sh
# shellcheck source=lib/host-setup.sh
source /opt/framm/deploy/scripts/lib/host-setup.sh
framm_host_setup mail
framm_host_migrate_stalwart
cd /opt/framm/deploy/docker
export COMPOSE_PROJECT_NAME=framm-mail
docker compose -f docker-compose.mail.yml pull
docker compose -f docker-compose.mail.yml up -d
framm_stalwart_ensure_ready
PRIMARY_DOMAIN="${PRIMARY_PLATFORM_DOMAIN}" \
  sed "s/\${PRIMARY_DOMAIN}/${PRIMARY_PLATFORM_DOMAIN}/g" /opt/framm/deploy/nginx/mail-ssl.conf \
  > /etc/nginx/sites-available/framm-mail
ln -sf /etc/nginx/sites-available/framm-mail /etc/nginx/sites-enabled/framm-mail
nginx -t && systemctl reload nginx
REMOTE

WEBMAIL_URL="${WEBMAIL_URL:-https://webmail.kod-digor.bzh}" "${ROOT}/deploy/scripts/health-check.sh"
echo "Déploiement mail terminé"
