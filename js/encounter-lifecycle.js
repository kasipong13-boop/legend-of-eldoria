/* DGE-04B.8: isolated, fail-closed in-memory lifecycle. No runtime or save writes. */
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root){root.ELDORIA=root.ELDORIA||{};root.ELDORIA.EncounterLifecycle=api;}
})(typeof window!=='undefined'?window:(typeof globalThis!=='undefined'?globalThis:null),function(){
'use strict';
function reject(reason){return {ok:false,reason:reason};}
function valid(s){return typeof s==='string'&&s.length>0;}
function createLifecycle(deps){
  if(!deps||typeof deps.reserve!=='function'||typeof deps.release!=='function')throw Error('INVALID_DEPENDENCIES');
  var state='IDLE',active=null,generation=0;
  function snapshot(){return Object.freeze({state:state,encounterId:active?active.encounterId:null,generation:generation,pendingRelease:active?active.held.slice().length:0});}
  function matches(token){return active&&active.token===token;}
  function releaseHeld(token,reason){
    if(!matches(token))return reject('STALE_TOKEN');
    if(state!=='RESERVED'&&state!=='SETTLING'&&state!=='BLOCKED')return reject('INVALID_STATE');
    state='RELEASING';
    var remaining=[];
    for(var i=active.held.length-1;i>=0;i--){
      var id=active.held[i],ok=false;
      try{ok=deps.release(id,token)===true;}catch(_){}
      if(!ok)remaining.unshift(id);
    }
    active.held=remaining;
    if(remaining.length){state='BLOCKED';return reject('RELEASE_INCOMPLETE');}
    active=null;state='IDLE';return {ok:true,reason:reason||'RELEASED'};
  }
  function acquire(input){
    if(state!=='IDLE')return reject('ENCOUNTER_BUSY');
    if(!input||!valid(input.encounterId)||!valid(input.characterId)||!valid(input.mapId)||!Array.isArray(input.participants)||input.participants.length<1||input.participants.length>5)return reject('INVALID_ENCOUNTER');
    var ids=input.participants.map(function(p){return p&&p.instanceId;});
    if(ids.some(function(id){return !valid(id);})||new Set(ids).size!==ids.length)return reject('INVALID_PARTICIPANTS');
    var token=++generation;
    active={encounterId:input.encounterId,token:token,held:[],characterId:input.characterId,mapId:input.mapId};
    state='ACQUIRING';
    for(var i=0;i<ids.length;i++){
      var ok=false;
      try{ok=deps.reserve(ids[i],token)===true;}catch(_){}
      if(!ok){state='RESERVED';var rolled=releaseHeld(token,'RESERVATION_FAILED');return rolled.ok?reject('RESERVATION_FAILED'):reject('ROLLBACK_INCOMPLETE');}
      active.held.push(ids[i]);
    }
    state='RESERVED';return {ok:true,token:token,encounterId:active.encounterId};
  }
  function rollback(token){
    if(!matches(token))return reject('STALE_TOKEN');
    if(state!=='RESERVED')return reject('INVALID_STATE');
    return releaseHeld(token,'BATTLE_START_FAILED');
  }
  function start(token,startBattle){
    if(!matches(token))return reject('STALE_TOKEN');
    if(state!=='RESERVED')return reject('INVALID_STATE');
    if(typeof startBattle!=='function')return reject('INVALID_START');
    state='STARTING';
    var ok=false;
    try{ok=startBattle()===true;}catch(_){}
    if(!ok){state='RESERVED';return rollback(token);}
    state='IN_BATTLE';return {ok:true};
  }
  function settle(token){
    if(!matches(token))return reject('STALE_TOKEN');
    if(state!=='IN_BATTLE')return reject('INVALID_STATE');
    state='SETTLING';return {ok:true};
  }
  function complete(token,settlementConfirmed){
    if(!matches(token))return reject('STALE_TOKEN');
    if(state!=='SETTLING')return reject('INVALID_STATE');
    if(settlementConfirmed!==true)return reject('SETTLEMENT_NOT_CONFIRMED');
    return releaseHeld(token,'SETTLED');
  }
  function retryRelease(token){
    if(!matches(token))return reject('STALE_TOKEN');
    if(state!=='BLOCKED')return reject('INVALID_STATE');
    return releaseHeld(token,'RECOVERED');
  }
  return Object.freeze({acquire:acquire,start:start,rollback:rollback,settle:settle,complete:complete,retryRelease:retryRelease,snapshot:snapshot});
}
return Object.freeze({createLifecycle:createLifecycle});
});
