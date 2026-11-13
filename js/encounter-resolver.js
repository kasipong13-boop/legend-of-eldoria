/* DGE-04A: pure encounter selection; no world, battle, or save mutations. */
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  if(root){root.ELDORIA=root.ELDORIA||{};root.ELDORIA.EncounterResolver=api;}
})(typeof window!=='undefined'?window:(typeof globalThis!=='undefined'?globalThis:null),function(){
'use strict';
var DIRS=[[0,-1],[-1,0],[1,0],[0,1]];
function validPos(p){return p&&Number.isInteger(p.c)&&Number.isInteger(p.r);}
function key(c,r){return c+','+r;}
function fail(reason){return {ok:false,reason:reason};}
function resolveEncounter(input){
  if(!input||!input.map||typeof input.map.isWalkable!=='function'||typeof input.map.id!=='string'||!input.map.id||!validPos(input.playerPosition)||!Array.isArray(input.monsters)||typeof input.triggerInstanceId!=='string'||!input.triggerInstanceId)return fail('INVALID_INPUT');
  var limit=input.maxDistance===undefined?3:input.maxDistance;
  var cap=input.maxEnemies===undefined?5:input.maxEnemies;
  if(!Number.isInteger(limit)||limit<0||limit>3||!Number.isInteger(cap)||cap<1||cap>5)return fail('INVALID_LIMITS');
  var map=input.map,p=input.playerPosition;
  if(!map.isWalkable(p.c,p.r))return fail('PLAYER_NOT_WALKABLE');
  var ids=new Set(),eligible=[];
  for(var i=0;i<input.monsters.length;i++){
    var m=input.monsters[i];
    if(!m||typeof m.instanceId!=='string'||!m.instanceId||typeof m.monsterId!=='string'||!m.monsterId||typeof m.spawnId!=='string'||!m.spawnId||typeof m.mapId!=='string'||!validPos(m.position))return fail('INVALID_MONSTER');
    if(ids.has(m.instanceId))return fail('DUPLICATE_INSTANCE_ID');
    ids.add(m.instanceId);
    if(m.mapId===map.id&&m.alive===true&&m.engaged!==true)eligible.push(m);
  }
  var trigger=eligible.find(function(m){return m.instanceId===input.triggerInstanceId;});
  if(!trigger)return fail('TRIGGER_NOT_ELIGIBLE');
  if(!map.isWalkable(trigger.position.c,trigger.position.r))return fail('TRIGGER_NOT_WALKABLE');
  if(input.triggerCollisionConfirmed!==undefined)return fail('UNTRUSTED_COLLISION_CONFIRMATION');
  var delta=Math.abs(trigger.position.c-p.c)+Math.abs(trigger.position.r-p.r);
  if(input.collisionEvidence!==undefined){
    var e=input.collisionEvidence;
    if(!e||!e.hero||!e.trigger||e.triggerInstanceId!==input.triggerInstanceId||
       !Number.isFinite(e.hero.x)||!Number.isFinite(e.hero.y)||
       !Number.isFinite(e.trigger.x)||!Number.isFinite(e.trigger.y)||
       !validPos(e.hero)||!validPos(e.trigger)||
       e.hero.c!==p.c||e.hero.r!==p.r||
       e.trigger.c!==trigger.position.c||e.trigger.r!==trigger.position.r||
       !(Math.hypot(e.hero.x-e.trigger.x,e.hero.y-e.trigger.y)<1.15))
       return fail('INVALID_COLLISION_EVIDENCE');
  }
  if(delta>1&&input.collisionEvidence===undefined)return fail('TRIGGER_NOT_ADJACENT');
  var seen=new Map([[key(p.c,p.r),0]]),queue=[{c:p.c,r:p.r,d:0}];
  for(var q=0;q<queue.length;q++){
    var at=queue[q];if(at.d>=limit)continue;
    for(var z=0;z<DIRS.length;z++){
      var nc=at.c+DIRS[z][0],nr=at.r+DIRS[z][1],k=key(nc,nr);
      if(seen.has(k)||!map.isWalkable(nc,nr))continue;
      seen.set(k,at.d+1);queue.push({c:nc,r:nr,d:at.d+1});
    }
  }
  var candidates=[];
  for(var j=0;j<eligible.length;j++){
    var monster=eligible[j],d=seen.get(key(monster.position.c,monster.position.r));
    if(d===undefined&&monster.instanceId!==trigger.instanceId)continue;
    candidates.push({instanceId:monster.instanceId,monsterId:monster.monsterId,spawnId:monster.spawnId,pathDistance:d===undefined?delta:d,isTrigger:monster.instanceId===trigger.instanceId});
  }
  candidates.sort(function(a,b){
    if(a.isTrigger!==b.isTrigger)return a.isTrigger?-1:1;
    if(a.pathDistance!==b.pathDistance)return a.pathDistance-b.pathDistance;
    return a.instanceId<b.instanceId?-1:a.instanceId>b.instanceId?1:0;
  });
  return {ok:true,mapId:map.id,triggerInstanceId:trigger.instanceId,participants:candidates.slice(0,cap)};
}
return {resolveEncounter:resolveEncounter};
});
