#!/usr/bin/env bash
identity=()
if [[ -n "${SSH_PRIVATE_KEY_FILE:-}" && -f "${SSH_PRIVATE_KEY_FILE}" ]]; then
  identity=(-i "${SSH_PRIVATE_KEY_FILE}")
fi
exec ssh \
  "${identity[@]}" \
  -o BatchMode=yes \
  -o StrictHostKeyChecking=accept-new \
  -o "UserKnownHostsFile=/tmp/framm-ssh-known-hosts-${UID:-0}" \
  -o ConnectTimeout=15 \
  "$@"
