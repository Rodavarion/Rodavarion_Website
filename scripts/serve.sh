#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
port="${1:-8080}"
command -v python3 >/dev/null || { echo 'ПОМИЛКА: python3 не встановлено.' >&2; exit 1; }
printf 'Rodavarion Website Foundation %s\n' "$(tr -d '[:space:]' < VERSION)"
printf 'Відкрийте ТОЧНО цю адресу: http://127.0.0.1:%s/\n' "$port"
printf 'Для зупинки сервера натисніть Ctrl+C.\n'
exec python3 -m http.server "$port" --bind 127.0.0.1
