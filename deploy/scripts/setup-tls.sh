#!/usr/bin/env bash
# Configure HTTPS via Let's Encrypt (ACME, gratuit, sans compte à créer)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=lib/framm-common.sh
source "${ROOT}/deploy/scripts/lib/framm-common.sh"

ROLE="${1:?Usage: setup-tls.sh app|mail}"

framm_load_env
framm_load_tf_outputs

DOMAIN="$PRIMARY_PLATFORM_DOMAIN"
EMAIL="${BUREAU_ADMIN_EMAIL}"
ACME_SERVER="https://acme-v02.api.letsencrypt.org/directory"

echo "ACME : Let's Encrypt"

run_certbot() {
  local host="$1"
  shift
  local domains=("$@")
  local domain_args=""
  local d
  for d in "${domains[@]}"; do
    domain_args+=" -d '${d}'"
  done

  framm_ssh "$host" "mkdir -p /var/www/acme && certbot certonly --non-interactive --agree-tos --email '${EMAIL}' --server '${ACME_SERVER}' --webroot -w /var/www/acme${domain_args}"
}

setup_app_tls() {
  framm_ssh "$APP_PUBLIC_IP" "sed 's/\${PRIMARY_DOMAIN}/${DOMAIN}/g' /opt/framm/deploy/nginx/app-http.conf > /etc/nginx/sites-available/framm && ln -sf /etc/nginx/sites-available/framm /etc/nginx/sites-enabled/framm && rm -f /etc/nginx/sites-enabled/default && nginx -t && systemctl reload nginx"

  run_certbot "$APP_PUBLIC_IP" "$DOMAIN" "www.${DOMAIN}" "grafana.${DOMAIN}" "staging.${DOMAIN}"

  framm_ssh "$APP_PUBLIC_IP" "sed 's/\${PRIMARY_DOMAIN}/${DOMAIN}/g' /opt/framm/deploy/nginx/app-ssl.conf > /etc/nginx/sites-available/framm && nginx -t && systemctl reload nginx"
}

setup_mail_tls() {
  framm_ssh "$MAIL_PUBLIC_IP" "sed 's/\${PRIMARY_DOMAIN}/${DOMAIN}/g' /opt/framm/deploy/nginx/mail-http.conf > /etc/nginx/sites-available/framm-mail && ln -sf /etc/nginx/sites-available/framm-mail /etc/nginx/sites-enabled/framm-mail && rm -f /etc/nginx/sites-enabled/default && nginx -t && systemctl reload nginx"

  run_certbot "$MAIL_PUBLIC_IP" "webmail.${DOMAIN}" "mail.${DOMAIN}"

  framm_ssh "$MAIL_PUBLIC_IP" "sed 's/\${PRIMARY_DOMAIN}/${DOMAIN}/g' /opt/framm/deploy/nginx/mail-ssl.conf > /etc/nginx/sites-available/framm-mail && nginx -t && systemctl reload nginx"
}

case "$ROLE" in
  app) setup_app_tls ;;
  mail) setup_mail_tls ;;
  *) echo "Rôle inconnu: $ROLE"; exit 1 ;;
esac

echo "HTTPS configuré (${ROLE})"
