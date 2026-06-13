#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_FILE="${ROOT}/deploy/.generated/env.production"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$ENV_FILE"
  set +a
fi

AUTH_URL="${AUTH_URL:-https://kod-digor.bzh}"
WEBMAIL_URL="${WEBMAIL_URL:-https://webmail.kod-digor.bzh}"
FAIL=0

check() {
  local name="$1"
  local url="$2"
  if curl -sf --max-time 10 "$url" > /dev/null 2>&1; then
    echo "OK  $name"
  else
    echo "FAIL $name ($url)"
    FAIL=1
  fi
}

check_tls() {
  local name="$1"
  local url="$2"
  local code
  code="$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url" 2>/dev/null || echo "000")"
  if [[ "$code" != "000" && "$code" != "502" && "$code" != "503" ]]; then
    echo "OK  $name (HTTP ${code})"
  else
    echo "FAIL $name ($url)"
    FAIL=1
  fi
}

check "App health" "${AUTH_URL}/api/health"
if [[ -n "${WEBMAIL_URL:-}" && "${WEBMAIL_URL}" != "skip" ]]; then
  check_tls "Webmail" "${WEBMAIL_URL}/login"
fi

if [[ $FAIL -ne 0 && "${FRAMM_CI:-}" == "true" && -n "${MAIL_PUBLIC_IP:-}" ]]; then
  FAIL=0
  # shellcheck source=lib/framm-common.sh
  source "${ROOT}/deploy/scripts/lib/framm-common.sh"
  framm_ci_setup_ssh
  if [[ -n "${MAIL_PUBLIC_IP:-}" ]]; then
    code="$(framm_ssh "$MAIL_PUBLIC_IP" "curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8080/login" 2>/dev/null || echo "000")"
    if [[ "$code" != "000" && "$code" != "502" && "$code" != "503" ]]; then
      echo "OK  Webmail (via VM, HTTP ${code})"
    else
      echo "FAIL Webmail (via VM)"
      FAIL=1
    fi
  fi
fi

if [[ $FAIL -eq 0 ]]; then
  echo "Health check passed"
  exit 0
fi

echo "Health check failed"
exit 1
