#!/bin/bash
# Smoke-test local API + database using environment configuration only.

set -euo pipefail

echo "=== Hasu Gallery connection smoke test ==="
echo ""

API_BASE="${API_BASE:-http://127.0.0.1:8787}"
DATABASE_URL="${DATABASE_URL:-}"

echo "[1/3] API health..."
if curl -f -s "${API_BASE}/health" >/dev/null 2>&1; then
    echo "OK: API health"
else
    echo "FAIL: API not reachable at ${API_BASE}/health"
    exit 1
fi

if [ -z "$DATABASE_URL" ]; then
    echo ""
    echo "[2/3] DATABASE_URL not set; skipping direct psql checks."
    echo "Set DATABASE_URL to also inspect tables and migrations."
    echo ""
    echo "=== Done (API only) ==="
    exit 0
fi

echo ""
echo "[2/3] List tables..."
psql "$DATABASE_URL" -c "\dt" | head -20

echo ""
echo "[3/3] Recent migrations..."
psql "$DATABASE_URL" -c "SELECT * FROM _sqlx_migrations ORDER BY installed_on DESC LIMIT 5"

echo ""
echo "=== Done ==="
