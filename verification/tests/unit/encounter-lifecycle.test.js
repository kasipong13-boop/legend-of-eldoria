'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const L=require('../../../js/encounter-lifecycle');
function fixture(options={}){
 const held=new Set(),events=[];
 const life=L.createLifecycle({
  reserve(id){events.push('reserve:'+id);if(options.failReserve===id)return false;if(held.has(id))return false;held.add(id);return true;},
  release(id){events.push('release:'+id);if(options.failRelease===id)return false;held.delete(id);return true;}
 });
 const input={encounterId:'e1',characterId:'c1',mapId:'whispering_forest',participants:[{instanceId:'a'},{instanceId:'b'}]};
 return {life,held,events,input};
}
test('L01 acquire reserves all and reports RESERVED',()=>{const f=fixture();const r=f.life.acquire(f.input);assert.equal(r.ok,true);assert.equal(f.life.snapshot().state,'RESERVED');assert.equal(f.held.size,2);});
test('L02 duplicate trigger rejected',()=>{const f=fixture();f.life.acquire(f.input);assert.equal(f.life.acquire(f.input).reason,'ENCOUNTER_BUSY');});
test('L03 acquire while in battle rejected',()=>{const f=fixture();const r=f.life.acquire(f.input);f.life.start(r.token,()=>true);assert.equal(f.life.acquire(f.input).reason,'ENCOUNTER_BUSY');});
test('L04 group cap enforced',()=>{const f=fixture();f.input.participants=Array.from({length:6},(_,i)=>({instanceId:String(i)}));assert.equal(f.life.acquire(f.input).reason,'INVALID_ENCOUNTER');});
test('L05 partial reserve failure rolls back',()=>{const f=fixture({failReserve:'b'});assert.equal(f.life.acquire(f.input).reason,'RESERVATION_FAILED');assert.equal(f.held.size,0);assert.equal(f.life.snapshot().state,'IDLE');});
test('L06 battle start failure rolls back',()=>{const f=fixture();const r=f.life.acquire(f.input);assert.equal(f.life.start(r.token,()=>false).reason,'BATTLE_START_FAILED');assert.equal(f.held.size,0);});
test('L07 stale callback cannot release next encounter',()=>{const f=fixture();const a=f.life.acquire(f.input);f.life.rollback(a.token);const b=f.life.acquire(f.input);assert.equal(f.life.rollback(a.token).reason,'STALE_TOKEN');assert.equal(f.life.snapshot().generation,b.token);});
test('L08 victory settlement requires confirmation',()=>{const f=fixture();const r=f.life.acquire(f.input);f.life.start(r.token,()=>true);f.life.settle(r.token);assert.equal(f.life.complete(r.token,false).reason,'SETTLEMENT_NOT_CONFIRMED');assert.equal(f.life.snapshot().state,'SETTLING');assert.equal(f.life.complete(r.token,true).ok,true);});
test('L09 defeat can settle only after external policy confirmation',()=>{const f=fixture();const r=f.life.acquire(f.input);f.life.start(r.token,()=>true);f.life.settle(r.token);assert.equal(f.life.complete(r.token,true).ok,true);});
test('L10 save failure holds lock',()=>{const f=fixture();const r=f.life.acquire(f.input);f.life.start(r.token,()=>true);f.life.settle(r.token);assert.equal(f.life.complete(r.token,false).ok,false);assert.equal(f.held.size,2);});
test('L11 incomplete rollback blocks new encounters',()=>{const f=fixture({failRelease:'a',failReserve:'b'});assert.equal(f.life.acquire(f.input).reason,'ROLLBACK_INCOMPLETE');assert.equal(f.life.snapshot().state,'BLOCKED');assert.equal(f.life.acquire(f.input).reason,'ENCOUNTER_BUSY');});
test('L12 duplicate release cannot alter state',()=>{const f=fixture();const r=f.life.acquire(f.input);assert.equal(f.life.rollback(r.token).ok,true);assert.equal(f.life.rollback(r.token).reason,'STALE_TOKEN');});
test('L13 pure module has no Save Engine dependency',()=>{const fs=require('node:fs');const s=fs.readFileSync(require.resolve('../../../js/encounter-lifecycle'),'utf8');assert.doesNotMatch(s,/require\(['"]\.\/save|localStorage|\.commit\(/);});
test('L14 existing single-enemy contract accepted',()=>{const f=fixture();f.input.participants=[{instanceId:'a'}];assert.equal(f.life.acquire(f.input).ok,true);});
test('L15 duplicate participant IDs fail closed',()=>{const f=fixture();f.input.participants=[{instanceId:'a'},{instanceId:'a'}];assert.equal(f.life.acquire(f.input).reason,'INVALID_PARTICIPANTS');});
