#!/usr/bin/env bash
# Configuration Stalwart (bootstrap + clé API) — sourcer sur la VM Mail

framm_stalwart_jmap() {
  local user="$1"
  local pass="$2"
  local body="$3"
  curl -sf -u "${user}:${pass}" "http://127.0.0.1:8080/jmap" \
    -H "Content-Type: application/json" \
    -d "$body"
}

framm_stalwart_local_rcpt_ok() {
  local addr="${1:?}"
  local ehlo_host="mail.${PRIMARY_PLATFORM_DOMAIN:?}"
  docker exec framm-mail-stalwart-1 env "RCPT_ADDR=${addr}" "EHLO_HOST=${ehlo_host}" bash -c '
    exec 3<>/dev/tcp/127.0.0.1/25
    read -r _ <&3
    printf "EHLO %s\r\n" "$EHLO_HOST" >&3
    while IFS= read -r -t 2 line <&3; do
      case "$line" in ???[^-]*) break;; esac
    done
    printf "MAIL FROM:<probe@localhost>\r\n" >&3
    read -r -t 2 _ <&3
    printf "RCPT TO:<%s>\r\n" "$RCPT_ADDR" >&3
    read -r -t 2 line <&3
    printf "QUIT\r\n" >&3
    case "$line" in 250*) exit 0;; *) echo "$line" >&2; exit 1;; esac
  ' 2>/dev/null
}

framm_stalwart_bootstrapped() {
  docker exec framm-mail-stalwart-1 test -f /etc/stalwart/config.json 2>/dev/null || return 1
  local probe="admin@${PRIMARY_PLATFORM_DOMAIN:?}"
  framm_stalwart_local_rcpt_ok "$probe"
}

framm_stalwart_recovery_auth() {
  local recovery="${STALWART_RECOVERY_ADMIN:-admin:${STALWART_API_KEY}}"
  RECOVERY_USER="${recovery%%:*}"
  RECOVERY_PASS="${recovery#*:}"
}

framm_stalwart_run_bootstrap() {
  local domain="${PRIMARY_PLATFORM_DOMAIN:?}"
  local mail_host="mail.${domain}"
  local body

  framm_stalwart_recovery_auth

  body="$(cat <<EOF
{
  "using": ["urn:ietf:params:jmap:core", "urn:stalwart:jmap"],
  "methodCalls": [[
    "x:Bootstrap/set",
    {
      "update": {
        "singleton": {
          "serverHostname": "${mail_host}",
          "defaultDomain": "${domain}",
          "requestTlsCertificate": false,
          "generateDkimKeys": true,
          "directory": { "@type": "Internal" },
          "dnsServer": { "@type": "Manual" }
        }
      }
    },
    "bootstrap"
  ]]
}
EOF
)"

  echo "Bootstrap Stalwart (${mail_host} / ${domain})..."
  framm_stalwart_jmap "$RECOVERY_USER" "$RECOVERY_PASS" "$body" >/dev/null
  cd /opt/framm/deploy/docker
  export COMPOSE_PROJECT_NAME=framm-mail
  docker compose -f docker-compose.mail.yml restart stalwart
  sleep 5
}

framm_stalwart_api_key_valid() {
  local code
  code="$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer ${STALWART_API_KEY}" \
    -H "Content-Type: application/json" \
    -d '{"using":["urn:ietf:params:jmap:core","urn:stalwart:jmap"],"methodCalls":[["x:Domain/query",{"filter":{}},"q1"]]}' \
    http://127.0.0.1:8080/jmap)"
  [[ "$code" == "200" ]]
}

framm_stalwart_admin_account_id() {
  local query_body account_id
  framm_stalwart_recovery_auth
  query_body="$(framm_stalwart_jmap "$RECOVERY_USER" "$RECOVERY_PASS" \
    '{"using":["urn:ietf:params:jmap:core","urn:stalwart:jmap"],"methodCalls":[["x:Account/query",{"filter":{}},"q1"]]}' \
    2>/dev/null || true)"
  account_id="$(printf '%s' "$query_body" | python3 -c '
import json, sys
r = json.load(sys.stdin)
ids = r["methodResponses"][0][1].get("ids", [])
print(ids[0] if ids else "")
' 2>/dev/null || true)"
  [[ -n "$account_id" ]] || return 1
  printf '%s' "$account_id"
}

framm_stalwart_extract_api_secret() {
  python3 -c '
import json, sys
r = json.load(sys.stdin)
resp = r["methodResponses"][0][1]
created = resp.get("created", {})
if created:
    print(next(iter(created.values())).get("secret", ""))
' 2>/dev/null || true
}

framm_stalwart_create_api_key() {
  local body query_body api_secret env_file="/opt/framm/deploy/.generated/env.production"
  local create_id="framm-$(date +%s)" admin_account_id

  framm_stalwart_recovery_auth
  admin_account_id="$(framm_stalwart_admin_account_id)" || {
    echo "Compte admin Stalwart introuvable (x:Account/query)"
    return 1
  }

  echo "Création clé API Stalwart (framm-platform, compte ${admin_account_id})..."
  body="$(cat <<EOF
{"using":["urn:ietf:params:jmap:core","urn:stalwart:jmap"],"methodCalls":[["x:ApiKey/set",{"accountId":"${admin_account_id}","create":{"${create_id}":{"description":"framm-platform","permissions":{"@type":"Inherit"},"allowedIps":{}}}}, "c1"]]}
EOF
)"
  query_body="$(framm_stalwart_jmap "$RECOVERY_USER" "$RECOVERY_PASS" "$body" 2>/dev/null || true)"
  api_secret="$(printf '%s' "$query_body" | framm_stalwart_extract_api_secret)"

  if [[ -z "$api_secret" && -n "${STALWART_ADMIN_PASSWORD:-}" ]]; then
    local admin_user="admin@${PRIMARY_PLATFORM_DOMAIN:?}"
    echo "Tentative création clé API via ${admin_user}..."
    query_body="$(framm_stalwart_jmap "$admin_user" "$STALWART_ADMIN_PASSWORD" "$body" 2>/dev/null || true)"
    api_secret="$(printf '%s' "$query_body" | framm_stalwart_extract_api_secret)"
  fi

  if [[ -z "$api_secret" ]]; then
    echo "Échec création clé API Stalwart"
    printf '%s\n' "$query_body" | head -c 500
    echo
    return 1
  fi

  if [[ -f "$env_file" ]]; then
    sed -i "s|^STALWART_API_KEY=.*|STALWART_API_KEY=${api_secret}|" "$env_file"
    export STALWART_API_KEY="$api_secret"
    echo "STALWART_API_KEY mis à jour dans env.production"
  fi
}

framm_stalwart_ensure_api_key() {
  if framm_stalwart_api_key_valid; then
    return 0
  fi
  framm_stalwart_create_api_key
}

framm_stalwart_ensure_ready() {
  set -a
  # shellcheck source=/dev/null
  source /opt/framm/deploy/.generated/env.production
  set +a

  if ! framm_stalwart_bootstrapped; then
    framm_stalwart_run_bootstrap
  fi

  framm_stalwart_ensure_api_key || return 1
  framm_stalwart_api_key_valid || {
    echo "Clé API Stalwart invalide après création"
    return 1
  }

  local code
  code="$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/login)"
  if [[ "$code" != "200" ]]; then
    echo "Webmail indisponible (HTTP ${code} sur /login)"
    return 1
  fi

  echo "Stalwart prêt (webmail /login HTTP ${code})"
  framm_stalwart_warn_outbound_smtp || true
}

framm_stalwart_outbound_smtp_reachable() {
  local mx_host="${1:-ASPMX.L.GOOGLE.COM}"
  docker exec framm-mail-stalwart-1 env "MX_HOST=${mx_host}" bash -c '
    timeout 8 bash -c "exec 3<>/dev/tcp/$MX_HOST/25 && read -r line <&3 && case \"\$line\" in 220*) exit 0;; *) exit 1;; esac"
  ' 2>/dev/null
}

framm_stalwart_warn_outbound_smtp() {
  if framm_stalwart_outbound_smtp_reachable; then
    echo "SMTP sortant (TCP/25) : OK"
    return 0
  fi
  echo "ATTENTION: SMTP sortant TCP/25 bloqué (Scaleway anti-spam sur le SG)."
  echo "  Les redirections MailingList vers des adresses externes restent en file (queue remote)."
  echo "  Ouvrir un ticket Scaleway pour autoriser le SMTP sortant sur la VM mail,"
  echo "  ou configurer un relais SMTP sur un port autorisé (ex. 2525)."
  return 1
}
