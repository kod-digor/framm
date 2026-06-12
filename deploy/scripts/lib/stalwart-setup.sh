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

framm_stalwart_bootstrapped() {
  docker exec framm-mail-stalwart-1 test -f /etc/stalwart/config.json 2>/dev/null
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

framm_stalwart_create_api_key() {
  local body query_body api_secret env_file="/opt/framm/deploy/.generated/env.production"

  framm_stalwart_recovery_auth
  echo "Création clé API Stalwart (framm-platform)..."
  body='{"using":["urn:ietf:params:jmap:core","urn:stalwart:jmap"],"methodCalls":[["x:ApiKey/set",{"create":{"framm":{"description":"framm-platform","permissions":{"@type":"Inherit"},"allowedIps":{}}}}, "c1"]]}'
  query_body="$(framm_stalwart_jmap "$RECOVERY_USER" "$RECOVERY_PASS" "$body")"
  api_secret="$(printf '%s' "$query_body" | python3 -c 'import json,sys; r=json.load(sys.stdin); print(r["methodResponses"][0][1]["created"]["framm"]["secret"])' 2>/dev/null || true)"
  if [[ -n "$api_secret" && -f "$env_file" ]]; then
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

  framm_stalwart_ensure_api_key

  local code
  code="$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/login)"
  if [[ "$code" != "200" ]]; then
    echo "Webmail indisponible (HTTP ${code} sur /login)"
    return 1
  fi

  echo "Stalwart prêt (webmail /login HTTP ${code})"
}
