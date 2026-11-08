'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const MapData = require('../../../../js/map-data.js');
const MonsterSpawn = require('../../../../js/monster-spawn.js');
function fixture(){
  let clock=100000, seed=0;
  const map=MapData.get('greenvale');
  map.spawnSlots=[
    {id:'wolf-a',monsterId:'forest_wolf',zoneId:'village_east',respawnSeconds:30,minPlayerDistance:2},
    {id:'wolf-b',monsterId:'forest_wolf',zoneId:'village_east',respawnSeconds:45,minPlayerDistance:2}
  ];
  map.rareSpawnSlots=[{id:'rare-a',monsterId:'ancient_wolf',zoneId:'village_east',respawnSeconds:60,chance:1,retryOnMissSeconds:20,minPlayerDistance:2}];
  const manager=MonsterSpawn.createManager({map,now:()=>clock,random:()=>((seed++%97)+1)/100,mapData:MapData,config:{maxPositionAttempts:30}});
  return {manager,map,setTime:v=>clock=v};
}
test('map definitions validate and reject blocked terrain',()=>{
 const map=MapData.get('greenvale');
 assert.equal(MapData.validate(map).valid,true);
 assert.equal(MapData.isWalkable(map,2,2),false);
 assert.equal(MapData.isWalkable(map,5,5),true);
});
test('each spawn slot owns an independent realtime respawn deadline',()=>{
 const f=fixture(), spawned=f.manager.initialize({c:5,r:5});
 assert.equal(spawned.length,3);
 const a=spawned.find(x=>x.spawnId==='wolf-a'),b=spawned.find(x=>x.spawnId==='wolf-b');
 f.manager.defeat(a.id,100000);f.manager.defeat(b.id,110000);
 f.setTime(130000);
 const at30=f.manager.tick({c:5,r:5});
 assert.equal(at30.length,1);assert.equal(at30[0].spawnId,'wolf-a');
 f.setTime(155000);
 const at55=f.manager.tick({c:5,r:5});
 assert.equal(at55.length,1);assert.equal(at55[0].spawnId,'wolf-b');
});
test('spawn positions are walkable, unoccupied, and outside player distance',()=>{
 const f=fixture(), active=f.manager.initialize({c:5,r:5});
 const coords=active.map(x=>x.position.c+','+x.position.r);
 assert.equal(new Set(coords).size,coords.length);
 active.forEach(x=>{assert.equal(MapData.isWalkable(f.map,x.position.c,x.position.r),true);assert.ok(Math.hypot(x.position.c-5,x.position.r-5)>=2);});
});
test('offline timestamp is preserved and expired slot becomes eligible on return',()=>{
 const f=fixture(), x=f.manager.initialize({c:5,r:5})[0];
 f.manager.defeat(x.id,100000);
 const saved=f.manager.snapshot();
 const f2=fixture();f2.setTime(140000);f2.manager.restore(saved);
 const returned=f2.manager.tick({c:5,r:5});
 assert.equal(returned.length,1);
});
test('rare monsters use dedicated slots and do not consume normal quota',()=>{
 const f=fixture(), x=f.manager.initialize({c:5,r:5});
 assert.equal(x.length,3);
 assert.equal(x.filter(m=>m.rare).length,1);
 assert.equal(f.manager.getStatus().total,3);
});
test('defeated slot cannot award by spawning and cannot exceed one live instance',()=>{
 const f=fixture(), x=f.manager.initialize({c:5,r:5})[0];
 assert.equal(f.manager.defeat(x.id,100000).ok,true);
 assert.equal(f.manager.defeat(x.id,100000).ok,false);
 f.setTime(200000);f.manager.tick({c:5,r:5});
 assert.equal(f.manager.getInstances().filter(m=>m.spawnId===x.spawnId).length,1);
});
