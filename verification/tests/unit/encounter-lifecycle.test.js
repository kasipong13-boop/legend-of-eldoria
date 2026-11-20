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

test('L16 blocked partial release retries only still-held instances',()=>{
 let fail=true;const held=new Set(),calls=[];
 const life=L.createLifecycle({reserve:id=>{held.add(id);return true;},release:id=>{calls.push(id);if(id==='a'&&fail)return false;held.delete(id);return true;}});
 const input={encounterId:'e',characterId:'c',mapId:'m',participants:[{instanceId:'a'},{instanceId:'b'}]};
 const r=life.acquire(input);life.start(r.token,()=>true);life.settle(r.token);
 assert.equal(life.complete(r.token,true).reason,'RELEASE_INCOMPLETE');
 assert.equal(life.snapshot().pendingRelease,1);assert.deepEqual([...held],['a']);
 fail=false;assert.equal(life.retryRelease(r.token).ok,true);
 assert.deepEqual(calls,['b','a','a']);assert.equal(life.snapshot().state,'IDLE');
});
test('L17 retry release on wrong token and wrong state rejected',()=>{
 const f=fixture();const r=f.life.acquire(f.input);
 assert.equal(f.life.retryRelease(r.token).reason,'INVALID_STATE');
 assert.equal(f.life.retryRelease(r.token+1).reason,'STALE_TOKEN');
});
test('L18 acquire reentrancy blocked inside reserve callback',()=>{
 let lifecycle,inner;const held=new Set();
 const input={encounterId:'e',characterId:'c',mapId:'m',participants:[{instanceId:'a'}]};
 lifecycle=L.createLifecycle({reserve:id=>{inner=lifecycle.acquire(input);held.add(id);return true;},release:id=>{held.delete(id);return true;}});
 assert.equal(lifecycle.acquire(input).ok,true);assert.equal(inner.reason,'ENCOUNTER_BUSY');assert.equal(held.size,1);
});
test('L19 start reentrancy blocked inside battle callback',()=>{
 const f=fixture();const r=f.life.acquire(f.input);let inner;
 assert.equal(f.life.start(r.token,()=>{inner=f.life.rollback(r.token);return true;}).ok,true);
 assert.equal(inner.reason,'INVALID_STATE');assert.equal(f.life.snapshot().state,'IN_BATTLE');
});
test('L20 release reentrancy cannot trigger another encounter',()=>{
 let lifecycle,inner;const held=new Set();
 const input={encounterId:'e',characterId:'c',mapId:'m',participants:[{instanceId:'a'}]};
 lifecycle=L.createLifecycle({reserve:id=>{held.add(id);return true;},release:id=>{inner=lifecycle.acquire(input);held.delete(id);return true;}});
 const r=lifecycle.acquire(input);assert.equal(lifecycle.rollback(r.token).ok,true);
 assert.equal(inner.reason,'ENCOUNTER_BUSY');assert.equal(lifecycle.snapshot().state,'IDLE');
});
test('L21 blocked rollback can be recovered without repeating successful release',()=>{
 let fail=true;const held=new Set(),calls=[];
 const lifecycle=L.createLifecycle({reserve:id=>{if(id==='b')return false;held.add(id);return true;},release:id=>{calls.push(id);if(fail)return false;held.delete(id);return true;}});
 const input={encounterId:'e',characterId:'c',mapId:'m',participants:[{instanceId:'a'},{instanceId:'b'}]};
 assert.equal(lifecycle.acquire(input).reason,'ROLLBACK_INCOMPLETE');
 assert.equal(lifecycle.snapshot().pendingRelease,1);
 const token=lifecycle.snapshot().generation;fail=false;
 assert.equal(lifecycle.retryRelease(token).ok,true);assert.deepEqual(calls,['a','a']);assert.equal(held.size,0);
});
