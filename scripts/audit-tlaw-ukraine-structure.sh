#!/usr/bin/env bash
set -Eeuo pipefail

BASE_URL="${1:-}"
test -n "$BASE_URL" || {
  echo "Usage: $0 https://deployment.pages.dev"
  exit 2
}
BASE_URL="${BASE_URL%/}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

request() {
  local name="$1"
  local url="$2"
  shift 2
  local body="$TMP/${name}.body"
  local headers="$TMP/${name}.headers"
  local code

  code="$(curl -sS -L \
    --connect-timeout 15 \
    --max-time 45 \
    -D "$headers" \
    -o "$body" \
    -w '%{http_code}' \
    "$@" "$url" || true)"

  echo "--- $name ---"
  echo "URL:  $url"
  echo "HTTP: $code"
  sed -n '1,20p' "$headers" || true
  echo "BODY:"
  head -c 1200 "$body" || true
  echo
  echo

  case "$code" in
    2??) ;;
    *) return 1 ;;
  esac

  test -s "$body"
}

json_check() {
  local file="$1"
  local mode="$2"
  python - "$file" "$mode" <<'PY'
import json, sys
from pathlib import Path

path, mode = sys.argv[1:]
raw = Path(path).read_text(encoding="utf-8")
data = json.loads(raw)

blob = json.dumps(data, ensure_ascii=False)
if mode == "version":
    if "2.2" not in blob:
        raise SystemExit("Version response does not contain 2.2")
elif mode == "document":
    if "Конституц" not in blob:
        raise SystemExit("Document response does not contain Constitution title")
    if "166" not in blob and "article" not in blob.lower():
        raise SystemExit("Document response lacks article structure")
elif mode == "search":
    if "Конституц" not in blob and "Україн" not in blob:
        raise SystemExit("Search response lacks expected legal content")
PY
}

echo "=== TLAW 2.2 HTTP AUDIT ==="
echo "Base: $BASE_URL"

# UI is informative, but API is the release gate.
UI_OK=""
if request "ui" "$BASE_URL/tlaw/"; then
  UI_OK=yes
else
  echo "WARNING: /tlaw/ is not ready; continuing with API checks."
fi

request "version" "$BASE_URL/api/tlaw/version"
json_check "$TMP/version.body" version

request "document" \
  "$BASE_URL/api/tlaw/document/ua-constitution-254k-96-vr"
json_check "$TMP/document.body" document

request "search" "$BASE_URL/api/tlaw/search" \
  --get --data-urlencode "q=Конституція"
json_check "$TMP/search.body" search

echo "PASS: TLAW 2.2 API audit"
if test "$UI_OK" = yes; then
  echo "PASS: TLAW UI"
else
  echo "WARNING: API is healthy, but /tlaw/ returned a non-2xx response."
fi
