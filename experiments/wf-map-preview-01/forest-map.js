/* Legend of Eldoria - WF-MAP-01 Whispering Forest Map Preview
   forest-map.js: map layout + asset table for the standalone preview.

   SOURCES (read-only, nothing in the main game is modified):
   - Tile layout copied verbatim from js/map-data.js -> whispering_forest.tiles
     at main c79744071f9b6ea78b3f21b669aaeaffae4633a9.
   - Asset canvas / pivot values copied from experiments/wf-asset-01/manifest.json
     at e26cf54ea22746559b3bd68b850177e83bd166db (verified by tests/smoke.py).

   This file never touches the save engine, save schema or localStorage. */
(function (root) {
  'use strict';

  var ASSET_BASE = '../wf-asset-01/assets/';

  // id -> { file, w, h, px, py }  (px/py = pivot from manifest.json)
  var ASSETS = {
    tree_01:           { file: 'tree_01.png',           w: 128, h: 160, px: 64, py: 144, kind: 'tree' },
    tree_02:           { file: 'tree_02.png',           w: 128, h: 160, px: 64, py: 144, kind: 'tree' },
    tree_03:           { file: 'tree_03.png',           w: 128, h: 160, px: 64, py: 144, kind: 'tree' },
    bush_01:           { file: 'bush_01.png',           w: 64,  h: 48,  px: 32, py: 39,  kind: 'bush' },
    bush_02:           { file: 'bush_02.png',           w: 64,  h: 48,  px: 32, py: 39,  kind: 'bush' },
    rock_01:           { file: 'rock_01.png',           w: 64,  h: 48,  px: 32, py: 38,  kind: 'rock' },
    rock_02:           { file: 'rock_02.png',           w: 64,  h: 48,  px: 32, py: 38,  kind: 'rock' },
    grass_tile_01:     { file: 'grass_tile_01.png',     w: 64,  h: 32,  px: 32, py: 16,  kind: 'ground' },
    grass_tile_02:     { file: 'grass_tile_02.png',     w: 64,  h: 32,  px: 32, py: 16,  kind: 'ground' },
    grass_tile_03:     { file: 'grass_tile_03.png',     w: 64,  h: 32,  px: 32, py: 16,  kind: 'ground' },
    dirt_path_tile_01: { file: 'dirt_path_tile_01.png', w: 64,  h: 32,  px: 32, py: 16,  kind: 'ground' },
    dirt_path_tile_02: { file: 'dirt_path_tile_02.png', w: 64,  h: 32,  px: 32, py: 16,  kind: 'ground' }
  };

  // Verbatim copy of js/map-data.js whispering_forest.tiles (16 x 16).
  // '#' blocked_tree_or_cliff, '~' water, '=' forest_trail, '.' forest_floor
  var TILES = [
    '################',
    '#===.....#.....#',
    '#..#.....#..#..#',
    '#..#..~~....#..#',
    '#.....~~.##....#',
    '#.##......#....#',
    '#....####......#',
    '#....#.........#',
    '#....#..##.#...#',
    '#.......##.....#',
    '#..###.........#',
    '#......####....#',
    '#..#...........#',
    '#..#....#......#',
    '#......##......#',
    '################'
  ];

  var ROWS = TILES.length, COLS = TILES[0].length;
  var START = { c: 1, r: 1 };

  // Warps. forest_to_greenvale mirrors map-data.js; the two "test" warps are
  // preview-only and teleport between the NE and SE corners of the forest.
  var WARPS = [
    { id: 'forest_to_greenvale', at: { c: 1, r: 1 }, label: 'Greenvale', kind: 'exit' },
    { id: 'wf_test_ne', at: { c: 14, r: 1 }, label: 'Warp → SE', kind: 'test', target: 'wf_test_se' },
    { id: 'wf_test_se', at: { c: 14, r: 14 }, label: 'Warp → NE', kind: 'test', target: 'wf_test_ne' }
  ];

  function hash(c, r) { return (((c * 73856093) ^ (r * 19349663)) >>> 0); }
  function tile(c, r) { return (c < 0 || r < 0 || c >= COLS || r >= ROWS) ? '#' : TILES[r].charAt(c); }
  function walkable(c, r) { var t = tile(c, r); return t !== '#' && t !== '~'; }

  // 4-direction BFS used only to lay a visual dirt trail between points of interest.
  function bfs4(a, b) {
    var key = function (c, r) { return r * COLS + c; };
    var prev = {}, q = [a], seen = {}; seen[key(a.c, a.r)] = true;
    var D = [[1, 0], [0, 1], [-1, 0], [0, -1]];
    while (q.length) {
      var p = q.shift();
      if (p.c === b.c && p.r === b.r) break;
      for (var i = 0; i < 4; i++) {
        var nc = p.c + D[i][0], nr = p.r + D[i][1], k = key(nc, nr);
        if (!seen[k] && walkable(nc, nr)) { seen[k] = true; prev[k] = p; q.push({ c: nc, r: nr }); }
      }
    }
    var out = [], cur = b;
    if (!seen[key(b.c, b.r)]) return out;
    while (cur) { out.push(cur); cur = prev[key(cur.c, cur.r)]; }
    return out.reverse();
  }

  // Visual-only exploration trail (does NOT change collision; every trail tile
  // is already '.' or '=' in the map data).
  var TRAIL_POINTS = [START, { c: 8, r: 2 }, { c: 14, r: 1 }];
  var TRAIL_BRANCH = [{ c: 8, r: 2 }, { c: 7, r: 7 }, { c: 6, r: 12 }, { c: 11, r: 12 }, { c: 14, r: 14 }];
  function buildTrail() {
    var set = {};
    function lay(points) {
      for (var i = 0; i + 1 < points.length; i++) {
        bfs4(points[i], points[i + 1]).forEach(function (p) { set[p.r * COLS + p.c] = true; });
      }
    }
    lay(TRAIL_POINTS); lay(TRAIL_BRANCH);
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) if (tile(c, r) === '=') set[r * COLS + c] = true;
    return set;
  }

  function groundFor(c, r, trail) {
    var t = tile(c, r), h = hash(c, r);
    if (t === '~') return 'water';
    if (trail[r * COLS + c]) return (h % 3 === 0) ? 'dirt_path_tile_02' : 'dirt_path_tile_01';
    var g = h % 7;
    return g < 3 ? 'grass_tile_01' : (g < 5 ? 'grass_tile_02' : 'grass_tile_03');
  }

  // One blocking prop per '#' tile, chosen deterministically.
  function propFor(c, r) {
    if (tile(c, r) !== '#') return null;
    var h = hash(c + 3, r + 7), edge = (c === 0 || r === 0 || c === COLS - 1 || r === ROWS - 1);
    var trees = ['tree_01', 'tree_02', 'tree_03'];
    if (edge) return (h % 9 === 0) ? 'bush_01' : trees[h % 3];
    var k = h % 10;
    if (k < 5) return trees[h % 3];
    if (k < 7) return (h % 2) ? 'bush_02' : 'bush_01';
    return (h % 2) ? 'rock_02' : 'rock_01';
  }

  function build() {
    var trail = buildTrail(), ground = [], props = [];
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        ground.push({ c: c, r: r, id: groundFor(c, r, trail) });
        var p = propFor(c, r);
        if (p) props.push({ c: c, r: r, id: p });
      }
    }
    return { ground: ground, props: props, trailCount: Object.keys(trail).length };
  }

  root.WF_MAP = {
    ASSET_BASE: ASSET_BASE, ASSETS: ASSETS, TILES: TILES, ROWS: ROWS, COLS: COLS,
    START: START, WARPS: WARPS, TW: 64, TH: 32,
    tile: tile, walkable: walkable, hash: hash, build: build
  };
})(typeof window !== 'undefined' ? window : globalThis);
