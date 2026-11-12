#!/usr/bin/env python3
"""Build a single self-contained HTML file of the WF-MAP-01 preview.

Inlines preview.css, forest-map.js, preview.js and the 12 WF-ASSET-01 PNGs
(as data: URIs, byte-for-byte identical) so the preview can be opened from one
file or hosted anywhere without the ../wf-asset-01 folder.

Usage: python3 tools/build_standalone.py   (run from experiments/wf-map-preview-01)
Output: standalone/wf-map-preview-01.html
"""
import base64, hashlib, json, pathlib, re

HERE = pathlib.Path(__file__).resolve().parent.parent
ASSETS = HERE.parent / 'wf-asset-01'
OUT = HERE / 'standalone' / 'wf-map-preview-01.html'


def main():
    manifest = json.loads((ASSETS / 'manifest.json').read_text())
    urls = {}
    for a in manifest['assets']:
        data = (ASSETS / a['file']).read_bytes()
        if hashlib.sha256(data).hexdigest() != a['sha256']:
            raise SystemExit('SHA mismatch: ' + a['file'])
        urls[a['id']] = 'data:image/png;base64,' + base64.b64encode(data).decode()

    html = (HERE / 'index.html').read_text()
    css = (HERE / 'preview.css').read_text()
    fm = (HERE / 'forest-map.js').read_text()
    pv = (HERE / 'preview.js').read_text()
    html = html.replace('<link rel="stylesheet" href="preview.css">', '<style>\n' + css + '</style>')
    inline = ('<script>window.WF_ASSET_URLS = ' + json.dumps(urls) + ';</script>\n'
              '<script>\n' + fm + '</script>\n<script>\n' + pv + '</script>')
    html, n = re.subn(r'<script src="forest-map.js"></script>\s*<script src="preview.js"></script>', lambda m: inline, html)
    if n != 1:
        raise SystemExit('script tags not found')
    html = html.replace('<title>', '<!-- built by tools/build_standalone.py; do not edit -->\n  <title>', 1)
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(html)
    print(OUT, OUT.stat().st_size, 'bytes,', len(urls), 'PNGs inlined')


if __name__ == '__main__':
    main()
