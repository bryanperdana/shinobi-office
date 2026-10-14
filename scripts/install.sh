#!/usr/bin/env bash
# Install / update the Shinobi Office desktop plugin. Hot-reloads in Hermes Desktop
# (file watcher) — no gateway restart. Previous plugin.js is backed up first.
# Usage: scripts/install.sh            install dist/plugin.js
#        scripts/install.sh --remove   move the installed plugin into .backups (reversible)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# Desktop scans the GLOBAL ~/.hermes/desktop-plugins (HERMES_HOME may point at a profile dir)
DEST_DIR="${SHINOBI_PLUGIN_DIR:-$HOME/.hermes/desktop-plugins}"
ID="shinobi-office"
TS="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$DEST_DIR/.backups"

if [[ "${1:-}" == "--remove" ]]; then
  if [[ -d "$DEST_DIR/$ID" ]]; then
    mv "$DEST_DIR/$ID" "$DEST_DIR/.backups/$ID-removed-$TS"
    echo "removed → $DEST_DIR/.backups/$ID-removed-$TS"
  else
    echo "not installed"
  fi
  exit 0
fi

SRC="$ROOT/dist/plugin.js"
[[ -f "$SRC" ]] || { echo "dist/plugin.js missing — run: npm run build" >&2; exit 1; }
SIZE=$(wc -c < "$SRC")
(( SIZE < 16*1024*1024 )) || { echo "plugin.js too large ($SIZE bytes)" >&2; exit 1; }
mkdir -p "$DEST_DIR/$ID"
if [[ -f "$DEST_DIR/$ID/plugin.js" ]]; then
  cp "$DEST_DIR/$ID/plugin.js" "$DEST_DIR/.backups/$ID-$TS.plugin.js"
  echo "backup → $DEST_DIR/.backups/$ID-$TS.plugin.js"
fi
cp "$SRC" "$DEST_DIR/$ID/plugin.js.tmp" && mv "$DEST_DIR/$ID/plugin.js.tmp" "$DEST_DIR/$ID/plugin.js"
echo "installed $ID ($SIZE bytes) sha256=$( (shasum -a 256 "$DEST_DIR/$ID/plugin.js" 2>/dev/null || sha256sum "$DEST_DIR/$ID/plugin.js") | cut -d' ' -f1)"
