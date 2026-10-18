#!/usr/bin/env bash
# deploy.sh — Fossil Hunter → https://meow-meow.io/trilobite/
# Usage:  ./deploy.sh      push
#         ./deploy.sh -n   dry run
# Only the game files go up. Leaderboard data lives outside the web root, in
# /home/dh_9vppcg/trilobite-data/ (created by api/score.php), and is never touched here.
# The main site's deploy.sh excludes trilobite/ so the two don't clobber each other.
set -euo pipefail
HOST="mm"
REMOTE="/home/dh_9vppcg/meow-meow.io/trilobite/"
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/"
[[ -f "${SRC}index.html" && -f "${SRC}src/game.js" ]] || { echo "not the fossil-hunter web dir"; exit 1; }
DRY=""
[[ "${1:-}" == "-n" || "${1:-}" == "--dry-run" ]] && DRY="--dry-run"
echo "→ ${HOST}:${REMOTE}${DRY:+   (dry run)}"
rsync -avz --delete --checksum $DRY \
  --include 'index.html' --include '.htaccess' \
  --include 'src/***' --include 'api/***' \
  --exclude '*' \
  "$SRC" "${HOST}:${REMOTE}"
[[ -n "$DRY" ]] && { echo "dry run — nothing changed"; exit 0; }
echo "→ verifying"
for p in "" "src/main.js" "api/score.php?level=beecher"; do
  printf '   %-30s' "/trilobite/$p"
  curl -sS -o /dev/null -w '%{http_code}\n' "https://meow-meow.io/trilobite/$p"
done
