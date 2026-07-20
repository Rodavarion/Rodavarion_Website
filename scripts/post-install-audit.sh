#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
./scripts/verify.sh
version="$(tr -d '[:space:]' < VERSION)"
[[ -x scripts/serve.sh ]] || { echo 'ПОМИЛКА: serve.sh не виконуваний' >&2; exit 1; }
echo "INSTALLED VERSION: ${version}"
echo 'POST-INSTALL AUDIT: OK'
