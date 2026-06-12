#!/usr/bin/env bash
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

framm_rsync_app
framm_rsync_mail

if [[ "${FRAMM_CI:-}" != "true" ]]; then
  framm_push_env
fi

framm_ssh "$APP_PUBLIC_IP" bash <<'REMOTE'
set -euo pipefail
set -a
source /opt/framm/deploy/.generated/env.production
set +a
# shellcheck source=lib/docker-disk.sh
source /opt/framm/deploy/scripts/lib/docker-disk.sh
# shellcheck source=lib/host-setup.sh
source /opt/framm/deploy/scripts/lib/host-setup.sh
framm_host_setup app
framm_host_render_alertmanager
framm_docker_prepare_build
docker compose -f docker-compose.app.yml build web
framm_docker_prune_for_build
docker compose -f docker-compose.app.yml build worker
docker compose -f docker-compose.app.yml run --rm worker npx prisma migrate deploy
docker compose -f docker-compose.app.yml run --rm worker npm run db:seed
docker compose -f docker-compose.app.yml -f docker-compose.observability.yml up -d --force-recreate web worker
docker compose -f docker-compose.app.yml -f docker-compose.observability.yml up -d
framm_docker_prune_for_build
REMOTE

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

STALWART_KEY_LINE="$(framm_ssh "$MAIL_PUBLIC_IP" "grep '^STALWART_API_KEY=' /opt/framm/deploy/.generated/env.production" 2>/dev/null || true)"
if [[ -n "$STALWART_KEY_LINE" ]]; then
  framm_ssh "$APP_PUBLIC_IP" bash <<REMOTE
set -euo pipefail
set -a
source /opt/framm/deploy/.generated/env.production
set +a
sed -i 's|^STALWART_API_KEY=.*|${STALWART_KEY_LINE}|' /opt/framm/deploy/.generated/env.production
cd /opt/framm/deploy/docker
export COMPOSE_PROJECT_NAME=framm
docker compose -f docker-compose.app.yml up -d --force-recreate web worker
REMOTE
fi

"${ROOT}/deploy/scripts/health-check.sh"
echo "Mise à jour terminée"
