/* Exact-commit WF41 graph verification. Run: node verification/surface-navigation-wf41.test.js */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const fixturePath=path.join(__dirname,'fixtures','wf41-surface-graph.json');
const fixture=JSON.parse(fs.readFileSync(fixturePath,'utf8'));
const route=require('../js/surface-route-audit-experimental.js');
const adapter=require('../js/surface-navigation-experimental.js');
const nav=route.create(fixture);
let pass=0,fail=0;
function check(label,fn){try{fn();pass++;console.log('PASS '+label);}catch(e){fail++;console.error('FAIL '+label+': '+e.message);}}
check('337 nodes',()=>assert.equal(nav.nodeCount,337));
check('416 edges',()=>assert.equal(nav.edgeCount,416));
check('326 spawn exclusions',()=>assert.equal(nav.excludedCount,326));
check('all edges valid',()=>assert.ok(fixture.edges.every(e=>nav.validEdge(e))));
const loop=nav.orderedLoop();
check('ordered loop exists',()=>assert.ok(loop));
check('ordered loop 214 edges',()=>assert.equal(loop&&loop.length,214));
check('ordered portals P05 P06 P07 P03 P02 P01',()=>assert.deepEqual(loop&&loop.filter(e=>e.portal).map(e=>e.portal),route.ORDER));
for(const p of route.ORDER){
 const indices=fixture.edges.map((e,i)=>nav.edgePortal(e)===p?i:-1).filter(i=>i>=0);
 check('portal '+p+' present',()=>assert.ok(indices.length>0));
 check('portal '+p+' cut detected',()=>assert.equal(nav.orderedLoop(indices),null));
}
for(const r of ['R01','R02','R03','R04'])check('ramp '+r+' present',()=>assert.ok(fixture.nodes.some(n=>n.surfaceId===r)));
check('ramp node count 91',()=>assert.equal(fixture.nodes.filter(n=>['R01','R02','R03','R04'].includes(n.surfaceId)).length,91));
check('bridge node count 27',()=>assert.equal(fixture.nodes.filter(n=>n.surfaceId==='BRIDGE-H1').length,27));
const under=fixture.nodes.filter(n=>n.surfaceId==='UNDERPASS-H0');
check('underpass node count 11',()=>assert.equal(under.length,11));
check('underpass unmasked',()=>assert.ok(under.every(n=>nav.spawnAllowed(n.id))));
check('unknown spawn fail-closed',()=>assert.equal(nav.spawnAllowed('UNKNOWN'),false));
check('cross-surface WALK rejected',()=>assert.equal(nav.validEdge({a:fixture.nodes[0].id,b:under[0].id,type:'WALK'}),false));
check('feature flag default OFF',()=>assert.equal(adapter.DEFAULT_ENABLED,false));
const a=adapter.createAdapter(fixture);
check('feature flag OFF delegates',()=>assert.equal(a.navigate(fixture.nodes[0].id,fixture.nodes[0].id).mode,'LEGACY_DELEGATE'));
check('no Save APIs in adapters',()=>assert.ok(!('save' in nav)&&!('load' in nav)&&!('save' in a)&&!('load' in a)));
check('no storage writes in experimental source',()=>{for(const p of ['surface-route-audit-experimental.js','surface-navigation-experimental.js']){const s=fs.readFileSync(path.join(__dirname,'..','js',p),'utf8');assert.ok(!/localStorage|sessionStorage|indexedDB|\.setItem\s*\(/.test(s));}});
console.log('SUMMARY '+JSON.stringify({pass,fail}));if(fail)process.exitCode=1;
