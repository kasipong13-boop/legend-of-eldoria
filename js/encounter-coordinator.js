/* DGE-04B.4 Phase I: read-only trusted encounter boundary; not wired into runtime. */
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root){root.ELDORIA=root.ELDORIA||{};root.ELDORIA.EncounterCoordinator=api;}
})(typeof window!=='undefined'?window:(typeof globalThis!=='undefined'?globalThis:null),function(){
'use strict';
function reject(reason){return {ok:false,reason:reason};}
function point(p){return p&&Number.isInteger(p.c)&&Number.isInteger(p.r);}
function runtime(p){return p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&point(p);}
function id(s){return typeof s==='string'&&s.length>0;}
function createBoundary(deps){
  if(!deps||typeof deps.readWorld!=='function'||typeof deps.readInstances!=='function'||!deps.mapData||typeof deps.mapData.get!=='function'||typeof deps.mapData.isWalkable!=='function'||!deps.adapter||typeof deps.adapter.createMapAdapter!=='function'||typeof deps.adapter.createCollisionSnapshot!=='function'||typeof deps.adapter.toEncounterMonster!=='function'||!deps.resolver||typeof deps.resolver.resolveEncounter!=='function')throw new Error('INVALID_BOUNDARY_DEPENDENCIES');
  function prepare(triggerInstanceId){
    if(!id(triggerInstanceId))return reject('INVALID_TRIGGER_ID');
    var world,instances;
    try{world=deps.readWorld();instances=deps.readInstances();}catch(_){return reject('TRUSTED_SOURCE_UNAVAILABLE');}
    if(!world||!id(world.mapId)||!runtime(world.hero)||!Array.isArray(instances))return reject('INVALID_TRUSTED_WORLD');
    var map=deps.mapData.get(world.mapId);
    if(!map||map.id!==world.mapId)return reject('MAP_NOT_FOUND');
    var mapAdapter;
    try{mapAdapter=deps.adapter.createMapAdapter(deps.mapData,map);}catch(_){return reject('INVALID_MAP');}
    var seen=new Set(),trigger=null,monsters=[];
    for(var i=0;i<instances.length;i++){
      var item=instances[i];
      if(!item||!id(item.id)||seen.has(item.id))return reject('INVALID_INSTANCE_IDENTITY');
      seen.add(item.id);
      if(!id(item.spawnId)||!id(item.monsterId)||!id(item.mapId)||!point(item.position)||item.mapId!==world.mapId)return reject('INVALID_INSTANCE_IDENTITY');
      // Phase I does not introduce a lifecycle lock. Source must supply live instances.
      if(item.alive===false||item.engaged===true)return reject('INSTANCE_NOT_AVAILABLE');
      if(!mapAdapter.isWalkable(item.position.c,item.position.r))return reject('INSTANCE_TILE_BLOCKED');
      if(item.id===triggerInstanceId)trigger=item;
      try{monsters.push(deps.adapter.toEncounterMonster(item,{alive:true,engaged:false}));}catch(_){return reject('INVALID_INSTANCE_IDENTITY');}
    }
    if(!trigger)return reject('TRIGGER_NOT_FOUND');
    // Runtime positions come from a trusted provider, not from the prepare caller.
    if(!world.trigger||world.trigger.instanceId!==triggerInstanceId||!runtime(world.trigger))return reject('TRIGGER_RUNTIME_MISMATCH');
    if(world.trigger.c!==trigger.position.c||world.trigger.r!==trigger.position.r)return reject('TRIGGER_TILE_MISMATCH');
    var snapshot;
    try{snapshot=deps.adapter.createCollisionSnapshot({hero:world.hero,trigger:world.trigger,map:mapAdapter,triggerInstanceId:triggerInstanceId});}
    catch(_){return reject('COLLISION_NOT_VERIFIED');}
    var result;
    try{result=deps.resolver.resolveEncounter({map:mapAdapter,playerPosition:snapshot.playerPosition,monsters:monsters,triggerInstanceId:triggerInstanceId,collisionEvidence:snapshot.collisionEvidence});}
    catch(_){return reject('RESOLVER_FAILURE');}
    if(!result||result.ok!==true)return reject(result&&result.reason||'RESOLVER_FAILURE');
    return {ok:true,mapId:result.mapId,triggerInstanceId:result.triggerInstanceId,participants:result.participants.map(function(p){return Object.freeze({instanceId:p.instanceId,spawnId:p.spawnId,monsterId:p.monsterId,pathDistance:p.pathDistance,isTrigger:p.isTrigger});})};
  }
  return Object.freeze({prepare:prepare});
}
return Object.freeze({createBoundary:createBoundary});
});
