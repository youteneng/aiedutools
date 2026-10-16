#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG_FILE="$ROOT_DIR/scripts/crawler-config.json"
RAW_FILE="$ROOT_DIR/data/crawler-snapshots/raw-tools.latest.json"
TOOLS_FILE="$ROOT_DIR/data/tools-data.json"
URL_CHECK_FLAG=()

if [[ "${URL_CHECK:-0}" == "1" ]]; then
  URL_CHECK_FLAG+=(--url-check)
  URL_CHECK_FLAG+=(--url-check-limit "${URL_CHECK_LIMIT:-30}")
  URL_CHECK_FLAG+=(--url-check-timeout-ms "${URL_CHECK_TIMEOUT_MS:-6000}")
fi

echo "[1/3] crawling sources..."
node "$ROOT_DIR/scripts/run-crawler.mjs" \
  --config "$CONFIG_FILE" \
  --output "$RAW_FILE"

echo "[2/3] normalizing + scoring + publishing..."
if [[ "${#URL_CHECK_FLAG[@]}" -gt 0 ]]; then
  node "$ROOT_DIR/scripts/update-tools-data.mjs" \
    --input "$RAW_FILE" \
    --output "$TOOLS_FILE" \
    "${URL_CHECK_FLAG[@]}"
else
  node "$ROOT_DIR/scripts/update-tools-data.mjs" \
    --input "$RAW_FILE" \
    --output "$TOOLS_FILE"
fi

echo "[3/3] summary"
node -e "
const fs=require('fs');
const raw=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));
const data=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
console.log('raw capturedAt:', raw.capturedAt || 'N/A');
console.log('raw mode:', raw.mode || 'N/A');
console.log('raw sourceStats:', raw.sourceStats || []);
console.log('keywordFallback:', raw.keywordFallback || {});
console.log('publish stats:', data.stats || {});
console.log('published tools (top 10):', (data.tools||[]).slice(0,10).map(t=>t.name));
" "$RAW_FILE" "$TOOLS_FILE"

echo "done. preview with: cd $ROOT_DIR && python3 -m http.server 5500"
echo "open: http://localhost:5500/tools.html"
