/* Legend of Eldoria — isometric world maps: Greenvale Village and Whispering Forest. */
(function (root) {
  var E = root.ELDORIA;

  // # tree (blocked)   H house (blocked)   ~ water (blocked)   = path   . grass
  var MAP = [
    '############',
    '#....#.....#',
    '#.HH.=.....#',
    '#.HH.=..~~.#',
    '#....=..~~.#',
    '#=====.....#',
    '#....=.....#',
    '#.H..=..#..#',
    '#....=.....#',
    '#.......#..#',
    '#.........F#',
    '############'
  ];
  var FOREST_MAP = ['############','#....#.....#','#..........#','#..##...##.#','#..........#','#.##....#..#','#..........#','#...#..##..#','#..........#','#..##......#','#E.........#','############'];
  var MAPS = { 'greenvale-village': MAP, 'whispering-forest': FOREST_MAP };
  var ROWS = MAP.length, COLS = MAP[0].length;
  var currentMapId = 'greenvale-village';
  var TW = 64, TH = 32;
  var START = { c: 5, r: 5 };
  var HERO_SPEED = 5.2, PORING_SPEED = 1.5;

  var DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  var HELD = { up: [-1, -1], down: [1, 1], left: [-1, 1], right: [1, -1] };

  function activeMap() { return MAPS[currentMapId] || MAP; }
  function tile(c, r) { var map = activeMap(); return (c < 0 || r < 0 || c >= map[0].length || r >= map.length) ? '#' : map[r].charAt(c); }
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

  var W = E.World = { onEncounter: null, onSafeTile: null };
  var cv, ctx, dpr = 1, vw = 0, vh = 0, scale = 1;
  var running = false, lastT = 0, time = 0;
  var hero = { c: START.c, r: START.r, x: START.c, y: START.r, path: [], moving: false };
  var porings = [];
  var held = null;
  var marker = null, lastSafeTile = null;
  var appearance = { gender: 'male', hairstyle: 0, hairColor: 0 };
  var HAIR = ['#302018','#65402a','#e4c36b','#a83f32','#426fb7','#43834c','#b9c4cf','#8052a2'];

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
    currentMapId = 'greenvale-village'; ROWS = activeMap().length; COLS = activeMap()[0].length;
    hero.c = START.c; hero.r = START.r; hero.x = START.c; hero.y = START.r; hero.path = [];
    spawnPoring();
    W.resume();
  };
  W.resume = function () {
    held = null; marker = null;
    resize();
    if (!running) { running = true; lastT = performance.now(); requestAnimationFrame(frame); }
  };
  W.pause = function () { running = false; held = null; };
  // Public save API: only stable, completed tile positions are exposed.
  W.getPosition = function () { return { mapId: currentMapId, x: hero.c, y: hero.r, safe: !hero.moving && hero.path.length === 0 }; };
  W.setPosition = function (p) {
    if (!p || !MAPS[p.mapId] || !Number.isInteger(p.x) || !Number.isInteger(p.y)) return false;
    var old = currentMapId; currentMapId = p.mapId; ROWS = activeMap().length; COLS = activeMap()[0].length;
    if (!walk(p.x, p.y)) { currentMapId = old; ROWS = activeMap().length; COLS = activeMap()[0].length; return false; }
    hero.c = hero.x = p.x; hero.r = hero.y = p.y; hero.path = []; lastSafeTile = p.x + ',' + p.y; spawnPoring();
    if (W.onMapChange) W.onMapChange(currentMapId); return true;
  };
  W.respawn = function (resetHero) {
    if (resetHero) { currentMapId = 'greenvale-village'; ROWS = activeMap().length; COLS = activeMap()[0].length; hero.c = START.c; hero.r = START.r; hero.x = START.c; hero.y = START.r; if (W.onMapChange) W.onMapChange(currentMapId); }
    hero.path = []; spawnPoring();
  };

  function spawnPoring() {
    var candidates = [];
    for (var r = 0; r < ROWS; r++) for (var q = 0; q < COLS; q++) {
      if (tile(q, r) === '.' && Math.max(Math.abs(q - hero.c), Math.abs(r - hero.r)) >= 3) candidates.push([q, r]);
    }
    var count = currentMapId === 'whispering-forest' ? E.createForestEncounter().length : 1;
    porings = [];
    for (var n = 0; n < count && candidates.length; n++) {
      var p = candidates.splice(Math.floor(Math.random() * candidates.length), 1)[0];
      porings.push({ id:'world-poring-'+(n+1), c:p[0], r:p[1], x:p[0], y:p[1], tc:p[0], tr:p[1], wait:0.6+Math.random() });
    }
  }
  function switchMap(mapId) {
    if (!MAPS[mapId] || mapId === currentMapId) return;
    currentMapId = mapId; ROWS = activeMap().length; COLS = activeMap()[0].length;
    var start = mapId === 'whispering-forest' ? {c:1,r:10} : START;
    hero.c = hero.x = start.c; hero.r = hero.y = start.r; hero.path = []; hero.moving = false;
    lastSafeTile = null; spawnPoring();
    if (W.onMapChange) W.onMapChange(currentMapId);
    if (W.onSafeTile) W.onSafeTile();
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

    if (!hero.moving && hero.path.length === 0) {
      var safeKey = hero.c + ',' + hero.r;
      if (safeKey !== lastSafeTile) { lastSafeTile = safeKey; if (W.onSafeTile) W.onSafeTile(); }
    }

    if (!hero.moving && hero.path.length === 0) {
      if (currentMapId === 'greenvale-village' && tile(hero.c, hero.r) === 'F') { switchMap('whispering-forest'); return; }
      if (currentMapId === 'whispering-forest' && tile(hero.c, hero.r) === 'E') { switchMap('greenvale-village'); return; }
    }
    for (var pi = 0; pi < porings.length; pi++) {
      var poring = porings[pi];
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
      var ex = hero.x - poring.x, ey = hero.y - poring.y;
      if (Math.sqrt(ex * ex + ey * ey) < 1.15 && W.onEncounter) {
        hero.path = []; held = null; hero.x = hero.c; hero.y = hero.r; hero.moving = false; running = false;
        W.onEncounter({ mapId:currentMapId, monsterIds:currentMapId === 'whispering-forest' ? porings.map(function(){return 'poring';}) : ['poring'] });
        break;
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
    else if (t === 'F' || t === 'E') fill = alt ? '#d7bd72' : '#c9a85c';
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
    var hair = HAIR[appearance.hairColor] || HAIR[0], style = appearance.hairstyle || 0;
    ctx.fillStyle = hair; ctx.beginPath();
    if (style % 3 === 0) { ctx.arc(p.x, p.y - 35 - bob, 8, Math.PI, 0); }
    else if (style % 3 === 1) { ctx.ellipse(p.x, p.y - 34 - bob, 9, 8, 0, Math.PI, Math.PI * 2); }
    else { ctx.ellipse(p.x, p.y - 35 - bob, 8, 10, 0, Math.PI, Math.PI * 2); }
    ctx.fill();
    if (style >= 3) ctx.fillRect(p.x + (style % 2 ? 4 : -8), p.y - 34 - bob, 4, 12);
    if (appearance.gender === 'female') { ctx.fillRect(p.x - 8, p.y - 30 - bob, 3, 8); ctx.fillRect(p.x + 5, p.y - 30 - bob, 3, 8); }
    ctx.fillStyle = '#2a1d10'; ctx.fillRect(p.x - 3.5, p.y - 32 - bob, 2, 3); ctx.fillRect(p.x + 1.5, p.y - 32 - bob, 2, 3);
    ctx.strokeStyle = '#d7dde6'; ctx.lineWidth = 3; ctx.beginPath();                    // small sword
    ctx.moveTo(p.x + 9, p.y - 14 - bob); ctx.lineTo(p.x + 16, p.y - 30 - bob); ctx.stroke();
  }

  W.setAppearance = function(profile) { if(!profile)return; appearance={gender:profile.gender==='female'?'female':'male',hairstyle:Number.isInteger(profile.hairstyle)?Math.max(0,Math.min(5,profile.hairstyle)):0,hairColor:Number.isInteger(profile.hairColor)?Math.max(0,Math.min(7,profile.hairColor)):0}; };

  function drawPoring(poring) {
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
    porings.forEach(function(poring){ objs.push({ d: poring.x + poring.y, fn: drawPoring, p: poring }); });
    objs.sort(function (a, b) { return a.d - b.d; });
    for (var i = 0; i < objs.length; i++) { if (objs[i].p) objs[i].fn(objs[i].p); else objs[i].fn(objs[i].c, objs[i].r); }
  }

  function frame(now) {
    if (!running) return;
    var dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    update(dt);
    if (running) render();
    if (running) requestAnimationFrame(frame);
  }

  W.onMapChange = null;
  W._debug = { MAP:MAP, FOREST_MAP:FOREST_MAP, walk:walk, bfs:bfs, hero:hero, getPoring:function(){return porings[0]||null;}, getPorings:function(){return porings.slice();}, switchMap:switchMap, getMapId:function(){return currentMapId;} };
})(typeof window !== 'undefined' ? window : globalThis);
