"""Talks to the native helper the way Chrome does and checks what it does. Standard library only.

Windows runs native/host.bat (PowerShell); macOS and Linux run native/host.sh (bash).
Everything happens in a temporary folder, never in the real temp folder. The clipboard
part is reported but not required: CI runners may have no clipboard.
"""
import base64
import json
import os
import struct
import subprocess
import sys
import tempfile
import time
from pathlib import Path

EXT = Path(__file__).resolve().parents[2] / 'copiar-elemento'
WINDOWS = sys.platform == 'win32'
CMD = ['cmd', '/c', str(EXT / 'native' / 'host.bat')] if WINDOWS else ['bash', str(EXT / 'native' / 'host.sh')]
TEXT = '**Element:** `div#c2`\n\n```html\n<button class="btn">Añadir "ñ" \\ € 日本</button>\n```\n'
failures = []


def check(ok, msg):
    print(('PASS ' if ok else 'FAIL ') + msg)
    if not ok:
        failures.append(msg)


def call(env, msg):
    body = json.dumps(msg, separators=(',', ':')).encode('utf-8')
    p = subprocess.run(CMD, input=struct.pack('<I', len(body)) + body, capture_output=True, env=env, timeout=60)
    size = struct.unpack('<I', p.stdout[:4])[0] if len(p.stdout) >= 4 else 0
    reply = json.loads(p.stdout[4:4 + size].decode('utf-8')) if size else {}
    return reply, len(p.stdout) - 4 - size, p.stderr.decode(errors='replace').strip()


def b64(s):
    return base64.b64encode(s.encode('utf-8')).decode()


with tempfile.TemporaryDirectory() as tmp:
    env = dict(os.environ, TEMP=tmp, TMP=tmp, TMPDIR=tmp)
    folder = Path(tmp) / ('copiar-elemento' if WINDOWS else '.cursorclip')

    reply, extra, err = call(env, {'type': 'ping'})
    check(reply.get('ok') is True, f'ping answers ok ({reply})')
    check(extra == 0, 'nothing else is written to stdout')
    check(err == '', f'nothing on stderr ({err!r})')

    names = []
    for _ in range(3):
        reply, extra, _ = call(env, {'type': 'save', 'name': 'div#c2.md', 'b64': b64(TEXT)})
        names.append(Path(reply.get('path', '')).name)
    check(names == ['div#c2.md', 'div#c2_2.md', 'div#c2_3.md'], f'repeated names are numbered ({names})')
    print(f'INFO clipboard set as a file: {reply.get("clipboard")}')

    saved = (folder / 'div#c2_2.md').read_bytes().decode('utf-8') if (folder / 'div#c2_2.md').exists() else None
    check(saved == TEXT, 'content round-trips exactly (UTF-8, quotes, backslash)')

    reply, _, _ = call(env, {'type': 'nope'})
    check(reply.get('ok') is False, 'unknown messages are rejected')

    for i in range(55):
        call(env, {'type': 'save', 'name': f'el{i:02d}.md', 'b64': b64('x')})
        if i == 0 and not WINDOWS:
            time.sleep(1.1)  # ls -t sorts by mtime; make the first batch clearly older
    files = sorted(p.name for p in folder.glob('*.md'))
    check(len(files) == 50, f'keeps the last 50 files ({len(files)})')
    check(not any(f.startswith('div') for f in files), 'the oldest files are removed first')

if failures:
    sys.exit(1)
print('OK: the helper behaves as expected')
