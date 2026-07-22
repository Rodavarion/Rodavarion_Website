#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-https://rodavarion.org}"
BASE_URL="${BASE_URL%/}"

TMP_PAGE="$(mktemp)"
TMP_API="$(mktemp)"

cleanup() {
    rm -f "$TMP_PAGE" "$TMP_API"
}
trap cleanup EXIT

echo "Audit target: $BASE_URL"

PAGE_CODE="$(
    curl -LsS \
        --max-time 30 \
        -o "$TMP_PAGE" \
        -w '%{http_code}' \
        "$BASE_URL/tlaw/"
)"

test "$PAGE_CODE" = "200" || {
    echo "FAIL: /tlaw/ returned HTTP $PAGE_CODE"
    exit 1
}

grep -q '<title>Rodavarion TLAW 2.0</title>' "$TMP_PAGE" || {
    echo "FAIL: unexpected TLAW page title"
    exit 1
}

API_CODE="$(
    curl -LsS \
        --max-time 30 \
        -o "$TMP_API" \
        -w '%{http_code}' \
        "$BASE_URL/api/tlaw/health"
)"

test "$API_CODE" = "200" || {
    echo "FAIL: health API returned HTTP $API_CODE"
    cat "$TMP_API"
    exit 1
}

python - "$TMP_API" <<'PY'
import json
import pathlib
import sys

data = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8"))

assert data.get("ok") is True, data
assert data.get("service") == "Rodavarion TLAW", data
assert data.get("database") == "Cloudflare D1", data
assert data.get("schemaVersion") == "2.0.0-foundation-1", data

print(json.dumps(data, ensure_ascii=False, indent=2))
PY

HEAD_CODE="$(
    curl -LsS \
        -I \
        --max-time 30 \
        -o /dev/null \
        -w '%{http_code}' \
        "$BASE_URL/api/tlaw/health"
)"

test "$HEAD_CODE" = "200" || {
    echo "FAIL: health HEAD returned HTTP $HEAD_CODE"
    exit 1
}

ASSET_CODE="$(
    curl -LsS \
        --max-time 30 \
        -o /dev/null \
        -w '%{http_code}' \
        "$BASE_URL/tlaw/assets/rodavarion-logo.webp"
)"

test "$ASSET_CODE" = "200" || {
    echo "FAIL: TLAW logo returned HTTP $ASSET_CODE"
    exit 1
}

ROOT_HTML="$(curl -LsS --max-time 30 "$BASE_URL/")"

printf '%s' "$ROOT_HTML" |
    grep -q 'href="/tlaw/"' || {
        echo "FAIL: main website does not contain the TLAW entry"
        exit 1
    }

echo
echo "PASS: TLAW Cloudflare production audit completed"
