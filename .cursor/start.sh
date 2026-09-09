#!/usr/bin/env bash
# Initialisation par démarrage (couche "start").
# Démarre PostgreSQL, garantit la base/rôle framm, génère apps/web/.env.local si absent,
# applique les migrations Prisma et lance le seed. Idempotent.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEB="${ROOT}/apps/web"

DB_USER="framm"
DB_PASSWORD="framm"
DB_NAME="framm"
export DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}"

echo "=== [start] PostgreSQL ==="
if ! sudo pg_lsclusters -h 2>/dev/null | grep -q online; then
  sudo pg_ctlcluster 16 main start || sudo pg_ctlcluster "$(pg_lsclusters -h | awk 'NR==1{print $1}')" main start
fi

# Attendre que le socket réponde.
for _ in $(seq 1 30); do
  if sudo -u postgres pg_isready -q; then break; fi
  sleep 1
done

echo "=== [start] Rôle & base ==="
sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}' CREATEDB;"
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"

echo "=== [start] apps/web/.env.local ==="
if [[ ! -f "${WEB}/.env.local" ]]; then
  cat > "${WEB}/.env.local" <<EOF
DATABASE_URL=${DATABASE_URL}
AUTH_SECRET=dev-secret-change-in-production
AUTH_URL=http://localhost:3000
PLATFORM_DOMAINS=kod-digor.bzh
WEBMAIL_URL=https://webmail.kod-digor.bzh
STALWART_URL=https://mail.kod-digor.bzh
BUREAU_ADMIN_EMAIL=admin@kod-digor.bzh
BUREAU_ADMIN_PASSWORD=DevAdmin1234!
EOF
  echo "Généré."
else
  echo "Déjà présent — conservé."
fi

echo "=== [start] Migrations Prisma ==="
cd "${WEB}"
pnpm exec prisma migrate deploy

echo "=== [start] Seed ==="
pnpm db:seed || echo "[start] seed non critique — ignoré"

echo "=== [start] Prêt ==="
