# Sync Rspack production build into galleryd embed directory.
# Usage (repo root):
#   pnpm --filter @hasu-gallery/web build
#   bash scripts/sync-web-embed.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/apps/web/dist"
DEST="$ROOT/backend/embedded-web"

if [ ! -d "$SRC" ]; then
  echo "error: missing $SRC — run: pnpm --filter @hasu-gallery/web build" >&2
  exit 1
fi

if [ ! -f "$SRC/index.html" ]; then
  echo "error: $SRC/index.html not found" >&2
  exit 1
fi

rm -rf "$DEST"
mkdir -p "$DEST"
# Prefer rsync when available; fall back to cp -a.
if command -v rsync >/dev/null 2>&1; then
  rsync -a --delete --exclude='*.map' "$SRC"/ "$DEST"/
else
  cp -a "$SRC"/. "$DEST"/
fi
# Source maps are private build artifacts; never embed them in the public binary.
find "$DEST" -name '*.map' -type f -delete

echo "synced $SRC -> $DEST (source maps excluded)"
