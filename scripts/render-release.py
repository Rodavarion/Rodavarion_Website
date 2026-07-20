#!/usr/bin/env python3
from pathlib import Path
import html
import sys

if len(sys.argv) != 5:
    raise SystemExit("usage: render-release.py INDEX VERSION DOWNLOAD_URL ARCHIVE_NAME")
index = Path(sys.argv[1])
version = sys.argv[2].strip()
download_url = sys.argv[3].strip()
archive_name = sys.argv[4].strip()
if not version:
    raise SystemExit("empty version")
text = index.read_text(encoding="utf-8")
required = ("__RELEASE_VERSION__", "__TDRIVER_DOWNLOAD__", "__TDRIVER_ARCHIVE_NAME__")
for token in required:
    if token not in text:
        raise SystemExit(f"required template token missing: {token}")
text = text.replace("__RELEASE_VERSION__", html.escape(version, quote=True))
text = text.replace("__TDRIVER_DOWNLOAD__", html.escape(download_url, quote=True))
text = text.replace("__TDRIVER_ARCHIVE_NAME__", html.escape(archive_name, quote=False))
index.write_text(text, encoding="utf-8")
