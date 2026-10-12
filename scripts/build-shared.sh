#!/usr/bin/env bash
# Builds everything for Hostinger shared hosting into dist-shared/closa-public_html.zip.
# Upload that zip to public_html in hPanel > File Manager and extract it there.
# Run from the repo root:  ./scripts/build-shared.sh
set -euo pipefail
cd "$(dirname "$0")/.."

( cd frontend && npm ci --no-audit --no-fund && npm run build )

OUT=dist-shared/public_html
rm -rf dist-shared && mkdir -p "$OUT/api"
cp -a frontend/dist/. "$OUT/"                       # site + the root .htaccess
cp api/index.php api/.htaccess api/config.example.php "$OUT/api/"
cp -a api/lib api/data "$OUT/api/"
mkdir -p "$OUT/api/storage" && cp api/storage/.htaccess "$OUT/api/storage/"

( cd "$OUT" && zip -qr ../closa-public_html.zip . -x '*.DS_Store' )
echo "Built dist-shared/closa-public_html.zip ($(du -h dist-shared/closa-public_html.zip | cut -f1))"
