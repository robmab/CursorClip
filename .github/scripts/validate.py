"""Checks that CursorClip is well-formed. Standard library only.

- manifest.json: valid JSON, version format, and every file it references exists
- native/host.json: valid, and its allowed origin is the ID derived from the manifest key
- CURSORS in shortcuts.js: every cursor has its PNG
- SVG in docs/: well-formed XML
- README.md: every local link and image exists
- .sh files: LF line endings and a bash shebang

Exit code 1 if anything fails; each problem is printed as a GitHub annotation.
"""
import base64
import hashlib
import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
EXT = ROOT / 'copiar-elemento'
errors = []


def error(path, msg):
    rel = path.relative_to(ROOT).as_posix() if isinstance(path, Path) else path
    errors.append(f'::error file={rel}::{msg}')


def load_json(path):
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except Exception as e:  # noqa: BLE001
        error(path, f'invalid JSON: {e}')
        return None


def extension_id(key_b64):
    digest = hashlib.sha256(base64.b64decode(key_b64)).hexdigest()[:32]
    return ''.join(chr(ord('a') + int(c, 16)) for c in digest)


def check_manifest():
    path = EXT / 'manifest.json'
    m = load_json(path)
    if m is None:
        return None
    if m.get('manifest_version') != 3:
        error(path, 'manifest_version must be 3')
    if not re.fullmatch(r'\d+(\.\d+){0,3}', str(m.get('version', ''))):
        error(path, f'invalid version "{m.get("version")}"')
    refs = list(m.get('icons', {}).values())
    refs += list(m.get('action', {}).get('default_icon', {}).values())
    refs.append(m.get('background', {}).get('service_worker'))
    refs.append(m.get('options_ui', {}).get('page'))
    for cs in m.get('content_scripts', []):
        refs += cs.get('js', []) + cs.get('css', [])
    for ref in filter(None, refs):
        if not (EXT / ref).is_file():
            error(path, f'references a missing file: {ref}')
    for war in m.get('web_accessible_resources', []):
        for pattern in war.get('resources', []):
            if not list(EXT.glob(pattern)):
                error(path, f'web_accessible_resources matches no file: {pattern}')
    return m


def check_host(manifest):
    path = EXT / 'native' / 'host.json'
    host = load_json(path)
    if host is None or manifest is None:
        return
    if 'key' not in manifest:
        error(EXT / 'manifest.json', 'missing "key": the helper needs a fixed extension ID')
        return
    expected = f'chrome-extension://{extension_id(manifest["key"])}/'
    if host.get('allowed_origins') != [expected]:
        error(path, f'allowed_origins should be ["{expected}"]')
    if not (path.parent / host.get('path', '')).is_file():
        error(path, f'path points to a missing file: {host.get("path")}')


def check_cursors():
    path = EXT / 'shortcuts.js'
    src = path.read_text(encoding='utf-8')
    block = re.search(r'const CURSORS = \[(.*?)\];', src, re.S)
    if not block:
        error(path, 'CURSORS list not found')
        return
    ids = re.findall(r"id: '([^']+)'", block.group(1))
    for cid in ids:
        if cid != 'system' and not (EXT / 'cursors' / f'{cid}.png').is_file():
            error(path, f'cursor {cid} has no cursors/{cid}.png')
    colors = re.findall(r"color: '(#[0-9a-fA-F]{6})'", block.group(1))
    if len(colors) != len(set(c.lower() for c in colors)):
        error(path, 'two cursors share the same highlight color')


def check_svgs():
    for svg in sorted((ROOT / 'docs').glob('*.svg')):
        try:
            ET.parse(svg)
        except ET.ParseError as e:
            error(svg, f'malformed SVG: {e}')


def check_readme_links():
    path = ROOT / 'README.md'
    text = path.read_text(encoding='utf-8')
    targets = re.findall(r'\]\(([^)\s]+)\)', text) + re.findall(r'(?:src|href)="([^"]+)"', text)
    for t in targets:
        if re.match(r'^[a-z]+:', t) or t.startswith('#'):
            continue
        if not (ROOT / t.split('#')[0]).exists():
            error(path, f'broken link: {t}')


def check_shell_scripts():
    for sh in sorted(EXT.rglob('*.sh')):
        data = sh.read_bytes()
        if b'\r' in data:
            error(sh, 'has CRLF line endings; bash needs LF')
        if not data.startswith(b'#!/usr/bin/env bash'):
            error(sh, 'must start with #!/usr/bin/env bash')


manifest = check_manifest()
check_host(manifest)
check_cursors()
check_svgs()
check_readme_links()
check_shell_scripts()

if errors:
    print('\n'.join(errors))
    sys.exit(1)
print(f'OK: CursorClip {manifest["version"] if manifest else "?"} is well-formed')
