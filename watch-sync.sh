#!/usr/bin/env bash

# Watch and auto-sync script for bb-space-website
# Monitors the repository and automatically syncs to GitHub.

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WATCH_DIR="${WATCH_DIR:-$SCRIPT_DIR}"
SYNC_INTERVAL="${SYNC_INTERVAL:-300}" # 5 minutes

echo "👀 Starting file watcher for auto-sync..."
echo "📁 Watching: $WATCH_DIR"
echo "⏰ Sync interval: $SYNC_INTERVAL seconds"
echo "Press Ctrl+C to stop"

cd "$WATCH_DIR"

sync_changes() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') - Running auto-sync..."
  "$WATCH_DIR/auto-sync.sh" 2>&1 | tee -a "$WATCH_DIR/auto-sync.log"
}

# Initial sync
sync_changes

while true; do
  sleep "$SYNC_INTERVAL"

  if ! git diff --quiet || ! git diff --cached --quiet || [ -n "$(git ls-files --others --exclude-standard)" ]; then
    sync_changes
  else
    echo "$(date '+%Y-%m-%d %H:%M:%S') - No changes detected"
  fi
done
