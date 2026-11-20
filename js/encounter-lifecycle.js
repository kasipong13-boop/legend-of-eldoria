/* DGE-04B.6: isolated in-memory lifecycle; no world/battle/save mutations. */
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
  function snapshot(){return Object.freeze({state:state,encounterId:active?active.encounterId:null,generation:generation});}
  function acquire(input){
    if(state!=='IDLE')return reject('ENCOUNTER_BUSY');
    if(!input||!valid(input.encounterId)||!valid(input.characterId)||!valid(input.mapId)||!Array.isArray(input.participants)||input.participants.length<1||input.participants.length>5)return reject('INVALID_ENCOUNTER');
    var ids=input.participants.map(function(p){return p&&p.instanceId;});
    if(ids.some(function(id){return !valid(id);})||new Set(ids).size!==ids.length)return reject('INVALID_PARTICIPANTS');
    var token=++generation,done=[];
    try{
      for(var i=0;i<ids.length;i++){
        if(deps.reserve(ids[i],token)!==true)throw Error('RESERVATION_FAILED');
        done.push(ids[i]);
      }
    }catch(_){
      var failed=false;
      for(var j=done.length-1;j>=0;j--)try{if(deps.release(done[j],token)!==true)failed=true;}catch(_){failed=true;}
      if(failed){state='BLOCKED';active={encounterId:input.encounterId,token:token,ids:ids.slice()};return reject('ROLLBACK_INCOMPLETE');}
      return reject('RESERVATION_FAILED');
    }
    active={encounterId:input.encounterId,token:token,ids:ids.slice(),characterId:input.characterId,mapId:input.mapId};
    state='RESERVED';return {ok:true,token:token,encounterId:active.encounterId};
  }
  function matches(token){return active&&active.token===token;}
  function start(token,startBattle){
    if(!matches(token))return reject('STALE_TOKEN');
    if(state!=='RESERVED')return reject('INVALID_STATE');
    if(typeof startBattle!=='function')return reject('INVALID_START');
    try{if(startBattle()!==true)return rollback(token);}catch(_){return rollback(token);}
    state='IN_BATTLE';return {ok:true};
  }
  function rollback(token){
    if(!matches(token))return reject('STALE_TOKEN');
    if(state!=='RESERVED')return reject('INVALID_STATE');
    return releaseAll(token,'BATTLE_START_FAILED');
  }
  function settle(token){
    if(!matches(token))return reject('STALE_TOKEN');
    if(state!=='IN_BATTLE')return reject('INVALID_STATE');
    state='SETTLING';return {ok:true};
  }
  function releaseAll(token,reason){
    if(!matches(token))return reject('STALE_TOKEN');
    if(state!=='RESERVED'&&state!=='SETTLING'&&state!=='BLOCKED')return reject('INVALID_STATE');
    var failed=false;
    for(var i=active.ids.length-1;i>=0;i--)try{if(deps.release(active.ids[i],token)!==true)failed=true;}catch(_){failed=true;}
    if(failed){state='BLOCKED';return reject('RELEASE_INCOMPLETE');}
    active=null;state='IDLE';return {ok:true,reason:reason||'RELEASED'};
  }
  function complete(token,settlementConfirmed){
    if(!matches(token))return reject('STALE_TOKEN');
    if(state!=='SETTLING')return reject('INVALID_STATE');
    if(settlementConfirmed!==true)return reject('SETTLEMENT_NOT_CONFIRMED');
    return releaseAll(token,'SETTLED');
  }
  return Object.freeze({acquire:acquire,start:start,rollback:rollback,settle:settle,complete:complete,snapshot:snapshot});
}
return Object.freeze({createLifecycle:createLifecycle});
});
