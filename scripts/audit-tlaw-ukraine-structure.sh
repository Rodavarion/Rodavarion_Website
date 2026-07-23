#!/usr/bin/env bash
set -Eeuo pipefail
BASE_URL="${1:-https://rodavarion.org}"
BASE_URL="${BASE_URL%/}"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

curl -fsS --max-time 30 "$BASE_URL/api/tlaw/version" > "$tmp/version.json"
curl -fsS --max-time 30 "$BASE_URL/api/tlaw/acts?limit=10" > "$tmp/acts.json"
curl -fsS --max-time 30 "$BASE_URL/api/tlaw/document/ua-constitution-254k-96-vr" > "$tmp/document.json"
curl -fsS --max-time 30 "$BASE_URL/api/tlaw/search?q=Україна&limit=5" > "$tmp/search.json"

python - "$tmp" <<'PY'
import json, pathlib, sys
p = pathlib.Path(sys.argv[1])
version = json.loads((p/"version.json").read_text())
acts = json.loads((p/"acts.json").read_text())
document = json.loads((p/"document.json").read_text())
search = json.loads((p/"search.json").read_text())
assert version["ok"] is True
assert version["applicationVersion"] == "2.2.0"
assert version["schemaVersion"] == "2.2.0-ukraine-structure-1"
assert version["jurisdiction"] == "Ukraine"
assert version["constitutionImported"] is True
assert acts["ok"] is True and any(x["id"] == "ua-constitution-254k-96-vr" for x in acts["data"])
assert document["ok"] is True
units = document["data"]["units"]
assert sum(1 for x in units if x["unitType"] == "article") >= 150
assert search["ok"] is True and len(search["data"]) > 0
print(json.dumps(version, ensure_ascii=False, indent=2))
print("Structured units:", len(units))
print("Articles:", sum(1 for x in units if x["unitType"] == "article"))
print("Search results:", len(search["data"]))
PY

test "$(curl -sS -o /dev/null -w '%{http_code}' "$BASE_URL/api/tlaw/search?q=x")" = "400"
test "$(curl -sS -o /dev/null -w '%{http_code}' "$BASE_URL/api/tlaw/article/non-existent")" = "404"
echo "PASS: TLAW 2.2 Ukraine Legal Structure"
