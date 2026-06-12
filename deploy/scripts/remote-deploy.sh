#!/usr/bin/env bash
# Déploie la stack Docker sur les VMs via SSH
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=lib/framm-common.sh
source "${ROOT}/deploy/scripts/lib/framm-common.sh"

framm_load_env
framm_load_tf_outputs

framm_wait_ssh "$APP_PUBLIC_IP"
framm_wait_ssh "$MAIL_PUBLIC_IP"

echo "Synchronisation VM App..."
framm_rsync_app

echo "Synchronisation VM Mail..."
framm_rsync_mail

framm_push_env

echo "Déploiement stack App (postgres, web, worker, observability)..."
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

docker compose -f docker-compose.app.yml -f docker-compose.observability.yml build web
framm_docker_prune_for_build
docker compose -f docker-compose.app.yml build worker
docker compose -f docker-compose.app.yml -f docker-compose.observability.yml up -d postgres
sleep 5
docker compose -f docker-compose.app.yml run --rm worker npx prisma migrate deploy
docker compose -f docker-compose.app.yml run --rm worker npm run db:seed
docker compose -f docker-compose.app.yml -f docker-compose.observability.yml up -d --force-recreate web worker
framm_docker_prune_for_build
REMOTE

echo "Déploiement stack Mail (Stalwart)..."
framm_ssh "$MAIL_PUBLIC_IP" bash <<'REMOTE'
set -euo pipefail
set -a
source /opt/framm/deploy/.generated/env.production
set +a
# shellcheck source=lib/host-setup.sh
source /opt/framm/deploy/scripts/lib/host-setup.sh
framm_host_setup mail
framm_host_migrate_stalwart
cd /opt/framm/deploy/docker
export COMPOSE_PROJECT_NAME=framm-mail
docker compose -f docker-compose.mail.yml pull
docker compose -f docker-compose.mail.yml up -d
# shellcheck source=lib/stalwart-setup.sh
source /opt/framm/deploy/scripts/lib/stalwart-setup.sh
framm_stalwart_ensure_ready
REMOTE

echo "Nginx HTTP (pré-TLS)..."
framm_ssh "$APP_PUBLIC_IP" bash -s "$PRIMARY_PLATFORM_DOMAIN" <<'REMOTE'
set -euo pipefail
DOMAIN="$1"
sed "s/\${PRIMARY_DOMAIN}/${DOMAIN}/g" /opt/framm/deploy/nginx/app-http.conf > /etc/nginx/sites-available/framm
ln -sf /etc/nginx/sites-available/framm /etc/nginx/sites-enabled/framm
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl enable nginx && systemctl reload nginx
REMOTE

framm_ssh "$MAIL_PUBLIC_IP" bash -s "$PRIMARY_PLATFORM_DOMAIN" <<'REMOTE'
set -euo pipefail
DOMAIN="$1"
sed "s/\${PRIMARY_DOMAIN}/${DOMAIN}/g" /opt/framm/deploy/nginx/mail-http.conf > /etc/nginx/sites-available/framm-mail
ln -sf /etc/nginx/sites-available/framm-mail /etc/nginx/sites-enabled/framm-mail
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl enable nginx && systemctl reload nginx
REMOTE

echo "Déploiement distant terminé"
