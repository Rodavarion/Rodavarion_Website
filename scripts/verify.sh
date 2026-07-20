#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
version="$(tr -d '[:space:]' < VERSION)"
required=(index.html 404.html VERSION assets/css/main.css assets/js/main.js assets/brand/emblem.svg scripts/serve.sh scripts/post-install-audit.sh scripts/audit-site.py)
for file in "${required[@]}"; do [[ -s "$file" ]] || { echo "ПОМИЛКА: відсутній або порожній $file" >&2; exit 1; }; done
grep -Fq "/assets/css/main.css?v=${version}" index.html || { echo 'ПОМИЛКА: CSS не підключено з поточною версією.' >&2; exit 1; }
grep -Fq "/assets/js/main.js?v=${version}" index.html || { echo 'ПОМИЛКА: JS не підключено з поточною версією.' >&2; exit 1; }
! grep -Eq '__[A-Z0-9_]+__' index.html || { echo 'ПОМИЛКА: залишились шаблонні маркери.' >&2; exit 1; }
./scripts/audit-site.py .
echo "Website Foundation ${version}: перевірку пройдено."
