#!/usr/bin/env python3
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit
import re
import sys

root = Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()
index = root / "index.html"
errors = []
if not index.is_file():
    raise SystemExit("ПОМИЛКА: index.html відсутній")
text = index.read_text(encoding="utf-8")
version = (root / "VERSION").read_text(encoding="utf-8").strip()
for token in re.findall(r"__[A-Z0-9_]+__", text):
    errors.append(f"непідставлений шаблон: {token}")

class Parser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.refs=[]; self.ids=set()
    def handle_starttag(self, tag, attrs):
        d=dict(attrs)
        if d.get('id'): self.ids.add(d['id'])
        for key in ('href','src'):
            if d.get(key): self.refs.append((tag,key,d[key]))

p=Parser(); p.feed(text)
for tag,key,ref in p.refs:
    if ref.startswith(('mailto:','http://','https://','data:')): continue
    if ref.startswith('#'):
        if ref != '#' and ref[1:] not in p.ids:
            errors.append(f"битий якір {ref}")
        continue
    path=urlsplit(ref).path
    if not path: continue
    local=root / path.lstrip('/')
    if not local.exists():
        errors.append(f"відсутній ресурс {ref}")
if f"/assets/css/main.css?v={version}" not in text:
    errors.append("CSS не має поточної версії")
if f"/assets/js/main.js?v={version}" not in text:
    errors.append("JS не має поточної версії")
if re.search(r'href=["\'][^"\']*terp[^"\']*\.(zip|7z|tar(?:\.(?:gz|xz|zst))?)["\']', text, re.I):
    errors.append("знайдено публічне завантаження TERP")
if errors:
    for e in errors: print(f"ПОМИЛКА: {e}", file=sys.stderr)
    raise SystemExit(1)
print(f"SITE AUDIT {version}: OK")
