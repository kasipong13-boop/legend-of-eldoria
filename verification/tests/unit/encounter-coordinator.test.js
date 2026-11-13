'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../../../js/encounter-coordinator');
const A=require('../../../js/encounter-adapter');
const R=require('../../../js/encounter-resolver');
const MD=require('../../../js/map-data');
const Spawn=require('../../../js/monster-spawn');
const map=MD.get('whispering_forest');
const tile={c:1,r:1};
function instance(id,p=tile){return {id,spawnId:'slot-'+id,monsterId:'forest_wolf',mapId:map.id,position:{...p}};}
function setup(){
  const trigger=instance('wolf-1');
  const world={mapId:map.id,hero:{x:tile.c,y:tile.r,c:tile.c,r:tile.r},trigger:{instanceId:trigger.id,x:tile.c,y:tile.r,c:tile.c,r:tile.r}};
  const instances=[trigger];
  const boundary=C.createBoundary({readWorld:()=>world,readInstances:()=>instances,mapData:MD,adapter:A,resolver:R});
  return {boundary,world,instances,trigger};
}
test('C01 trusted collision prepares one real MapData instance',()=>{const s=setup();const r=s.boundary.prepare('wolf-1');assert.equal(r.ok,true,r.reason);assert.equal(r.participants[0].instanceId,'wolf-1');});
test('C02 missing trigger rejected',()=>{assert.equal(setup().boundary.prepare('missing').reason,'TRIGGER_NOT_FOUND');});
test('C03 forged collision not accepted as caller argument',()=>{const s=setup();s.world.hero.x=14;s.world.hero.y=14;s.world.hero.c=14;s.world.hero.r=14;assert.equal(s.boundary.prepare('wolf-1').reason,'COLLISION_NOT_VERIFIED');});
test('C04 trigger runtime identity mismatch rejected',()=>{const s=setup();s.world.trigger.instanceId='fake';assert.equal(s.boundary.prepare('wolf-1').reason,'TRIGGER_RUNTIME_MISMATCH');});
test('C05 trigger tile mismatch rejected',()=>{const s=setup();s.world.trigger.c=2;assert.equal(s.boundary.prepare('wolf-1').reason,'TRIGGER_TILE_MISMATCH');});
test('C06 duplicate instance ID rejected',()=>{const s=setup();s.instances.push(instance('wolf-1'));assert.equal(s.boundary.prepare('wolf-1').reason,'INVALID_INSTANCE_IDENTITY');});
test('C07 cross-map instance rejected',()=>{const s=setup();s.instances[0].mapId='greenvale';assert.equal(s.boundary.prepare('wolf-1').reason,'INVALID_INSTANCE_IDENTITY');});
test('C08 blocked monster tile rejected',()=>{const s=setup();s.instances[0].position={c:0,r:0};assert.equal(s.boundary.prepare('wolf-1').reason,'INSTANCE_TILE_BLOCKED');});
test('C09 engaged instance rejected',()=>{const s=setup();s.instances[0].engaged=true;assert.equal(s.boundary.prepare('wolf-1').reason,'INSTANCE_NOT_AVAILABLE');});
test('C10 invalid instance rejected',()=>{const s=setup();s.instances.push(null);assert.equal(s.boundary.prepare('wolf-1').reason,'INVALID_INSTANCE_IDENTITY');});
test('C11 returned participants are detached',()=>{const s=setup();const r=s.boundary.prepare('wolf-1');assert.equal(r.ok,true,r.reason);assert.throws(()=>{r.participants[0].instanceId='fake';},TypeError);assert.equal(s.instances[0].id,'wolf-1');});
test('C12 browser namespace uses ELDORIA',()=>{const fs=require('node:fs');const vm=require('node:vm');const source=fs.readFileSync(require.resolve('../../../js/encounter-coordinator'),'utf8');const context={window:{}};vm.runInNewContext(source,context);assert.equal(typeof context.window.ELDORIA.EncounterCoordinator.createBoundary,'function');});
test('C13 prepare does not mutate source instances',()=>{const s=setup();const before=JSON.stringify(s.instances);s.boundary.prepare('wolf-1');assert.equal(JSON.stringify(s.instances),before);});
test('C14 real MonsterSpawn instances can be used as authority',()=>{const manager=Spawn.createManager({map,mapData:MD,random:()=>0.2,now:()=>1000,config:{minPlayerDistance:0}});manager.initialize({c:1,r:1});const live=manager.getInstances();assert.ok(live.length>0);const first=live[0];const w={mapId:map.id,hero:{x:first.position.c,y:first.position.r,...first.position},trigger:{instanceId:first.id,x:first.position.c,y:first.position.r,...first.position}};const boundary=C.createBoundary({readWorld:()=>w,readInstances:()=>manager.getInstances(),mapData:MD,adapter:A,resolver:R});const result=boundary.prepare(first.id);assert.equal(result.ok,true,result.reason);assert.equal(result.participants[0].instanceId,first.id);});
