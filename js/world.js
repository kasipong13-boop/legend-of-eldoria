/* Legend of Eldoria - Prototype 0.1
   world.js: isometric Greenvale Village. Tap/click to walk, or use the D-pad / arrow keys / WASD.
   Touch the Poring to start a battle. Everything is drawn on one canvas (no image files needed). */
(function (root) {
  var E = root.ELDORIA;

  // # tree (blocked)   H house (blocked)   ~ water (blocked)   = path   . grass
  var MAP_DATA = E.MapData.get('greenvale');
  var MAP = MAP_DATA.tiles;
  var ROWS = MAP.length, COLS = MAP[0].length;
  var TW = 64, TH = 32;
  var START = { c: 5, r: 5 };
  var HERO_SPEED = 5.2, PORING_SPEED = 1.5;

  var DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  var HELD = { up: [-1, -1], down: [1, 1], left: [-1, 1], right: [1, -1] };

  function tile(c, r) { return (c < 0 || r < 0 || c >= COLS || r >= ROWS) ? '#' : MAP[r].charAt(c); }
  function walk(c, r) { var t = tile(c, r); return t !== '#' && t !== 'H' && t !== '~'; }
  function canMove(c, r, nc, nr) {
    if (!walk(nc, nr)) return false;
    var dc = nc - c, dr = nr - r;
    if (dc !== 0 && dr !== 0) return walk(c + dc, r) && walk(c, r + dr); // no cutting corners
    return true;
  }
  function hash(c, r) { return ((c * 73856093) ^ (r * 19349663)) >>> 0; }
  function iso(x, y) { return { x: (x - y) * TW / 2, y: (x + y) * TH / 2 }; }

  function bfs(sc, sr, dc, dr) {
    if (sc === dc && sr === dr) return [];
    if (!walk(dc, dr)) return null;
    var seen = {}, prev = {}, q = [[sc, sr]];
    seen[sr * COLS + sc] = true;
    while (q.length) {
      var cur = q.shift();
      for (var i = 0; i < DIRS.length; i++) {
        var nc = cur[0] + DIRS[i][0], nr = cur[1] + DIRS[i][1], k = nr * COLS + nc;
        if (seen[k] || !canMove(cur[0], cur[1], nc, nr)) continue;
        seen[k] = true; prev[k] = cur;
        if (nc === dc && nr === dr) {
          var path = [], p = [nc, nr];
          while (!(p[0] === sc && p[1] === sr)) { path.unshift({ c: p[0], r: p[1] }); p = prev[p[1] * COLS + p[0]]; }
          return path;
        }
        q.push([nc, nr]);
      }
    }
    return null;
  }

  var W = E.World = { onEncounter: null };
  var cv, ctx, dpr = 1, vw = 0, vh = 0, scale = 1;
  var running = false, lastT = 0, time = 0;
  var hero = { c: START.c, r: START.r, x: START.c, y: START.r, path: [], moving: false };
  var poring = null;
  var spawnManager = null;
  var held = null;
  var marker = null;

  /* ---------- setup ---------- */
  W.init = function (canvas) {
    cv = canvas; ctx = cv.getContext('2d');
    cv.addEventListener('pointerdown', onTap);
    window.addEventListener('resize', function () { if (running) resize(); });
    window.addEventListener('orientationchange', function () { setTimeout(function () { if (running) resize(); }, 250); });

    var keymap = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right' };
    window.addEventListener('keydown', function (e) {
      if (!running || !keymap[e.key]) return;
      e.preventDefault(); held = keymap[e.key];
    });
    window.addEventListener('keyup', function (e) {
      if (keymap[e.key] && held === keymap[e.key]) held = null;
    });

    var pad = document.getElementById('dpad');
    var btns = pad.querySelectorAll('button');
    Array.prototype.forEach.call(btns, function (b) {
      var dir = b.getAttribute('data-dir');
      function down(e) { e.preventDefault(); held = dir; b.classList.add('held'); }
      function up() { if (held === dir) held = null; b.classList.remove('held'); }
      b.addEventListener('pointerdown', down);
      b.addEventListener('pointerup', up);
      b.addEventListener('pointerleave', up);
      b.addEventListener('pointercancel', up);
    });
  };

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    vw = cv.clientWidth; vh = cv.clientHeight;
    cv.width = Math.round(vw * dpr); cv.height = Math.round(vh * dpr);
    scale = Math.max(0.75, Math.min(1.15, Math.min(vw, vh * 1.2) / 520));
  }

  W.start = function () {
    hero.c = START.c; hero.r = START.r; hero.x = START.c; hero.y = START.r; hero.path = [];
    initializeSpawnManager();
    W.resume();
  };
  W.resume = function () {
    held = null; marker = null;
    resize();
    if (!running) { running = true; lastT = performance.now(); requestAnimationFrame(frame); }
  };
  W.pause = function () { running = false; held = null; };

  // Save/Load integration: expose the settled tile without changing movement rules.
  W.startPosition = function () { return { c: START.c, r: START.r }; };
  W.getPosition = function () {
    return { c: hero.c, r: hero.r };
  };
  W.setPosition = function (position) {
    if (!position || !Number.isInteger(position.c) || !Number.isInteger(position.r) || !walk(position.c, position.r)) return false;
    hero.c = position.c; hero.r = position.r;
    hero.x = position.c; hero.y = position.r;
    hero.path = []; hero.moving = false; held = null; marker = null;
    return true;
  };
  W.respawn = function (resetHero) {
    if (resetHero) { hero.c = START.c; hero.r = START.r; hero.x = START.c; hero.y = START.r; }
    hero.path = [];
    if (resetHero) { /* keep existing map position reset behavior */ }
    // Initialize once on first entry; subsequent returns preserve each slot's timer.
    initializeSpawnManager();
    syncMonsterSpawn();
  };

  function initializeSpawnManager() {
    if (!spawnManager) {
      spawnManager = E.MonsterSpawn.createManager({ map: MAP_DATA, config: { minPlayerDistance: 4 } });
      spawnManager.initialize({ c: hero.c, r: hero.r });
    }
    syncMonsterSpawn();
  }
  function syncMonsterSpawn() {
    if (!spawnManager) return;
    var live = spawnManager.getInstances();
    if (!live.length) { poring = null; return; }
    var instance = live[0];
    if (poring && poring.instanceId === instance.id) return;
    poring = { instanceId: instance.id, c: instance.position.c, r: instance.position.r,
      x: instance.position.c, y: instance.position.r, tc: instance.position.c,
      tr: instance.position.r, wait: 0.6 + Math.random() };
  }

  /* ---------- input ---------- */
  function onTap(e) {
    if (!running) return;
    e.preventDefault();
    var rect = cv.getBoundingClientRect();
    var px = e.clientX - rect.left, py = e.clientY - rect.top;
    var cp = iso(hero.x, hero.y);
    var ix = cp.x + (px - vw / 2) / scale;
    var iy = cp.y + (py - (vh / 2 + 10)) / scale;
    var a = ix / (TW / 2), b = iy / (TH / 2);
    var tx = Math.round((a + b) / 2), ty = Math.round((b - a) / 2);
    if (!walk(tx, ty)) return;
    var from = hero.path.length ? hero.path[0] : { c: hero.c, r: hero.r };
    var p = bfs(from.c, from.r, tx, ty);
    if (!p) return;
    hero.path = (hero.path.length ? [hero.path[0]] : []).concat(p);
    marker = { x: tx, y: ty, t: 0 };
  }

  /* ---------- update ---------- */
  function update(dt) {
    time += dt;
    if (marker) { marker.t += dt; if (marker.t > 0.8) marker = null; }

    // hero: held direction -> queue one step
    if (held && hero.path.length === 0) {
      var d = HELD[held], nc = hero.c + d[0], nr = hero.r + d[1];
      if (canMove(hero.c, hero.r, nc, nr)) hero.path.push({ c: nc, r: nr });
    }
    hero.moving = false;
    var step = HERO_SPEED * dt;
    while (hero.path.length && step > 0) {
      var t = hero.path[0], dx = t.c - hero.x, dy = t.r - hero.y, dist = Math.sqrt(dx * dx + dy * dy);
      hero.moving = true;
      if (dist <= step) { hero.x = t.c; hero.y = t.r; hero.c = t.c; hero.r = t.r; hero.path.shift(); step -= dist; }
      else { hero.x += dx / dist * step; hero.y += dy / dist * step; step = 0; }
    }

    // Respawn timers are owned by the map's spawn-slot manager.
    if (spawnManager) {
      spawnManager.tick({ c: hero.c, r: hero.r });
      syncMonsterSpawn();
    }

    // poring wanders
    if (poring) {
      var pdx = poring.tc - poring.x, pdy = poring.tr - poring.y, pd = Math.sqrt(pdx * pdx + pdy * pdy);
      if (pd > 0.001) {
        var ps = PORING_SPEED * dt;
        if (pd <= ps) { poring.x = poring.tc; poring.y = poring.tr; poring.c = poring.tc; poring.r = poring.tr; }
        else { poring.x += pdx / pd * ps; poring.y += pdy / pd * ps; }
      } else {
        poring.wait -= dt;
        if (poring.wait <= 0) {
          poring.wait = 0.7 + Math.random() * 1.2;
          var opts = [];
          for (var i = 0; i < 4; i++) {
            var nc2 = poring.c + DIRS[i][0], nr2 = poring.r + DIRS[i][1];
            if (canMove(poring.c, poring.r, nc2, nr2) && !(nc2 === hero.c && nr2 === hero.r)) opts.push([nc2, nr2]);
          }
          if (opts.length) { var o = opts[Math.floor(Math.random() * opts.length)]; poring.tc = o[0]; poring.tr = o[1]; }
        }
      }

      // touching the poring starts a battle
      var ex = hero.x - poring.x, ey = hero.y - poring.y;
      if (Math.sqrt(ex * ex + ey * ey) < 1.15 && W.onEncounter) {
        hero.path = []; held = null;
        if (spawnManager && poring.instanceId) spawnManager.defeat(poring.instanceId);
        poring = null;
        running = false;
        W.onEncounter('poring');
      }
    }
  }

  /* ---------- drawing ---------- */
  function diamond(cx, cy, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - TH / 2); ctx.lineTo(cx + TW / 2, cy); ctx.lineTo(cx, cy + TH / 2); ctx.lineTo(cx - TW / 2, cy);
    ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
  }
  function poly(pts, fill) {
    ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
    for (var i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
  }
  function box(cx, cy, h, top, left, right) {
    var hw = TW / 2, hh = TH / 2;
    poly([cx - hw, cy - h, cx, cy - h + hh, cx, cy + hh, cx - hw, cy], left);
    poly([cx + hw, cy - h, cx, cy - h + hh, cx, cy + hh, cx + hw, cy], right);
    poly([cx, cy - h - hh, cx + hw, cy - h, cx, cy - h + hh, cx - hw, cy - h], top);
  }
  function shadow(x, y, rx, ry) {
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fill();
  }

  function drawGround(c, r) {
    var p = iso(c, r), t = tile(c, r), h = hash(c, r), alt = (c + r) % 2 === 0;
    var fill;
    if (t === '=') fill = alt ? '#b99c6a' : '#c3a676';
    else if (t === '~') fill = alt ? '#3d83b0' : '#4590bd';
    else if (t === '#' || t === 'H') fill = '#3f7440';
    else fill = alt ? '#4c8546' : '#538c4c';
    diamond(p.x, p.y, fill, 'rgba(0,0,0,0.10)');

    if (t === '.' && h % 3 === 0) {
      ctx.strokeStyle = '#3a6f3b'; ctx.lineWidth = 1.5; ctx.beginPath();
      var ox = (h % 17) - 8, oy = ((h >> 4) % 9) - 4;
      ctx.moveTo(p.x + ox, p.y + oy); ctx.lineTo(p.x + ox - 2, p.y + oy - 6);
      ctx.moveTo(p.x + ox + 3, p.y + oy); ctx.lineTo(p.x + ox + 4, p.y + oy - 6);
      ctx.stroke();
    }
    if (t === '.' && h % 11 === 0) {
      ctx.fillStyle = (h % 2) ? '#f6e27a' : '#f4a9c4';
      ctx.beginPath(); ctx.arc(p.x + ((h >> 3) % 15) - 7, p.y + ((h >> 7) % 7) - 3, 2.4, 0, Math.PI * 2); ctx.fill();
    }
    if (t === '~') {
      var w = Math.sin(time * 2 + c * 1.3 + r * 0.7);
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.18 + 0.12 * w) + ')'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(p.x - 10, p.y); ctx.lineTo(p.x + 2 + w * 3, p.y); ctx.stroke();
    }
  }

  function drawTree(c, r) {
    var p = iso(c, r), h = hash(c, r), s = 0.9 + (h % 5) * 0.06;
    shadow(p.x, p.y + 4, 20 * s, 8 * s);
    ctx.fillStyle = '#6b4a2b'; ctx.fillRect(p.x - 4, p.y - 18 * s, 8, 22 * s);
    var greens = ['#2f6b35', '#38783d', '#2a5f31'];
    var blobs = [[0, -38, 20], [-13, -24, 15], [13, -24, 15], [0, -26, 16]];
    for (var i = 0; i < blobs.length; i++) {
      ctx.fillStyle = greens[i % 3];
      ctx.beginPath(); ctx.arc(p.x + blobs[i][0] * s, p.y + blobs[i][1] * s, blobs[i][2] * s, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawHouse(c, r) {
    var p = iso(c, r);
    box(p.x, p.y, 36, '#a8483c', '#cdb98d', '#a8956d');
    if ((c + r) % 2 === 0) {
      ctx.fillStyle = '#5a3d22'; // door
      poly([p.x + 6, p.y - 2, p.x + 18, p.y - 8, p.x + 18, p.y - 24, p.x + 6, p.y - 18], '#5a3d22');
    } else {
      poly([p.x - 22, p.y - 18, p.x - 10, p.y - 12, p.x - 10, p.y - 24, p.x - 22, p.y - 30], '#f3d58a'); // window
    }
  }

  function drawHero() {
    var p = iso(hero.x, hero.y);
    var bob = hero.moving ? Math.abs(Math.sin(time * 14)) * 3 : 0;
    shadow(p.x, p.y + 2, 11, 5);
    ctx.fillStyle = '#2f3e63'; ctx.fillRect(p.x - 6, p.y - 8 - bob * 0.4, 5, 9);   // legs
    ctx.fillRect(p.x + 1, p.y - 8 + bob * 0.4, 5, 9);
    ctx.fillStyle = '#3f6fd1'; ctx.beginPath();                                          // tunic
    ctx.moveTo(p.x - 8, p.y - 8 - bob); ctx.lineTo(p.x + 8, p.y - 8 - bob); ctx.lineTo(p.x + 6, p.y - 26 - bob); ctx.lineTo(p.x - 6, p.y - 26 - bob);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e6b04b'; ctx.fillRect(p.x - 8, p.y - 15 - bob, 16, 3);              // belt
    ctx.fillStyle = '#f1c9a0'; ctx.beginPath(); ctx.arc(p.x, p.y - 32 - bob, 8, 0, Math.PI * 2); ctx.fill(); // head
    ctx.fillStyle = '#5a3a1e'; ctx.beginPath(); ctx.arc(p.x, p.y - 35 - bob, 8, Math.PI, 0); ctx.fill();   // hair
    ctx.fillStyle = '#2a1d10'; ctx.fillRect(p.x - 3.5, p.y - 32 - bob, 2, 3); ctx.fillRect(p.x + 1.5, p.y - 32 - bob, 2, 3);
    ctx.strokeStyle = '#d7dde6'; ctx.lineWidth = 3; ctx.beginPath();                    // small sword
    ctx.moveTo(p.x + 9, p.y - 14 - bob); ctx.lineTo(p.x + 16, p.y - 30 - bob); ctx.stroke();
  }

  function drawPoring() {
    var p = iso(poring.x, poring.y);
    var sq = Math.sin(time * 4 + poring.c);
    var w = 17 + sq * 1.5, h = 13 - sq * 1.5;
    shadow(p.x, p.y + 2, 14, 5);
    var g = ctx.createRadialGradient(p.x - 5, p.y - h - 4, 2, p.x, p.y - h, w);
    g.addColorStop(0, '#ffd8e5'); g.addColorStop(0.55, '#f29bb8'); g.addColorStop(1, '#d4698b');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(p.x, p.y - h + 2, w, h, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3a1a28';
    ctx.beginPath(); ctx.ellipse(p.x - 5, p.y - h, 2, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(p.x + 5, p.y - h, 2, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#3a1a28'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(p.x, p.y - h + 5, 3, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
  }

  function render() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, vw, vh);
    var cp = iso(hero.x, hero.y);
    ctx.translate(vw / 2 - cp.x * scale, vh / 2 + 10 - cp.y * scale);
    ctx.scale(scale, scale);

    var r, c;
    for (r = 0; r < ROWS; r++) for (c = 0; c < COLS; c++) drawGround(c, r);

    if (marker) {
      var mp = iso(marker.x, marker.y), k = marker.t / 0.8;
      ctx.strokeStyle = 'rgba(255,240,170,' + (1 - k) + ')'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(mp.x, mp.y, 8 + 14 * k, 4 + 7 * k, 0, 0, Math.PI * 2); ctx.stroke();
    }

    var objs = [];
    for (r = 0; r < ROWS; r++) for (c = 0; c < COLS; c++) {
      var t = tile(c, r);
      if (t === '#') objs.push({ d: c + r, fn: drawTree, c: c, r: r });
      else if (t === 'H') objs.push({ d: c + r, fn: drawHouse, c: c, r: r });
    }
    objs.push({ d: hero.x + hero.y + 0.01, fn: drawHero });
    if (poring) objs.push({ d: poring.x + poring.y, fn: drawPoring });
    objs.sort(function (a, b) { return a.d - b.d; });
    for (var i = 0; i < objs.length; i++) objs[i].fn(objs[i].c, objs[i].r);
  }

  function frame(now) {
    if (!running) return;
    var dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    update(dt);
    if (running) render();
    if (running) requestAnimationFrame(frame);
  }

  W.getSpawnSnapshot = function () { return spawnManager ? spawnManager.snapshot() : null; };
  W.restoreSpawnSnapshot = function (data) {
    if (!spawnManager) initializeSpawnManager();
    try { spawnManager.restore(data); syncMonsterSpawn(); return true; } catch (err) { return false; }
  };
  W._debug = { MAP: MAP, walk: walk, bfs: bfs, hero: hero, getPoring: function () { return poring; },
    getSpawnStatus: function () { return spawnManager ? spawnManager.getStatus() : null; } };
})(typeof window !== 'undefined' ? window : globalThis);
