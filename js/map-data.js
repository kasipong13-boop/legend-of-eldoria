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

  var maps = {
    greenvale: {
      id: 'greenvale', name: 'Greenvale Village', tileWidth: 64, tileHeight: 32,
      start: { c: 5, r: 5 },
      tiles: [
        '############', '#....#.....#', '#.HH.=.....#', '#.HH.=..~~.#',
        '#....=..~~.#', '#=====.....#', '#....=.....#', '#.H..=..#..#',
        '#....=.....#', '#.......#..#', '#..........#', '############'
      ],
      legend: { '#': 'blocked', H: 'building', '~': 'water', '=': 'path', '.': 'grass' },
      npcs: [],
      spawnPoints: [{ id: 'village_gate', at: { c: 10, r: 9 } }],
      warps: [
        { id: 'greenvale_to_forest', at: { c: 10, r: 9 }, targetMapId: 'whispering_forest', targetSpawnId: 'forest_entrance' }
      ],
      spawnZones: [{
        id: 'village_east',
        tiles: [{c:8,r:1},{c:9,r:1},{c:10,r:1},{c:9,r:2},{c:10,r:2},{c:10,r:3},{c:10,r:4},
          {c:9,r:5},{c:10,r:5},{c:10,r:6},{c:10,r:7},{c:10,r:8},{c:10,r:9},{c:9,r:10},{c:10,r:10}]
      }],
      spawnSlots: [{ id: 'poring_001', monsterId: 'poring', zoneId: 'village_east', respawnSeconds: 15, minPlayerDistance: 4 }],
      rareSpawnSlots: []
    },
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
