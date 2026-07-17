#!/bin/bash
# Hasu Gallery - local/private Postgres setup (secure defaults)
# Does NOT open PostgreSQL to the public internet.
# Credentials must come from the environment; nothing secret is hardcoded.

set -euo pipefail

echo "=== Hasu Gallery Postgres setup (localhost / private only) ==="
echo ""

if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    echo "Detected OS: $OS ${VERSION_ID:-}"
else
    echo "Unable to detect OS"
    exit 1
fi

DB_NAME="${DB_NAME:-hasu_gallery}"
DB_USER="${DB_USER:-hasu_user}"
DB_PASSWORD="${DB_PASSWORD:-}"

if [ -z "$DB_PASSWORD" ]; then
    echo "Set DB_PASSWORD to a strong unique secret before running this script."
    echo "Example: DB_PASSWORD=\$(openssl rand -base64 32) $0"
    exit 1
fi

echo ""
echo "[1/4] Install PostgreSQL..."
if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
    apt-get update -qq
    apt-get install -y postgresql postgresql-contrib
    systemctl enable --now postgresql
elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ] || [ "$OS" = "fedora" ]; then
    dnf install -y postgresql-server postgresql-contrib
    postgresql-setup --initdb || true
    systemctl enable --now postgresql
else
    echo "Unsupported OS: $OS"
    exit 1
fi

echo ""
echo "[2/4] Create role and database..."
sudo -u postgres psql <<EOF
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASSWORD}';
  END IF;
END
\$\$;
SELECT 'CREATE DATABASE ${DB_NAME} OWNER ${DB_USER}'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${DB_NAME}')\gexec
\c ${DB_NAME}
GRANT ALL ON SCHEMA public TO ${DB_USER};
EOF

echo ""
echo "[3/4] Keep listen address local (topology A)..."
PG_CONF=$(sudo -u postgres psql -t -P format=unaligned -c 'SHOW config_file')
# Prefer localhost-only. Do not append 0.0.0.0/0 to pg_hba.conf.
if grep -q "^#listen_addresses" "$PG_CONF" 2>/dev/null; then
    sed -i "s/^#listen_addresses.*/listen_addresses = 'localhost'/" "$PG_CONF" || true
fi

echo ""
echo "[4/4] Restart PostgreSQL and smoke-test..."
systemctl restart postgresql
sudo -u postgres psql -d "$DB_NAME" -c "SELECT 1" >/dev/null

echo ""
echo "=== Done ==="
echo "Use a local DATABASE_URL such as:"
echo "  postgres://${DB_USER}:****@127.0.0.1:5432/${DB_NAME}"
echo "Do not expose port 5432 to the public internet."
echo "See docs/edge-server-setup.md for private-network / SSH-tunnel options."
