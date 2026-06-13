#!/usr/bin/env bash
# Configuration de l'hôte (cron backups, outils, alertmanager) — sourcer sur la VM.
# Idempotent : appelé à chaque déploiement.

framm_host_install_aws_cli_v2() {
  if command -v aws >/dev/null 2>&1; then
    return 0
  fi
  DEBIAN_FRONTEND=noninteractive apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq curl unzip
  local aws_tmp
  aws_tmp="$(mktemp -d)"
  curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "${aws_tmp}/awscliv2.zip"
  unzip -q "${aws_tmp}/awscliv2.zip" -d "${aws_tmp}"
  "${aws_tmp}/aws/install" -i /usr/local/aws-cli -b /usr/local/bin --update
  rm -rf "${aws_tmp}"
}

framm_host_ensure_tools() {
  mkdir -p /var/lib/node_exporter/textfile_collector
  if ! command -v aws >/dev/null 2>&1; then
    framm_host_install_aws_cli_v2
  fi
}

framm_host_install_backup_cron() {
  local kind="$1" line
  case "$kind" in
    app)  line="0 3 * * * root /opt/framm/deploy/scripts/backup-postgres.sh >> /var/log/framm-backup.log 2>&1" ;;
    mail) line="30 3 * * * root /opt/framm/deploy/scripts/backup-stalwart.sh >> /var/log/framm-backup.log 2>&1" ;;
    *) echo "framm_host_install_backup_cron: type inconnu '$kind'" >&2; return 1 ;;
  esac
  printf 'SHELL=/bin/bash\nPATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin\n%s\n' "$line" \
    > /etc/cron.d/framm-backup
  chmod 644 /etc/cron.d/framm-backup
}

# Rend /opt/framm/deploy/.generated/alertmanager.yml depuis l'environnement
# (env.production doit être sourcé). Sans SMTP configuré, on génère un
# receiver vide pour qu'Alertmanager démarre quand même au lieu de crash-looper.
framm_host_render_alertmanager() {
  local out="${1:-/opt/framm/deploy/.generated/alertmanager.yml}"
  local email="${ALERT_EMAIL:-${BUREAU_ADMIN_EMAIL:-}}"
  local from="${ALERT_SMTP_FROM:-alertes@${PRIMARY_PLATFORM_DOMAIN:-localhost}}"
  mkdir -p "$(dirname "$out")"

  if [[ -n "${ALERT_SMTP_HOST:-}" && -n "$email" ]]; then
    cat > "$out" <<EOF
global:
  smtp_smarthost: ${ALERT_SMTP_HOST}:${ALERT_SMTP_PORT:-587}
  smtp_from: ${from}
  smtp_auth_username: '${ALERT_SMTP_USER:-}'
  smtp_auth_password: '${ALERT_SMTP_PASSWORD:-}'
  smtp_require_tls: true

route:
  receiver: bureau
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h

receivers:
  - name: bureau
    email_configs:
      - to: ${email}
        send_resolved: true
EOF
    echo "Alertmanager configuré (SMTP ${ALERT_SMTP_HOST} → ${email})"
  else
    cat > "$out" <<EOF
# ALERT_SMTP_HOST non défini : aucune notification ne sera envoyée.
# Renseignez ALERT_SMTP_* dans .env puis relancez bin/framm bootstrap.
route:
  receiver: bureau
receivers:
  - name: bureau
EOF
    echo "AVERTISSEMENT : ALERT_SMTP_HOST absent — les alertes ne seront PAS envoyées par email" >&2
  fi
}

# Migration unique : copie les données Stalwart depuis la couche du conteneur
# vers /opt/framm/mail-data avant le premier déploiement avec montage volume.
framm_host_migrate_stalwart() {
  local c
  c="$(docker ps -aqf name=stalwart | head -1)"
  [[ -n "$c" ]] || return 0
  [[ -z "$(ls -A /opt/framm/mail-data 2>/dev/null)" ]] || return 0
  if docker inspect "$c" --format '{{range .Mounts}}{{.Destination}}{{"\n"}}{{end}}' \
      | grep -q '^/var/lib/stalwart$'; then
    return 0
  fi
  echo "Migration des données Stalwart vers /opt/framm/mail-data..."
  docker stop "$c" >/dev/null
  mkdir -p /opt/framm/mail-data
  docker cp "$c":/var/lib/stalwart/. /opt/framm/mail-data/ 2>/dev/null || true
  chown -R 2000:2000 /opt/framm/mail-data
  docker start "$c" >/dev/null || true
  echo "Migration Stalwart terminée ($(du -sh /opt/framm/mail-data | cut -f1))"
}

framm_host_setup() {
  framm_host_ensure_tools
  framm_host_install_backup_cron "$1"
}
