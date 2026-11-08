(function (root) {
  'use strict';
  var E = root.ELDORIA = root.ELDORIA || {};
  function clone(value) { return JSON.parse(JSON.stringify(value)); }

  function validate(map) {
    var errors = [];
    var width = map && map.tiles && map.tiles[0] ? map.tiles[0].length : 0;
    var height = map && map.tiles ? map.tiles.length : 0;
    function inside(point) {
      return point && Number.isInteger(point.c) && Number.isInteger(point.r) &&
        point.c >= 0 && point.r >= 0 && point.c < width && point.r < height;
    }
    if (!map || !map.id) errors.push('MAP_ID_REQUIRED');
    if (!width || !height || map.tiles.some(function (row) {
      return typeof row !== 'string' || row.length !== width;
    })) errors.push('MAP_TILES_NOT_RECTANGULAR');
    if (!inside(map && map.start)) errors.push('MAP_START_OUT_OF_BOUNDS');
    (map && map.spawnZones || []).forEach(function (zone) {
      if (!zone.id || !Array.isArray(zone.tiles) || !zone.tiles.length) errors.push('INVALID_SPAWN_ZONE');
      (zone.tiles || []).forEach(function (point) {
        if (!inside(point)) errors.push('SPAWN_TILE_OUT_OF_BOUNDS:' + zone.id);
      });
    });
    (map && map.warps || []).forEach(function (warp) {
      if (!warp.id || !inside(warp.at) || !warp.targetMapId || !warp.targetSpawnId) errors.push('INVALID_WARP:' + warp.id);
    });
    (map && map.spawnPoints || []).forEach(function (point) {
      if (!point.id || !inside(point.at)) errors.push('INVALID_SPAWN_POINT:' + point.id);
    });
    (map && map.npcs || []).forEach(function (npc) {
      if (!npc.id || !inside(npc.at)) errors.push('INVALID_NPC:' + npc.id);
    });
    return { valid: errors.length === 0, errors: errors, width: width, height: height };
  }


  // Greenvale is intentionally generated from a deterministic layout recipe.
  // The original 12x12 footprint is retained so existing saved coordinates remain valid.
  function buildGreenvale() {
    var size = 40, grid = [];
    for (var r = 0; r < size; r++) {
      grid[r] = [];
      for (var c = 0; c < size; c++) grid[r][c] = (r === 0 || c === 0 || r === size - 1 || c === size - 1) ? '#' : '.';
    }
    var legacy = [
      '############', '#....#.....#', '#.HH.=.....#', '#.HH.=..~~.#',
      '#....=..~~.#', '#=====.....#', '#....=.....#', '#.H..=..#..#',
      '#....=.....#', '#.......#..#', '#..........#', '############'
    ];
    legacy.forEach(function (row, r) {
      for (var c = 0; c < row.length; c++) grid[r][c] = row.charAt(c);
    });
    // Open two old perimeter gates into the expanded city without changing any old walkable tile.
    grid[5][11] = '=';
    grid[11][5] = '=';
    // Main avenues and connected district streets.
    for (var c1 = 11; c1 <= 38; c1++) grid[5][c1] = '=';
    for (var r1 = 5; r1 <= 34; r1++) grid[r1][20] = '=';
    for (var c2 = 5; c2 <= 37; c2++) grid[20][c2] = '=';
    for (var r2 = 11; r2 <= 20; r2++) grid[r2][11] = '=';
    for (var c3 = 7; c3 <= 31; c3++) grid[14][c3] = '=';
    for (var r3 = 14; r3 <= 28; r3++) grid[r3][31] = '=';
    for (var c4 = 11; c4 <= 31; c4++) grid[27][c4] = '=';
    // Riverside promenade and bridges.
    for (var c5 = 2; c5 <= 37; c5++) { grid[31][c5] = '~'; grid[32][c5] = '~'; }
    for (var bridge = 19; bridge <= 21; bridge++) { grid[31][bridge] = '='; grid[32][bridge] = '='; }
    for (var pondR = 25; pondR <= 29; pondR++) {
      for (var pondC = 3; pondC <= 7; pondC++) grid[pondR][pondC] = '~';
    }
    // District buildings: houses occupy blocked footprints, roads remain clear.
    function building(x, y, w, h) {
      for (var by = y; by < y + h; by++) for (var bx = x; bx < x + w; bx++) {
        if (bx > 0 && by > 0 && bx < size - 1 && by < size - 1) grid[by][bx] = 'H';
      }
    }
    building(14, 8, 3, 3);   // North-west homes
    building(24, 8, 3, 3);   // North-east homes
    building(7, 23, 3, 3);   // West market
    building(13, 25, 3, 3);  // Riverside inn
    building(25, 23, 3, 3);  // Smithy and crafting quarter
    building(23, 28, 4, 2);  // Guild hall
    // Green belts and park groves. Leave avenues, bridges and the gate open.
    function grove(x, y, w, h) {
      for (var gy = y; gy < y + h; gy++) for (var gx = x; gx < x + w; gx++) {
        if (grid[gy][gx] === '.' && ((gx * 7 + gy * 11) % 4 !== 0)) grid[gy][gx] = '#';
      }
    }
    grove(2, 12, 5, 6);
    grove(33, 7, 5, 7);
    grove(3, 20, 3, 4);
    grove(33, 22, 5, 6);
    grove(8, 33, 7, 4);
    grove(27, 34, 8, 3);
    // Restore connected streets and designated crossing after decorative placement.
    for (var roadC = 11; roadC <= 38; roadC++) grid[5][roadC] = '=';
    for (var roadR = 5; roadR <= 34; roadR++) grid[roadR][20] = '=';
    for (var roadC2 = 5; roadC2 <= 37; roadC2++) grid[20][roadC2] = '=';
    for (var roadR2 = 11; roadR2 <= 20; roadR2++) grid[roadR2][11] = '=';
    for (var roadC3 = 7; roadC3 <= 31; roadC3++) grid[14][roadC3] = '=';
    for (var roadR3 = 14; roadR3 <= 28; roadR3++) grid[roadR3][31] = '=';
    for (var roadC4 = 11; roadC4 <= 31; roadC4++) grid[27][roadC4] = '=';
    for (var bridgeC = 19; bridgeC <= 21; bridgeC++) { grid[31][bridgeC] = '='; grid[32][bridgeC] = '='; }
    grid[20][38] = '='; // Eastern forest gate
    return grid.map(function (row) { return row.join(''); });
  }

  function buildGreenvaleMap() {
    return {
      id: 'greenvale', name: 'Greenvale Village', tileWidth: 64, tileHeight: 32,
      start: { c: 5, r: 5 }, tiles: buildGreenvale(),
      legend: { '#': 'tree_or_grove', H: 'building', '~': 'water', '=': 'cobblestone_road', '.': 'grass' },
      safeZone: true,
      districts: [
        { id: 'old_quarter', name: 'Old Village', bounds: { x: 1, y: 1, width: 10, height: 10 } },
        { id: 'central_plaza', name: 'Central Plaza', bounds: { x: 16, y: 16, width: 9, height: 9 } },
        { id: 'residential_north', name: 'North Residential', bounds: { x: 12, y: 7, width: 16, height: 6 } },
        { id: 'market_west', name: 'West Market', bounds: { x: 6, y: 22, width: 5, height: 5 } },
        { id: 'riverside_inn', name: 'Riverside Inn', bounds: { x: 12, y: 24, width: 5, height: 5 } },
        { id: 'crafting_quarter', name: 'Crafting Quarter', bounds: { x: 24, y: 22, width: 6, height: 8 } },
        { id: 'guild_hall', name: 'Adventurers Guild', bounds: { x: 22, y: 27, width: 6, height: 4 } },
        { id: 'east_gate', name: 'Whispering Forest Gate', bounds: { x: 36, y: 18, width: 3, height: 5 } }
      ],
      npcs: [
        { id: 'village_guide', name: 'Village Guide', role: 'guide', at: { c: 18, r: 18 } },
        { id: 'market_merchant', name: 'Market Merchant', role: 'merchant', at: { c: 10, r: 22 } },
        { id: 'village_blacksmith', name: 'Blacksmith', role: 'blacksmith', at: { c: 28, r: 20 } },
        { id: 'guild_receptionist', name: 'Guild Receptionist', role: 'guild', at: { c: 23, r: 26 } },
        { id: 'innkeeper', name: 'Innkeeper', role: 'innkeeper', at: { c: 17, r: 25 } }
      ],
      spawnPoints: [{ id: 'village_gate', at: { c: 38, r: 20 } }],
      warps: [
        { id: 'greenvale_to_forest', at: { c: 38, r: 20 }, targetMapId: 'whispering_forest', targetSpawnId: 'forest_entrance' }
      ],
      spawnZones: [{
        id: 'village_east',
        tiles: [{c:33,r:15},{c:34,r:15},{c:35,r:15},{c:33,r:16},{c:34,r:16},{c:35,r:16},
          {c:34,r:17},{c:35,r:17},{c:36,r:16},{c:36,r:17}]
      }],
      spawnSlots: [{ id: 'poring_001', monsterId: 'poring', zoneId: 'village_east', respawnSeconds: 15, minPlayerDistance: 4 }],
      rareSpawnSlots: []
    };
  }

  var maps = {
    greenvale: buildGreenvaleMap(),
    whispering_forest: {
      id: 'whispering_forest', name: 'Whispering Forest', tileWidth: 64, tileHeight: 32,
      start: { c: 1, r: 1 },
      tiles: [
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
      ],
      legend: { '#': 'blocked_tree_or_cliff', '~': 'water', '=': 'forest_trail', '.': 'forest_floor' },
      npcs: [],
      spawnPoints: [{ id: 'forest_entrance', at: { c: 1, r: 1 } }],
      warps: [
        { id: 'forest_to_greenvale', at: { c: 1, r: 1 }, targetMapId: 'greenvale', targetSpawnId: 'village_gate' }
      ],
      spawnZones: [
        { id: 'forest_wolf_west', tiles: [{c:1,r:2},{c:2,r:2},{c:1,r:3},{c:2,r:3},{c:1,r:4},{c:2,r:4},{c:3,r:4},{c:4,r:4},{c:5,r:4},{c:4,r:5},{c:5,r:5},{c:6,r:5},{c:7,r:5},{c:8,r:5},{c:9,r:5}] },
        { id: 'forest_wolf_deep', tiles: [{c:10,r:10},{c:11,r:10},{c:12,r:10},{c:13,r:10},{c:11,r:11},{c:12,r:12},{c:13,r:12},{c:10,r:13},{c:11,r:13},{c:12,r:13},{c:10,r:14},{c:11,r:14}] }
      ],
      spawnSlots: [
        { id: 'wolf_west_01', monsterId: 'forest_wolf', zoneId: 'forest_wolf_west', respawnSeconds: 45, minPlayerDistance: 3 },
        { id: 'wolf_west_02', monsterId: 'forest_wolf', zoneId: 'forest_wolf_west', respawnSeconds: 55, minPlayerDistance: 3 },
        { id: 'wolf_deep_01', monsterId: 'forest_wolf', zoneId: 'forest_wolf_deep', respawnSeconds: 60, minPlayerDistance: 4 }
      ],
      rareSpawnSlots: [
        { id: 'ancient_wolf_01', monsterId: 'ancient_wolf', zoneId: 'forest_wolf_deep',
          respawnSeconds: 180, chance: 0.08, retryOnMissSeconds: 60, minPlayerDistance: 5 }
      ]
    }
  };

  var api = E.MapData = {
    get: function (id) { return maps[id] ? clone(maps[id]) : null; },
    list: function () {
      return Object.keys(maps).map(function (id) { return { id: id, name: maps[id].name }; });
    },
    validate: validate,
    isWalkable: function (map, c, r) {
      var result = validate(map);
      if (!result.valid || c < 0 || r < 0 || c >= result.width || r >= result.height) return false;
      var tile = map.tiles[r].charAt(c);
      return tile !== '#' && tile !== 'H' && tile !== '~';
    },
    getWalkableTiles: function (map, zoneId) {
      var zone = (map.spawnZones || []).filter(function (item) { return item.id === zoneId; })[0];
      return zone ? zone.tiles.filter(function (point) {
        return api.isWalkable(map, point.c, point.r);
      }).map(clone) : [];
    },
    getWarpAt: function (map, c, r) {
      var warp = (map.warps || []).filter(function (item) {
        return item.at.c === c && item.at.r === r;
      })[0];
      return warp ? clone(warp) : null;
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
