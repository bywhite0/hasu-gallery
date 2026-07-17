#!/bin/bash
# Verify database schema on the host where Postgres is installed.
# Prefer running as a role that can access hasu_gallery without printing secrets.

set -euo pipefail

DB_NAME="${DB_NAME:-hasu_gallery}"

echo "=== Verify Hasu Gallery database ==="
echo ""

echo "[1/3] List tables..."
sudo -u postgres psql -d "$DB_NAME" -c "\dt"

echo ""
echo "[2/3] Migration history..."
sudo -u postgres psql -d "$DB_NAME" -c "SELECT version, description, installed_on FROM _sqlx_migrations ORDER BY installed_on DESC;"

echo ""
echo "[3/3] Approximate row counts..."
sudo -u postgres psql -d "$DB_NAME" <<'EOF'
SELECT
  schemaname,
  tablename,
  (xpath('/row/cnt/text()', xml_count))[1]::text::int as row_count
FROM (
  SELECT
    schemaname,
    tablename,
    query_to_xml(format('SELECT COUNT(*) as cnt FROM %I.%I', schemaname, tablename), false, true, '') as xml_count
  FROM pg_tables
  WHERE schemaname = 'public'
) t
ORDER BY tablename;
EOF

echo ""
echo "=== Done ==="
