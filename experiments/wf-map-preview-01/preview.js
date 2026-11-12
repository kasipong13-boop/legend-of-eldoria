/* Legend of Eldoria - WF-MAP-01 Whispering Forest Map Preview
   preview.js: standalone isometric renderer for exploration testing.

   - Uses the real WF-ASSET-01 PNGs (pixel-exact, nearest-neighbour, integer scale).
   - Hero shapes are copied from js/world.js drawHero() (main c797440) and rasterised
     at art resolution so they share the same pixel density as the PNG assets.
   - Separate from the main game: does not load save.js / main.js / world.js and
     never reads or writes localStorage. */
(function (root) {
  'use strict';
  var M = root.WF_MAP;
  var TW = M.TW, TH = M.TH;
  var HERO_R = 0.22;            // collision half-size, in tile units
  var HERO_SPEED = 132;         // art px per second, screen-uniform
  var DPR = Math.max(1, Math.min(3, root.devicePixelRatio || 1));

  var canvas, ctx, W = 0, H = 0, scale = 2, minScale = 1, maxScale = 6;
  var images = {}, waterTile = null, groundCanvas = null, GROUND_OX = 0, GROUND_OY = 0;
  var props = [], layout = null;
  var hero = { x: M.START.c, y: M.START.r, moving: false };
  var cam = { x: 0, y: 0 };
  var input = { kx: 0, ky: 0, jx: 0, jy: 0, path: null };
  var opts = { grid: false, collision: false, fade: true, heroScale: 1 };
  var warpArmed = {}, time = 0, last = 0, fps = 0, fpsAcc = 0, fpsN = 0, running = false;
  var heroCanvas = null, toastTimer = 0, fadeT = 0;
  var stats = { blockedHits: 0, warps: [], frames: 0 };

  function iso(x, y) { return { x: (x - y) * TW / 2, y: (x + y) * TH / 2 }; }
  function screenToGrid(dx, dy) { return { c: (dx / 32 + dy / 16) / 2, r: (dy / 16 - dx / 32) / 2 }; }

  // ---------------------------------------------------------------- loading
  function assetUrl(id) {
    var a = M.ASSETS[id];
    if (root.WF_ASSET_URLS && root.WF_ASSET_URLS[id]) return root.WF_ASSET_URLS[id];
    return M.ASSET_BASE + a.file;
  }
  function loadAssets() {
    var ids = Object.keys(M.ASSETS);
    return Promise.all(ids.map(function (id) {
      return new Promise(function (resolve) {
        var img = new Image();
        img.onload = function () {
          var a = M.ASSETS[id];
          var ok = img.naturalWidth === a.w && img.naturalHeight === a.h;
          images[id] = img;
          resolve({ id: id, ok: ok, w: img.naturalWidth, h: img.naturalHeight, reason: ok ? null : 'SIZE_MISMATCH' });
        };
        img.onerror = function () { resolve({ id: id, ok: false, reason: 'LOAD_ERROR' }); };
        img.src = assetUrl(id);
      });
    }));
  }

  // Alpha masks for pixel-accurate tree occlusion. Falls back to the manifest
  // canvas box if the browser refuses getImageData (e.g. file:// tainting).
  var masks = {};
  function buildMasks() {
    Object.keys(M.ASSETS).forEach(function (id) {
      var a = M.ASSETS[id]; if (a.kind !== 'tree') return;
      try {
        var c = document.createElement('canvas'); c.width = a.w; c.height = a.h;
        var g = c.getContext('2d'); g.drawImage(images[id], 0, 0);
        var d = g.getImageData(0, 0, a.w, a.h).data, m = new Uint8Array(a.w * a.h);
        for (var i = 0; i < m.length; i++) m[i] = d[i * 4 + 3] > 0 ? 1 : 0;
        masks[id] = m;
      } catch (e) { masks[id] = null; }
    });
  }
  // Does the opaque part of prop (drawn at x,y) cover any of rect r? Samples every 2 px.
  function covers(id, x, y, r) {
    var a = M.ASSETS[id], m = masks[id];
    var x0 = Math.max(x, r.x), x1 = Math.min(x + a.w, r.x + r.w), y0 = Math.max(y, r.y), y1 = Math.min(y + a.h - 12, r.y + r.h);
    if (x0 >= x1 || y0 >= y1) return false;
    if (!m) return true;
    for (var yy = y0; yy < y1; yy += 2) for (var xx = x0; xx < x1; xx += 2) {
      if (m[(yy - y) * a.w + (xx - x)]) return true;
    }
    return false;
  }

  // Placeholder water tile: uses the exact alpha mask of grass_tile_01 so seams match.
  // (WF-ASSET-01 has no water asset; marked as placeholder in the report.)
  function makeWaterTile() {
    var c = document.createElement('canvas'); c.width = 64; c.height = 32;
    var g = c.getContext('2d'); g.drawImage(images.grass_tile_01, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = '#2f5e7a'; g.fillRect(0, 0, 64, 32);
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = '#3d7896'; g.fillRect(0, 10, 64, 12);
    g.fillStyle = '#7fb7cc';
    [[20, 12], [21, 12], [22, 12], [38, 18], [39, 18], [40, 18], [30, 15], [31, 15]].forEach(function (p) { g.fillRect(p[0], p[1], 1, 1); });
    return c;
  }

  function buildGround() {
    // Bounds of the 16x16 diamond at art resolution.
    var minX = -(M.ROWS - 1) * TW / 2 - TW / 2, maxX = (M.COLS - 1) * TW / 2 + TW / 2;
    var minY = -TH / 2, maxY = (M.COLS - 1 + M.ROWS - 1) * TH / 2 + TH / 2;
    GROUND_OX = minX; GROUND_OY = minY;
    groundCanvas = document.createElement('canvas');
    groundCanvas.width = maxX - minX; groundCanvas.height = maxY - minY;
    var g = groundCanvas.getContext('2d'); g.imageSmoothingEnabled = false;
    layout.ground.forEach(function (t) {
      var p = iso(t.c, t.r);
      var img = t.id === 'water' ? waterTile : images[t.id];
      g.drawImage(img, p.x - 32 - minX, p.y - 16 - minY);
    });
  }

  // ------------------------------------------------------------ hero sprite
  // Shapes copied from js/world.js drawHero(); drawn into a small offscreen canvas
  // at art resolution (k = hero scale) so it matches the PNG pixel density.
  function renderHero(bob) {
    var k = opts.heroScale, w = Math.ceil(40 * k), h = Math.ceil(56 * k);
    if (!heroCanvas) heroCanvas = document.createElement('canvas');
    if (heroCanvas.width !== w || heroCanvas.height !== h) { heroCanvas.width = w; heroCanvas.height = h; }
    var c = heroCanvas.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, w, h);
    c.setTransform(k, 0, 0, k, 20 * k, 46 * k); // origin = hero foot point (p.x, p.y)
    var px = 0, py = 0;
    c.beginPath(); c.ellipse(px, py + 2, 11, 5, 0, 0, Math.PI * 2); c.fillStyle = 'rgba(0,0,0,0.25)'; c.fill();
    c.fillStyle = '#2f3e63'; c.fillRect(px - 6, py - 8 - bob * 0.4, 5, 9);
    c.fillRect(px + 1, py - 8 + bob * 0.4, 5, 9);
    c.fillStyle = '#3f6fd1'; c.beginPath();
    c.moveTo(px - 8, py - 8 - bob); c.lineTo(px + 8, py - 8 - bob); c.lineTo(px + 6, py - 26 - bob); c.lineTo(px - 6, py - 26 - bob);
    c.closePath(); c.fill();
    c.fillStyle = '#e6b04b'; c.fillRect(px - 8, py - 15 - bob, 16, 3);
    c.fillStyle = '#f1c9a0'; c.beginPath(); c.arc(px, py - 32 - bob, 8, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#5a3a1e'; c.beginPath(); c.arc(px, py - 35 - bob, 8, Math.PI, 0); c.fill();
    c.fillStyle = '#2a1d10'; c.fillRect(px - 3.5, py - 32 - bob, 2, 3); c.fillRect(px + 1.5, py - 32 - bob, 2, 3);
    c.strokeStyle = '#d7dde6'; c.lineWidth = 3; c.beginPath();
    c.moveTo(px + 9, py - 14 - bob); c.lineTo(px + 16, py - 30 - bob); c.stroke();
    return { canvas: heroCanvas, ox: Math.round(20 * k), oy: Math.round(46 * k) };
  }

  // -------------------------------------------------------------- collision
  function blockedAt(x, y) { return !M.walkable(Math.round(x), Math.round(y)); }
  function collides(x, y) {
    return blockedAt(x - HERO_R, y - HERO_R) || blockedAt(x + HERO_R, y - HERO_R) ||
           blockedAt(x - HERO_R, y + HERO_R) || blockedAt(x + HERO_R, y + HERO_R);
  }
  function moveBy(dc, dr) {
    var steps = Math.max(1, Math.ceil(Math.max(Math.abs(dc), Math.abs(dr)) / 0.1)), hit = false;
    for (var i = 0; i < steps; i++) {
      var nx = hero.x + dc / steps, ny = hero.y + dr / steps;
      if (!collides(nx, hero.y)) hero.x = nx; else hit = true;
      if (!collides(hero.x, ny)) hero.y = ny; else hit = true;
    }
    if (hit) stats.blockedHits++;
    return hit;
  }

  // 8-direction BFS for tap-to-walk; no diagonal corner cutting (same rule as world.js canMove).
  function canStep(c, r, nc, nr) {
    if (!M.walkable(nc, nr)) return false;
    var dc = nc - c, dr = nr - r;
    if (dc && dr) return M.walkable(c + dc, r) && M.walkable(c, r + dr);
    return true;
  }
  function bfs(sc, sr, tc, tr) {
    var key = function (c, r) { return r * M.COLS + c; }, prev = {}, seen = {}, q = [{ c: sc, r: sr }];
    seen[key(sc, sr)] = true;
    var D = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    while (q.length) {
      var p = q.shift();
      if (p.c === tc && p.r === tr) {
        var out = [], cur = p;
        while (cur && !(cur.c === sc && cur.r === sr)) { out.push(cur); cur = prev[key(cur.c, cur.r)]; }
        return out.reverse();
      }
      for (var i = 0; i < 8; i++) {
        var nc = p.c + D[i][0], nr = p.r + D[i][1], k = key(nc, nr);
        if (!seen[k] && canStep(p.c, p.r, nc, nr)) { seen[k] = true; prev[k] = p; q.push({ c: nc, r: nr }); }
      }
    }
    return null;
  }

  // ------------------------------------------------------------------ warps
  function heroTile() { return { c: Math.round(hero.x), r: Math.round(hero.y) }; }
  function warpAt(c, r) { return M.WARPS.filter(function (w) { return w.at.c === c && w.at.r === r; })[0]; }
  function checkWarps() {
    var t = heroTile(), w = warpAt(t.c, t.r);
    M.WARPS.forEach(function (x) { if (!(x.at.c === t.c && x.at.r === t.r)) warpArmed[x.id] = true; });
    if (!w || !warpArmed[w.id]) return;
    warpArmed[w.id] = false;
    stats.warps.push(w.id);
    if (w.kind === 'test') {
      var dest = M.WARPS.filter(function (x) { return x.id === w.target; })[0];
      hero.x = dest.at.c; hero.y = dest.at.r; warpArmed[dest.id] = false; input.path = null;
      snapCamera(); fadeT = 0.35;
      toast('Warp ทดลอง → ' + dest.label.replace('Warp → ', 'มุม ') + ' (' + dest.at.c + ',' + dest.at.r + ')');
    } else {
      input.path = null;
      toast('ทางออก → Greenvale\n(Preview นี้ไม่เชื่อมกับเกมหลัก)');
    }
  }

  // ----------------------------------------------------------------- update
  function update(dt) {
    var vx = input.kx + input.jx, vy = input.ky + input.jy, len = Math.hypot(vx, vy);
    var moving = false;
    if (len > 0.08) {
      input.path = null;
      if (len > 1) { vx /= len; vy /= len; }
      var g = screenToGrid(vx * HERO_SPEED * dt, vy * HERO_SPEED * dt);
      moveBy(g.c, g.r); moving = true;
    } else if (input.path && input.path.length) {
      var wp = input.path[0], dx = wp.c - hero.x, dy = wp.r - hero.y, d = Math.hypot(dx, dy);
      var stepGrid = 4.1 * dt; // tiles per second along the path
      if (d <= stepGrid) { moveBy(dx, dy); input.path.shift(); }
      else { moveBy(dx / d * stepGrid, dy / d * stepGrid); }
      moving = true;
    }
    hero.moving = moving;
    checkWarps();
    var t = camTarget(), f = Math.min(1, dt * 7);
    cam.x += (t.x - cam.x) * f; cam.y += (t.y - cam.y) * f;
    if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) document.getElementById('toast').classList.remove('show'); }
    if (fadeT > 0) fadeT -= dt;
  }
  // Camera follows the hero but is clamped to the map (art-px bounds incl. tree tops),
  // and centred on an axis when the whole map fits on screen.
  var BOUNDS = { x0: -528, x1: 528, y0: -150, y1: 520 };
  function clampAxis(v, half, lo, hi) {
    if (half * 2 >= hi - lo) return (lo + hi) / 2;
    return Math.max(lo + half, Math.min(hi - half, v));
  }
  function camTarget() {
    var hp = iso(hero.x, hero.y);
    return { x: clampAxis(hp.x, W / 2 / scale, BOUNDS.x0, BOUNDS.x1), y: clampAxis(hp.y - 20, H / 2 / scale, BOUNDS.y0, BOUNDS.y1) };
  }
  function snapCamera() { var t = camTarget(); cam.x = t.x; cam.y = t.y; }

  // ----------------------------------------------------------------- render
  function viewOrigin() {
    // Camera rounded to device pixels so every art pixel lands on whole device pixels.
    var cx = Math.round(cam.x * scale) / scale, cy = Math.round(cam.y * scale) / scale;
    return { ox: Math.floor(W / 2) - cx * scale, oy: Math.floor(H / 2) - cy * scale };
  }

  function drawWarp(w) {
    var p = iso(w.at.c, w.at.r), pulse = (Math.sin(time * 4.2) + 1) / 2, ring = 13 + pulse * 7;
    var col = w.kind === 'exit' ? ['rgba(255,211,92,0.22)', '#ffe28a', '#fff1b5'] : ['rgba(120,200,255,0.22)', '#9fdcff', '#d9f2ff'];
    ctx.save();
    ctx.globalAlpha = 0.6 + pulse * 0.35;
    ctx.fillStyle = col[0]; ctx.beginPath(); ctx.ellipse(p.x, p.y, 23 + pulse * 5, 10 + pulse * 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = col[1]; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(p.x, p.y, ring, ring * 0.48, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(p.x, p.y, ring * 0.62, ring * 0.3, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
  function drawWarpBeam(w) {
    var p = iso(w.at.c, w.at.r), pulse = (Math.sin(time * 4.2) + 1) / 2;
    var col = w.kind === 'exit' ? '#fff0ae' : '#d9f2ff';
    ctx.save();
    ctx.globalAlpha = 0.45 + pulse * 0.45; ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(p.x, p.y - 8); ctx.lineTo(p.x, p.y - 34 - pulse * 6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(p.x, p.y - 44 - pulse * 6); ctx.lineTo(p.x - 7, p.y - 33 - pulse * 6); ctx.lineTo(p.x + 7, p.y - 33 - pulse * 6); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  // Labels are drawn last so trees never hide the warp destination.
  function drawWarpLabel(w) {
    var p = iso(w.at.c, w.at.r), pulse = (Math.sin(time * 4.2) + 1) / 2;
    ctx.save();
    ctx.globalAlpha = 0.95; ctx.font = 'bold 10px system-ui, sans-serif';
    var tw = ctx.measureText(w.label).width + 14, by = p.y - 62 - pulse * 6;
    ctx.fillStyle = 'rgba(20,24,30,0.88)'; ctx.fillRect(Math.round(p.x - tw / 2), Math.round(by - 9), Math.round(tw), 16);
    ctx.strokeStyle = w.kind === 'exit' ? '#e8c66f' : '#7cc4ec'; ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(p.x - tw / 2) + 0.5, Math.round(by - 9) + 0.5, Math.round(tw) - 1, 15);
    ctx.fillStyle = '#fff6d8'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(w.label, p.x, by - 1);
    ctx.restore();
  }

  function render() {
    var v = viewOrigin();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#132128'; ctx.fillRect(0, 0, W, H);
    ctx.setTransform(scale, 0, 0, scale, v.ox, v.oy);
    ctx.imageSmoothingEnabled = false;

    ctx.drawImage(groundCanvas, GROUND_OX, GROUND_OY);
    M.WARPS.forEach(drawWarp);

    if (opts.grid) {
      ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1 / scale;
      for (var r = 0; r < M.ROWS; r++) for (var c = 0; c < M.COLS; c++) {
        var p = iso(c, r); ctx.beginPath();
        ctx.moveTo(p.x, p.y - 16); ctx.lineTo(p.x + 32, p.y); ctx.lineTo(p.x, p.y + 16); ctx.lineTo(p.x - 32, p.y); ctx.closePath(); ctx.stroke();
      }
    }
    if (opts.collision) {
      ctx.fillStyle = 'rgba(255,60,60,0.28)';
      for (var r2 = 0; r2 < M.ROWS; r2++) for (var c2 = 0; c2 < M.COLS; c2++) {
        if (M.walkable(c2, r2)) continue;
        var q = iso(c2, r2); ctx.beginPath();
        ctx.moveTo(q.x, q.y - 16); ctx.lineTo(q.x + 32, q.y); ctx.lineTo(q.x, q.y + 16); ctx.lineTo(q.x - 32, q.y); ctx.closePath(); ctx.fill();
      }
    }

    // Depth-sorted pass: props, hero and warp beams ordered by foot position (c + r).
    var bob = hero.moving ? Math.abs(Math.sin(time * 14)) * 3 : 0;
    var hs = renderHero(bob), hp = iso(hero.x, hero.y);
    var hx = Math.round(hp.x), hy = Math.round(hp.y);
    var k = opts.heroScale;
    // Tight body box of the visible hero (head to feet, incl. sword), used for occlusion tests.
    var heroRect = { x: hx - Math.round(9 * k), y: hy - Math.round(44 * k), w: Math.round(27 * k), h: Math.round(44 * k) };
    var objs = props.map(function (o) { return { d: o.c + o.r, t: o.c, o: o }; });
    objs.push({ d: hero.x + hero.y, t: hero.x, hero: true });
    M.WARPS.forEach(function (w) { objs.push({ d: w.at.c + w.at.r + 0.01, t: w.at.c, warp: w }); });
    objs.sort(function (a, b) { return (a.d - b.d) || (a.t - b.t); });
    var heroDepth = hero.x + hero.y, occluders = 0, fadedIds = [];
    objs.forEach(function (e) {
      if (e.hero) { ctx.drawImage(hs.canvas, hx - hs.ox, hy - hs.oy); return; }
      if (e.warp) { drawWarpBeam(e.warp); return; }
      var o = e.o, a = M.ASSETS[o.id], p = iso(o.c, o.r), x = p.x - a.px, y = p.y - a.py;
      var fade = false;
      if (opts.fade && a.kind === 'tree' && e.d > heroDepth) {
        fade = covers(o.id, x, y, heroRect);
      }
      if (fade) { ctx.globalAlpha = 0.5; occluders++; fadedIds.push(o.id + '@' + o.c + ',' + o.r); }
      ctx.drawImage(images[o.id], x, y);
      if (fade) ctx.globalAlpha = 1;
    });
    stats.occluders = occluders; stats.faded = fadedIds;
    M.WARPS.forEach(drawWarpLabel);

    if (opts.collision) {
      ctx.strokeStyle = '#ffeb3b'; ctx.lineWidth = 1 / scale; ctx.beginPath();
      var cs = [[-HERO_R, -HERO_R], [HERO_R, -HERO_R], [HERO_R, HERO_R], [-HERO_R, HERO_R]].map(function (d) { return iso(hero.x + d[0], hero.y + d[1]); });
      ctx.moveTo(cs[0].x, cs[0].y); cs.slice(1).forEach(function (p) { ctx.lineTo(p.x, p.y); }); ctx.closePath(); ctx.stroke();
    }
    if (input.path && input.path.length) {
      var dest = input.path[input.path.length - 1], dp = iso(dest.c, dest.r);
      ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(dp.x, dp.y - 9); ctx.lineTo(dp.x + 18, dp.y); ctx.lineTo(dp.x, dp.y + 9); ctx.lineTo(dp.x - 18, dp.y); ctx.closePath(); ctx.stroke();
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (fadeT > 0) { ctx.fillStyle = 'rgba(220,240,255,' + (fadeT / 0.35 * 0.8).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); }
  }

  function hud() {
    var t = heroTile();
    document.getElementById('pos').textContent = 'c ' + hero.x.toFixed(1) + '  r ' + hero.y.toFixed(1) + '  (' + t.c + ',' + t.r + ')';
    document.getElementById('fps').textContent = fps + ' fps · ×' + (scale / DPR).toFixed(2);
  }

  function frame(now) {
    if (!running) return;
    var dt = Math.min(0.05, (now - last) / 1000 || 0); last = now; time += dt;
    update(dt); render();
    fpsAcc += dt; fpsN++; stats.frames++;
    if (fpsAcc >= 0.5) { fps = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; hud(); }
    root.requestAnimationFrame(frame);
  }

  // ------------------------------------------------------------------ input
  function resize() {
    var cw = root.innerWidth, ch = root.innerHeight;
    canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
    W = Math.round(cw * DPR); H = Math.round(ch * DPR);
    canvas.width = W; canvas.height = H;
    ctx.imageSmoothingEnabled = false;
    // Integer device-pixel scale (keeps pixel art crisp). Default ≈ 1.33 CSS px per art px.
    minScale = 1; maxScale = Math.max(3, Math.round(DPR * 3));
    if (!resize.done) { scale = Math.max(2, Math.round(DPR * 4 / 3)); resize.done = true; }
    scale = Math.max(minScale, Math.min(maxScale, scale));
    hud();
  }
  function setZoom(delta) { scale = Math.max(minScale, Math.min(maxScale, scale + delta)); hud(); }

  function toast(msg) {
    var el = document.getElementById('toast'); el.textContent = msg; el.classList.add('show'); toastTimer = 2.6;
  }

  function bindKeys() {
    var keys = {};
    var map = { ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd', ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r' };
    function sync() { input.kx = (keys.r ? 1 : 0) - (keys.l ? 1 : 0); input.ky = (keys.d ? 1 : 0) - (keys.u ? 1 : 0); }
    root.addEventListener('keydown', function (e) { var k = map[e.code]; if (k) { keys[k] = true; sync(); e.preventDefault(); } });
    root.addEventListener('keyup', function (e) { var k = map[e.code]; if (k) { keys[k] = false; sync(); } });
    root.addEventListener('blur', function () { keys = {}; sync(); });
  }

  function bindJoystick() {
    var base = document.getElementById('stick'), knob = document.getElementById('knob'), id = null, R = 46;
    function center() { var b = base.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }
    function set(e) {
      var c = center(), dx = e.clientX - c.x, dy = e.clientY - c.y, d = Math.hypot(dx, dy);
      if (d > R) { dx = dx / d * R; dy = dy / d * R; }
      knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      input.jx = dx / R; input.jy = dy / R;
    }
    function end(e) {
      if (e.pointerId !== id) return; id = null; input.jx = 0; input.jy = 0;
      knob.style.transform = ''; base.classList.remove('active');
    }
    base.addEventListener('pointerdown', function (e) {
      e.preventDefault(); id = e.pointerId; base.setPointerCapture(id); base.classList.add('active'); set(e);
    });
    base.addEventListener('pointermove', function (e) { if (e.pointerId === id) { e.preventDefault(); set(e); } });
    base.addEventListener('pointerup', end); base.addEventListener('pointercancel', end);
  }

  function bindTap() {
    var down = null;
    canvas.addEventListener('pointerdown', function (e) { down = { x: e.clientX, y: e.clientY, id: e.pointerId }; });
    canvas.addEventListener('pointerup', function (e) {
      if (!down || down.id !== e.pointerId) return;
      var moved = Math.hypot(e.clientX - down.x, e.clientY - down.y); down = null;
      if (moved > 12) return;
      tapAt(e.clientX, e.clientY);
    });
  }
  function tapAt(clientX, clientY) {
    var v = viewOrigin();
    var wx = (clientX * DPR - v.ox) / scale, wy = (clientY * DPR - v.oy) / scale;
    var g = screenToGrid(wx, wy), tc = Math.round(g.c), tr = Math.round(g.r), t = heroTile();
    if (!M.walkable(tc, tr)) { toast('เดินไปตรงนั้นไม่ได้ (' + tc + ',' + tr + ')'); return null; }
    var path = bfs(t.c, t.r, tc, tr);
    if (!path) { toast('ไม่มีเส้นทาง'); return null; }
    input.path = path;
    return path;
  }

  function bindButtons() {
    function on(id, fn) { document.getElementById(id).addEventListener('click', function (e) { e.preventDefault(); fn(e.currentTarget); }); }
    function toggle(id, key) { on(id, function (b) { opts[key] = !opts[key]; b.classList.toggle('on', opts[key]); }); }
    on('zoomIn', function () { setZoom(1); });
    on('zoomOut', function () { setZoom(-1); });
    toggle('btnGrid', 'grid'); toggle('btnCol', 'collision'); toggle('btnFade', 'fade');
    on('btnHero', function (b) { opts.heroScale = opts.heroScale === 1 ? 1.5 : 1; b.textContent = 'Hero ×' + opts.heroScale; });
    on('btnHome', function () { hero.x = M.START.c; hero.y = M.START.r; input.path = null; warpArmed = {}; snapCamera(); });
    document.getElementById('btnFade').classList.toggle('on', opts.fade);
  }

  // ------------------------------------------------------------------- boot
  function boot() {
    canvas = document.getElementById('view');
    ctx = canvas.getContext('2d', { alpha: false });
    resize();
    root.addEventListener('resize', resize);
    root.addEventListener('orientationchange', function () { setTimeout(resize, 250); });
    document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
    var status = document.getElementById('loading');
    loadAssets().then(function (results) {
      var bad = results.filter(function (r) { return !r.ok; });
      api.assetResults = results;
      if (bad.length) {
        status.innerHTML = 'โหลด Asset ไม่สำเร็จ ' + bad.length + ' ไฟล์:<br>' + bad.map(function (b) { return b.id + ' (' + b.reason + ')'; }).join('<br>');
        status.classList.add('error');
        api.ready = false; api.error = bad;
        return;
      }
      waterTile = makeWaterTile(); buildMasks();
      layout = M.build(); props = layout.props;
      buildGround();
      snapCamera();
      bindKeys(); bindJoystick(); bindTap(); bindButtons();
      status.style.display = 'none';
      api.ready = true;
      running = true; last = performance.now(); root.requestAnimationFrame(frame);
    });
  }

  // Small debug/test API (used by tests/smoke.py; harmless in normal play).
  var api = {
    ready: false,
    state: function () {
      return { hero: { x: hero.x, y: hero.y }, tile: heroTile(), scale: scale, dpr: DPR, W: W, H: H,
        props: props.length, trail: layout && layout.trailCount, stats: JSON.parse(JSON.stringify(stats)),
        path: input.path ? input.path.length : 0, opts: JSON.parse(JSON.stringify(opts)), cam: { x: cam.x, y: cam.y } };
    },
    setStick: function (x, y) { input.jx = x; input.jy = y; },
    teleport: function (c, r) { hero.x = c; hero.y = r; input.path = null; snapCamera(); },
    tapTile: function (c, r) {
      var v = viewOrigin(), p = iso(c, r);
      return tapAt((p.x * scale + v.ox) / DPR, (p.y * scale + v.oy) / DPR);
    },
    collides: function (x, y) { return collides(x, y); },
    setOpt: function (k, val) { opts[k] = val; },
    setScale: function (s) { scale = s; },
    tileToScreen: function (c, r) { var v = viewOrigin(), p = iso(c, r); return { x: (p.x * scale + v.ox) / DPR, y: (p.y * scale + v.oy) / DPR }; }
  };
  root.WFPreview = api;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window);
