#!/usr/bin/env bash
# Bootstrap durable de l'environnement Cloud Agent (couche "install").
# Idempotent : installe PostgreSQL + les dépendances pnpm de apps/web et génère le client Prisma.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== [install] PostgreSQL ==="
if ! command -v pg_ctlcluster >/dev/null 2>&1; then
  sudo apt-get update -qq
  sudo apt-get install -y -qq postgresql postgresql-contrib
else
  echo "PostgreSQL déjà installé."
fi

echo "=== [install] Dépendances apps/web ==="
cd "${ROOT}/apps/web"
corepack enable >/dev/null 2>&1 || true
pnpm install --frozen-lockfile

echo "=== [install] Client Prisma ==="
pnpm exec prisma generate

echo "=== [install] Terminé ==="
