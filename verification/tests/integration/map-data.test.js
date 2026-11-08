'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const MapData = require('../../../js/map-data.js');

test('both overworld maps have valid rectangular grids and safe starts', () => {
  for (const id of ['greenvale', 'whispering_forest']) {
    const map = MapData.get(id);
    const result = MapData.validate(map);
    assert.equal(result.valid, true, id + ': ' + result.errors.join(','));
    assert.equal(MapData.isWalkable(map, map.start.c, map.start.r), true, id + ' start must be walkable');
  }
});


test('Greenvale is expanded into a large connected starter capital while preserving legacy save tiles', () => {
  const map = MapData.get('greenvale');
  const result = MapData.validate(map);
  assert.equal(result.valid, true, result.errors.join(','));
  assert.equal(result.width, 40);
  assert.equal(result.height, 40);
  assert.equal(map.tiles.length, 40);
  assert.ok(map.districts.length >= 7);
  assert.equal(map.safeZone, true);
  assert.equal(MapData.isWalkable(map, 5, 5), true);
  assert.equal(MapData.isWalkable(map, 4, 4), true);
  assert.equal(MapData.isWalkable(map, 38, 20), true);
  assert.equal(map.warps[0].at.c, 38);
  assert.equal(map.warps[0].at.r, 20);
  assert.ok(map.tiles.some(row => row.includes('~')), 'capital should include river and pond');
  assert.ok(map.tiles.some(row => row.includes('H')), 'capital should include building footprints');
});

test('Whispering Forest is a larger open map with distinct exploration zones', () => {
  const map = MapData.get('whispering_forest');
  const result = MapData.validate(map);
  assert.equal(result.width, 16);
  assert.equal(result.height, 16);
  assert.deepEqual(map.spawnZones.map(zone => zone.id), ['forest_wolf_west', 'forest_wolf_deep']);
  assert.ok(map.warps.length >= 1);
  assert.ok(map.tiles.some(row => row.includes('~')), 'forest should contain water features');
});

test('every monster spawn tile is walkable and each zone has a usable tile', () => {
  for (const id of ['greenvale', 'whispering_forest']) {
    const map = MapData.get(id);
    for (const zone of map.spawnZones) {
      const walkable = MapData.getWalkableTiles(map, zone.id);
      assert.ok(walkable.length > 0, id + '/' + zone.id + ' must have walkable spawn tiles');
      for (const point of zone.tiles) {
        assert.equal(MapData.isWalkable(map, point.c, point.r), true, id + '/' + zone.id + ' blocked tile ' + point.c + ',' + point.r);
      }
    }
  }
});

test('map transitions point to declared spawn points on the destination map', () => {
  for (const id of ['greenvale', 'whispering_forest']) {
    const map = MapData.get(id);
    for (const warp of map.warps) {
      const target = MapData.get(warp.targetMapId);
      assert.ok(target, 'target map exists: ' + warp.targetMapId);
      const spawn = target.spawnPoints.find(point => point.id === warp.targetSpawnId);
      assert.ok(spawn, 'target spawn exists: ' + warp.targetSpawnId);
      assert.equal(MapData.isWalkable(target, spawn.at.c, spawn.at.r), true);
      assert.equal(MapData.isWalkable(map, warp.at.c, warp.at.r), true);
    }
  }
});

test('map access returns defensive copies', () => {
  const first = MapData.get('whispering_forest');
  first.tiles[1] = '################';
  assert.notEqual(MapData.get('whispering_forest').tiles[1], first.tiles[1]);
});
