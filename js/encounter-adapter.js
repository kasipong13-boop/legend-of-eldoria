/* DGE-04A.3: read-only adapters; no runtime integration or save writes. */
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root){root.ELDORIA=root.ELDORIA||{};root.ELDORIA.EncounterAdapter=api;}
})(typeof window!=='undefined'?window:(typeof globalThis!=='undefined'?globalThis:null),function(){
'use strict';
function tile(p){return p&&Number.isInteger(p.c)&&Number.isInteger(p.r);}
function createMapAdapter(mapData,map){
  if(!mapData||typeof mapData.isWalkable!=='function'||!map||typeof map.id!=='string'||!map.id)throw new Error('INVALID_MAP_ADAPTER');
  return {id:map.id,isWalkable:function(c,r){return Number.isInteger(c)&&Number.isInteger(r)&&mapData.isWalkable(map,c,r)===true;}};
}
function toEncounterMonster(instance,state,position){
  if(!instance||typeof instance.id!=='string'||!instance.id||typeof instance.spawnId!=='string'||!instance.spawnId||typeof instance.monsterId!=='string'||!instance.monsterId||typeof instance.mapId!=='string'||!instance.mapId||!state||typeof state.alive!=='boolean'||typeof state.engaged!=='boolean')throw new Error('INVALID_INSTANCE_ADAPTER');
  var p=position===undefined?instance.position:position;
  if(!tile(p))throw new Error('INVALID_MONSTER_TILE');
  return {instanceId:instance.id,spawnId:instance.spawnId,monsterId:instance.monsterId,mapId:instance.mapId,position:{c:p.c,r:p.r},alive:state.alive,engaged:state.engaged};
}
function toLogicalTile(runtime,walkable){
  if(!runtime||!Number.isFinite(runtime.x)||!Number.isFinite(runtime.y)||typeof walkable!=='function')throw new Error('INVALID_RUNTIME_POSITION');
  var c=Math.round(runtime.x),r=Math.round(runtime.y);
  if(!walkable(c,r))throw new Error('RUNTIME_TILE_BLOCKED');
  return {c:c,r:r};
}
function createCollisionSnapshot(options){
  if(!options||!options.hero||!options.trigger||!options.map||typeof options.map.isWalkable!=='function'||typeof options.triggerInstanceId!=='string'||!options.triggerInstanceId)throw new Error('INVALID_COLLISION_SNAPSHOT');
  var hero=options.hero,trigger=options.trigger;
  if(!Number.isFinite(hero.x)||!Number.isFinite(hero.y)||!Number.isFinite(trigger.x)||!Number.isFinite(trigger.y))throw new Error('INVALID_RUNTIME_POSITION');
  var dx=hero.x-trigger.x,dy=hero.y-trigger.y;
  if(!(Math.hypot(dx,dy)<1.15))throw new Error('COLLISION_NOT_CONFIRMED');
  var walk=options.map.isWalkable;
  var playerPosition=toLogicalTile(hero,walk),triggerPosition=toLogicalTile(trigger,walk);
  return {playerPosition:playerPosition,triggerPosition:triggerPosition,triggerInstanceId:options.triggerInstanceId,triggerCollisionConfirmed:true};
}
return {createMapAdapter:createMapAdapter,toEncounterMonster:toEncounterMonster,toLogicalTile:toLogicalTile,createCollisionSnapshot:createCollisionSnapshot};
});
