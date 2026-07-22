#!/usr/bin/env bash
set -Eeuo pipefail

BASE_URL="${1:-https://rodavarion.org}"
BASE_URL="${BASE_URL%/}"

VERSION_FILE="$(mktemp)"
ACTS_FILE="$(mktemp)"
trap 'rm -f "$VERSION_FILE" "$ACTS_FILE"' EXIT

curl -fsS --max-time 30 "$BASE_URL/api/tlaw/version" > "$VERSION_FILE"
curl -fsS --max-time 30 "$BASE_URL/api/tlaw/acts?limit=5" > "$ACTS_FILE"

python - "$VERSION_FILE" "$ACTS_FILE" <<'PY'
import json, pathlib, sys
version = json.loads(pathlib.Path(sys.argv[1]).read_text())
acts = json.loads(pathlib.Path(sys.argv[2]).read_text())
assert version["ok"] is True
assert version["applicationVersion"] == "2.1.0"
assert version["schemaVersion"] == "2.1.0-legal-core-1"
assert acts["ok"] is True
assert isinstance(acts["data"], list)
print(json.dumps(version, ensure_ascii=False, indent=2))
print("Acts returned:", len(acts["data"]))
PY

test "$(curl -sS -I --max-time 30 -o /dev/null -w '%{http_code}' "$BASE_URL/api/tlaw/version")" = "200"
test "$(curl -sS --max-time 30 -o /dev/null -w '%{http_code}' "$BASE_URL/api/tlaw/acts/non-existent-act")" = "404"

echo "PASS: TLAW 2.1 Legal Core"
