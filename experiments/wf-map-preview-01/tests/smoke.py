#!/usr/bin/env python3
"""WF-MAP-01 smoke test: runs the real preview in headless Chrome (Playwright).

Run from repo root:
  python3 experiments/wf-map-preview-01/tests/smoke.py [--chrome /usr/bin/google-chrome]

Starts its own static server on 127.0.0.1, prints PASS/FAIL per check and writes
screenshots to experiments/wf-map-preview-01/screenshots/. Exit code 1 on any FAIL.
No network access beyond localhost; never touches GitHub or paid APIs.
"""
import argparse, hashlib, http.server, json, pathlib, re, subprocess, sys, threading, functools, io
from playwright.sync_api import sync_playwright

REPO = pathlib.Path(__file__).resolve().parents[3]
PREV = REPO / 'experiments' / 'wf-map-preview-01'
ASSETS = REPO / 'experiments' / 'wf-asset-01'
SHOTS = PREV / 'screenshots'
results = []


def check(name, ok, detail=''):
    results.append((name, bool(ok), detail))
    print(('PASS ' if ok else 'FAIL ') + name + (('  — ' + str(detail)) if detail else ''))


def serve():
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass
    h = functools.partial(Quiet, directory=str(REPO))
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), h)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def static_checks():
    manifest = json.loads((ASSETS / 'manifest.json').read_text())
    for f in ['forest-map.js', 'preview.js', 'standalone/wf-map-preview-01.html']:
        if f.endswith('.js'):
            r = subprocess.run(['node', '--check', str(PREV / f)], capture_output=True, text=True)
            check('syntax ' + f, r.returncode == 0, r.stderr.strip())
    # ASSETS table in forest-map.js must match manifest.json (canvas + pivot)
    js = ("global.window=global; require(%r); const A=window.WF_MAP.ASSETS; console.log(JSON.stringify(A))"
          % str(PREV / 'forest-map.js'))
    table = json.loads(subprocess.run(['node', '-e', js], capture_output=True, text=True, check=True).stdout)
    bad = [a['id'] for a in manifest['assets']
           if table.get(a['id'], {}).get('w') != a['canvas'][0] or table[a['id']]['h'] != a['canvas'][1]
           or table[a['id']]['px'] != a['pivot'][0] or table[a['id']]['py'] != a['pivot'][1]
           or table[a['id']]['file'] != pathlib.Path(a['file']).name]
    check('asset table == manifest.json (12 ids, canvas, pivot, file)', not bad and len(table) == 12, bad)
    # TILES must be a verbatim copy of js/map-data.js whispering_forest
    js2 = ("global.window=global; require(%r); require(%r); console.log(JSON.stringify([window.ELDORIA.MapData.get('whispering_forest').tiles, window.WF_MAP.TILES]))"
           % (str(REPO / 'js' / 'map-data.js'), str(PREV / 'forest-map.js')))
    a, b = json.loads(subprocess.run(['node', '-e', js2], capture_output=True, text=True, check=True).stdout)
    check('map layout == js/map-data.js whispering_forest (16x16)', a == b and len(a) == 16 and all(len(r) == 16 for r in a))
    # Isolation: preview code must not use browser storage or load game modules
    src = '\n'.join((PREV / f).read_text() for f in ['forest-map.js', 'preview.js', 'index.html'])
    code = re.sub(r'/\*.*?\*/|//[^\n]*', '', src, flags=re.S)
    check('no localStorage/sessionStorage/indexedDB in preview code', not re.search(r'localStorage|sessionStorage|indexedDB', code))
    check('does not load save.js/main.js/world.js/data.js', not re.search(r'src="[^"]*(save|main|world|data|battle)\.js', src))


def sample_hero_pixel(pg):
    # Colour of the canvas pixel at the hero's tunic centre (foot point - 20 art px).
    return pg.evaluate('''() => { const s=WFPreview.state(), p=WFPreview.tileToScreen(s.hero.x, s.hero.y);
      const c=document.getElementById('view'), k=s.dpr, x=Math.round(p.x*k), y=Math.round(p.y*k - 20*s.scale);
      const d=c.getContext('2d').getImageData(x,y,1,1).data; return [d[0],d[1],d[2]]; }''')


def run_browser(chrome):
    srv = serve()
    base = 'http://127.0.0.1:%d/experiments/wf-map-preview-01/' % srv.server_address[1]
    manifest = {a['file'].split('/')[-1]: a['sha256'] for a in json.loads((ASSETS / 'manifest.json').read_text())['assets']}
    SHOTS.mkdir(exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=chrome, args=['--no-sandbox'])

        # ---------- iPhone-like portrait (390x844 @3x, touch)
        ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=3, is_mobile=True, has_touch=True,
                            user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1')
        ctx.add_init_script("try{localStorage.setItem('eldoria_sentinel','KEEP-ME')}catch(e){}")
        pg = ctx.new_page()
        errors, requests, pngs = [], [], {}
        pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.on('request', lambda r: requests.append(r.url))

        def on_resp(r):
            if r.url.endswith('.png'):
                pngs[r.url.split('/')[-1]] = (r.status, hashlib.sha256(r.body()).hexdigest())
        pg.on('response', on_resp)
        pg.goto(base + 'index.html')
        pg.wait_for_function('window.WFPreview && window.WFPreview.ready', timeout=15000)
        pg.wait_for_timeout(600)
        res = pg.evaluate('WFPreview.assetResults')
        check('12 PNGs loaded in browser with manifest sizes', len(res) == 12 and all(r['ok'] for r in res),
              [r for r in res if not r['ok']])
        check('served PNG bytes match manifest SHA-256 (HTTP 200)',
              len(pngs) == 12 and all(s == 200 and manifest[f] == h for f, (s, h) in pngs.items()), pngs.keys() ^ manifest.keys())
        st = pg.evaluate('WFPreview.state()')
        check('map built: 94 blocking props on # tiles, trail laid', st['props'] == 94 and st['trail'] > 20, st)
        check('canvas fills screen at device resolution', st['W'] == 1170 and st['H'] == 2532, (st['W'], st['H']))
        pg.screenshot(path=str(SHOTS / '01_iphone_portrait_start.png'))

        # Collision table: every blocked tile collides, every walkable centre is free
        wrong = pg.evaluate('''() => { const M=WF_MAP, bad=[];
          for (let r=0;r<16;r++) for (let c=0;c<16;c++) { const w=M.walkable(c,r), hit=WFPreview.collides(c,r);
            if (w===hit) bad.push([c,r,w,hit]); } return bad; }''')
        check('collision matches map data on all 256 tiles', not wrong, wrong[:5])

        # Joystick (real pointer events on the on-screen stick): push right
        box = pg.locator('#stick').bounding_box()
        cx, cy = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
        before = pg.evaluate('WFPreview.state().hero')
        pg.mouse.move(cx, cy); pg.mouse.down(); pg.mouse.move(cx + 40, cy + 20, steps=4)
        pg.wait_for_timeout(700)
        mid = pg.evaluate('WFPreview.state()')
        pg.mouse.up(); pg.wait_for_timeout(150)
        moved = abs(mid['hero']['x'] - before['x']) + abs(mid['hero']['y'] - before['y'])
        check('on-screen joystick moves hero', moved > 0.8, '%.2f tiles' % moved)

        # Wall test: push hard into the north-west border for 2 s, hero must never enter '#'
        pg.evaluate('WFPreview.teleport(2,2)')
        pg.evaluate('WFPreview.setStick(-1,-1)'); pg.wait_for_timeout(2000)
        st = pg.evaluate('WFPreview.state()')
        pg.evaluate('WFPreview.setStick(0,0)')
        check('walls block movement (2 s push into border)', not pg.evaluate('WFPreview.collides(%f,%f)' % (st['hero']['x'], st['hero']['y'])) and st['stats']['blockedHits'] > 0,
              (round(st['hero']['x'], 2), round(st['hero']['y'], 2), st['stats']['blockedHits']))

        # Random walk 12 s: sample every 50 ms, hero must never overlap a blocked tile
        viol = pg.evaluate('''async () => { let v=[], seed=7; const rnd=()=>{seed=(seed*1103515245+12345)%2147483648; return seed/2147483648;};
          WFPreview.teleport(7,7);
          for (let i=0;i<240;i++){ if(i%12===0) WFPreview.setStick(rnd()*2-1, rnd()*2-1);
            await new Promise(r=>setTimeout(r,50)); const h=WFPreview.state().hero; if (WFPreview.collides(h.x,h.y)) v.push([h.x,h.y]); }
          WFPreview.setStick(0,0); return {v, end: WFPreview.state().hero, hits: WFPreview.state().stats.blockedHits}; }''')
        check('random walk 12 s: no collision violations', not viol['v'], viol)

        # Tap-to-walk with a real touch tap on the map
        pg.evaluate('WFPreview.teleport(7,7)'); pg.wait_for_timeout(300)
        tgt = pg.evaluate('WFPreview.tileToScreen(9,7)')
        pg.touchscreen.tap(tgt['x'], tgt['y']); pg.wait_for_timeout(1500)
        t = pg.evaluate('WFPreview.state().tile')
        check('touch tap-to-walk reaches tapped tile (7,7)->(9,7)', t == {'c': 9, 'r': 7}, t)
        path = pg.evaluate('WFPreview.tapTile(1,1)')
        check('tap on blocked tile refused', pg.evaluate('WFPreview.tapTile(0,0)') is None)
        check('BFS path found across forest to start', path and len(path) > 5, len(path or []))
        pg.wait_for_timeout(200)

        # Camera follow
        # Camera follow (horizontal: portrait view is clamped vertically near the map edge by design)
        pg.evaluate('WFPreview.teleport(7,9)'); pg.wait_for_timeout(200)
        a = pg.evaluate('WFPreview.state().cam')
        pg.evaluate('WFPreview.setStick(-1,0)'); pg.wait_for_timeout(900); pg.evaluate('WFPreview.setStick(0,0)'); pg.wait_for_timeout(700)
        b2 = pg.evaluate('WFPreview.state()')
        hx = (b2['hero']['x'] - b2['hero']['y']) * 32
        check('camera follows hero horizontally', b2['cam']['x'] < a['x'] - 40 and abs(b2['cam']['x'] - hx) < 4, (a, b2['cam'], hx))
        # Camera clamp: at the NW corner the view must not scroll past the map's top edge
        pg.evaluate('WFPreview.teleport(1,1)'); pg.wait_for_timeout(100)
        c = pg.evaluate('WFPreview.state()')
        top = c['cam']['y'] - c['H'] / 2 / c['scale']
        check('camera clamped to map bounds at corner', top >= -150 - 0.5, round(top, 1))

        # Warps: walk onto the NE test warp from the west -> teleported to SE
        pg.evaluate('WFPreview.teleport(13,1)'); pg.wait_for_timeout(100)
        pg.evaluate('WFPreview.setStick(1,0.5)'); pg.wait_for_timeout(450); pg.evaluate('WFPreview.setStick(0,0)')
        pg.wait_for_timeout(150)
        st = pg.evaluate('WFPreview.state()')
        check('test warp NE (14,1) -> SE (14,14)', st['tile'] == {'c': 14, 'r': 14} and 'wf_test_ne' in st['stats']['warps'], (st['tile'], st['stats']['warps']))
        pg.wait_for_timeout(400)
        check('no warp bounce after arrival', pg.evaluate('WFPreview.state().tile') == {'c': 14, 'r': 14})
        pg.evaluate('WFPreview.teleport(2,1)'); pg.wait_for_timeout(100)
        pg.evaluate('WFPreview.setStick(-1,-0.5)'); pg.wait_for_timeout(400); pg.evaluate('WFPreview.setStick(0,0)')
        pg.wait_for_timeout(150)
        toast = pg.locator('#toast').inner_text()
        check('exit warp (1,1) shows Greenvale notice, no game transition', 'Greenvale' in toast and 'forest_to_greenvale' in pg.evaluate('WFPreview.state().stats.warps'), toast)
        pg.wait_for_timeout(2800)

        # Depth sorting: find a tree with walkable tiles north (behind) and south (in front)
        tree = pg.evaluate('''() => { const M=WF_MAP, L=M.build();
          return L.props.find(o => M.ASSETS[o.id].kind==='tree' && M.walkable(o.c,o.r-1) && M.walkable(o.c,o.r+1) && M.walkable(o.c+1,o.r)); }''')
        TUNIC = [63, 111, 209]
        pg.evaluate('WFPreview.setOpt("fade", false)')
        pg.evaluate('WFPreview.teleport(%d,%d)' % (tree['c'], tree['r'] + 1)); pg.wait_for_timeout(250)
        front = sample_hero_pixel(pg)
        pg.evaluate('WFPreview.teleport(%d,%d)' % (tree['c'], tree['r'] - 1)); pg.wait_for_timeout(250)
        behind = sample_hero_pixel(pg)
        pg.screenshot(path=str(SHOTS / '03_hero_behind_tree_no_fade.png'))
        check('depth: hero in front of tree (south) is visible', front == TUNIC, (tree, front))
        check('depth: hero behind tree (north) is hidden by canopy', behind != TUNIC, behind)
        pg.evaluate('WFPreview.setOpt("fade", true)'); pg.wait_for_timeout(250)
        st = pg.evaluate('WFPreview.state()')
        faded = sample_hero_pixel(pg)
        check('tree fade: occluding tree turns translucent when hero is behind it',
              any(f.endswith('@%d,%d' % (tree['c'], tree['r'])) for f in st['stats']['faded']) and faded != behind, (st['stats']['faded'], faded))
        pg.screenshot(path=str(SHOTS / '04_hero_behind_tree_fade.png'))

        # Overlays screenshot (grid + collision)
        pg.evaluate('WFPreview.teleport(7,7)'); pg.evaluate('WFPreview.setOpt("grid", true)'); pg.evaluate('WFPreview.setOpt("collision", true)')
        pg.wait_for_timeout(700); pg.screenshot(path=str(SHOTS / '05_grid_collision_overlay.png'))
        pg.evaluate('WFPreview.setOpt("grid", false)'); pg.evaluate('WFPreview.setOpt("collision", false)')

        # Zoom buttons (real taps)
        s0 = pg.evaluate('WFPreview.state().scale')
        pg.locator('#zoomIn').tap(); s1 = pg.evaluate('WFPreview.state().scale')
        pg.locator('#zoomOut').tap(); pg.locator('#zoomOut').tap(); s2 = pg.evaluate('WFPreview.state().scale')
        check('zoom buttons change integer pixel scale', s1 == s0 + 1 and s2 == s0 - 1, (s0, s1, s2))
        pg.locator('#zoomIn').tap()

        # UI layout: controls inside viewport, no overlaps, touch targets >= 34 px
        lay = pg.evaluate('''() => { const ids=['stick','zoomIn','zoomOut','btnGrid','btnCol','btnFade','btnHero','btnHome'];
          const R=ids.map(i=>{const b=document.getElementById(i).getBoundingClientRect(); return {i, l:b.left,t:b.top,r:b.right,b:b.bottom,w:b.width,h:b.height};});
          const out=R.filter(b=>b.l<0||b.t<0||b.r>innerWidth||b.b>innerHeight).map(b=>b.i);
          const ov=[]; for(let a=0;a<R.length;a++) for(let c=a+1;c<R.length;c++){const x=R[a],y=R[c]; if(x.l<y.r&&y.l<x.r&&x.t<y.b&&y.t<x.b) ov.push(x.i+'/'+y.i);}
          const small=R.filter(b=>b.h<34).map(b=>b.i); return {out, ov, small}; }''')
        check('portrait: controls on-screen, non-overlapping, >=34 px tall', not (lay['out'] or lay['ov'] or lay['small']), lay)
        pg.evaluate('WFPreview.teleport(6,12)'); pg.wait_for_timeout(700)
        pg.screenshot(path=str(SHOTS / '02_iphone_portrait_explore.png'))

        # Storage isolation
        ls = pg.evaluate('JSON.stringify(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)]))')
        check('localStorage untouched (only pre-seeded sentinel present)', json.loads(ls) == [['eldoria_sentinel', 'KEEP-ME']], ls)
        allowed = re.compile(r'/experiments/wf-(map-preview|asset)-01/')
        stray = [u for u in requests if not allowed.search(u) and not u.startswith('data:')]
        check('no requests outside the preview + asset folders', not stray, stray)
        check('no console/page errors (portrait)', not errors, errors)
        ctx.close()

        # ---------- iPhone landscape
        ctx = b.new_context(viewport={'width': 844, 'height': 390}, device_scale_factor=3, is_mobile=True, has_touch=True)
        pg = ctx.new_page(); errors = []
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.goto(base + 'index.html'); pg.wait_for_function('window.WFPreview && window.WFPreview.ready')
        pg.evaluate('WFPreview.teleport(7,5)'); pg.wait_for_timeout(700)
        lay = pg.evaluate('''() => { const ids=['stick','zoomIn','zoomOut','btnGrid','btnCol','btnFade','btnHero','btnHome'];
          const R=ids.map(i=>{const b=document.getElementById(i).getBoundingClientRect(); return {i,l:b.left,t:b.top,r:b.right,b:b.bottom};});
          const out=R.filter(b=>b.l<0||b.t<0||b.r>innerWidth||b.b>innerHeight).map(b=>b.i);
          const ov=[]; for(let a=0;a<R.length;a++) for(let c=a+1;c<R.length;c++){const x=R[a],y=R[c]; if(x.l<y.r&&y.l<x.r&&x.t<y.b&&y.t<x.b) ov.push(x.i+'/'+y.i);} return {out,ov}; }''')
        check('landscape: controls on-screen and non-overlapping', not (lay['out'] or lay['ov']), lay)
        pg.screenshot(path=str(SHOTS / '06_iphone_landscape.png'))
        check('no page errors (landscape)', not errors, errors)
        ctx.close()

        # ---------- Desktop overview (zoomed out) + keyboard
        ctx = b.new_context(viewport={'width': 1280, 'height': 800}, device_scale_factor=1)
        pg = ctx.new_page(); errors = []
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.goto(base + 'index.html'); pg.wait_for_function('window.WFPreview && window.WFPreview.ready')
        pg.evaluate('WFPreview.teleport(7,7)'); pg.wait_for_timeout(200)
        h0 = pg.evaluate('WFPreview.state().hero')
        pg.keyboard.down('KeyD'); pg.wait_for_timeout(500); pg.keyboard.up('KeyD'); pg.wait_for_timeout(100)
        h1 = pg.evaluate('WFPreview.state().hero')
        check('keyboard (WASD) moves hero on desktop', abs(h1['x'] - h0['x']) + abs(h1['y'] - h0['y']) > 0.5, (h0, h1))
        pg.evaluate('WFPreview.setScale(1)'); pg.wait_for_timeout(800)
        pg.screenshot(path=str(SHOTS / '07_desktop_overview_1x.png'))
        check('no page errors (desktop)', not errors, errors)
        ctx.close()

        # ---------- Standalone single-file build via file://
        ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=3, is_mobile=True, has_touch=True)
        pg = ctx.new_page(); errors = []
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.goto((PREV / 'standalone' / 'wf-map-preview-01.html').as_uri())
        pg.wait_for_function('window.WFPreview && window.WFPreview.ready', timeout=15000)
        res = pg.evaluate('WFPreview.assetResults')
        check('standalone file:// build loads all 12 inlined PNGs', len(res) == 12 and all(r['ok'] for r in res) and not errors, errors)
        ctx.close()
        b.close()
    srv.shutdown()


if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('--chrome', default='/usr/bin/google-chrome')
    args = ap.parse_args()
    static_checks()
    run_browser(args.chrome)
    fails = [r for r in results if not r[1]]
    print('\n%d checks, %d passed, %d failed' % (len(results), len(results) - len(fails), len(fails)))
    sys.exit(1 if fails else 0)
