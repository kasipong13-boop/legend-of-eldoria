/* WF41 integration safety; run: node verification/surface-integration-safety.test.js
 * Intentional failing assertions expose incomplete R02/R04 access topology.
 */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const f=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/wf41-surface-graph.json')));
const route=require('../js/surface-route-audit-experimental.js'),adapter=require('../js/surface-navigation-experimental.js');
const nav=route.create(f),nodes=new Map(f.nodes.map(n=>[n.id,n]));
let pass=0,fail=0;
function check(name,fn){try{fn();pass++;console.log('PASS '+name)}catch(e){fail++;console.error('FAIL '+name+': '+e.message)}}
function reach(a,b,blocked=[]){const adj=new Map(f.nodes.map(n=>[n.id,[]])),ban=new Set(blocked);f.edges.forEach((e,i)=>{if(!ban.has(i)&&nav.validEdge(e)){adj.get(e.a).push(e.b);adj.get(e.b).push(e.a)}});const seen=new Set([a]),q=[a];for(let h=0;h<q.length;h++){if(q[h]===b)return true;for(const x of adj.get(q[h])||[])if(!seen.has(x)){seen.add(x);q.push(x)}}return false}
check('graph 337/416/326',()=>{assert.equal(nav.nodeCount,337);assert.equal(nav.edgeCount,416);assert.equal(nav.excludedCount,326)});
check('ordered loop 214',()=>assert.equal(nav.orderedLoop()?.length,214));
check('ordered portal direction',()=>assert.deepEqual(nav.orderedLoop()?.filter(x=>x.portal).map(x=>x.portal),route.ORDER));
for(const p of route.ORDER){const indices=f.edges.map((e,i)=>nav.edgePortal(e)===p?i:-1).filter(i=>i>=0);check('portal '+p+' mutation',()=>{assert.ok(indices.length);assert.equal(nav.orderedLoop(indices),null)})}
for(const r of ['R01','R02','R03','R04']){
 const ns=f.nodes.filter(n=>n.surfaceId===r),access=f.edges.map((e,i)=>e.type==='RAMP_ACCESS'&&(nodes.get(e.a).surfaceId===r||nodes.get(e.b).surfaceId===r)?i:-1).filter(i=>i>=0);
 check(r+' traversal',()=>assert.ok(reach(ns[0].id,ns[ns.length-1].id)));
 check(r+' access',()=>assert.ok(access.length));
 check(r+' mutation',()=>{const e=f.edges[access[0]];assert.ok(reach(e.a,e.b));assert.equal(reach(e.a,e.b,access),false)});
 check(r+' two-sided access',()=>assert.ok(access.length>=2,'only '+access.length+' RAMP_ACCESS edge(s)'));
}
const under=f.nodes.filter(n=>n.surfaceId==='UNDERPASS-H0'),bridge=f.nodes.filter(n=>n.surfaceId==='BRIDGE-H1');
check('underpass isolated',()=>{assert.equal(under.length,11);assert.ok(under.every(n=>!reach(n.id,bridge[0].id)))});
check('bridge nodes',()=>assert.equal(bridge.length,27));
check('bridge access count',()=>assert.equal(f.edges.filter(e=>e.type==='BRIDGE_ACCESS').length,6));
check('bridge access mutation',()=>{const idx=f.edges.map((e,i)=>e.type==='BRIDGE_ACCESS'?i:-1).filter(i=>i>=0);for(const i of idx){const e=f.edges[i];assert.ok(reach(e.a,e.b));assert.equal(reach(e.a,e.b,idx),false)}});
check('spawn exclusions',()=>{for(const x of f.spawnExclusions)assert.equal(nav.spawnAllowed(x.nodeId),false)});
check('unknown spawn rejected',()=>assert.equal(nav.spawnAllowed('UNKNOWN'),false));
check('flag OFF/ON',()=>{const a=adapter.createAdapter(f);assert.equal(adapter.DEFAULT_ENABLED,false);assert.equal(a.navigate('a','b').mode,'LEGACY_DELEGATE');a.setEnabled(true);assert.equal(a.enabled(),true);assert.equal(a.navigate('UNKNOWN','UNKNOWN'),null);a.setEnabled(false);assert.equal(a.enabled(),false)});
check('Save API static isolation',()=>{for(const name of ['surface-navigation-experimental.js','surface-route-audit-experimental.js']){const s=fs.readFileSync(path.join(root,'js',name),'utf8');assert.ok(!/\.\s*(?:localStorage|sessionStorage|indexedDB|setItem\s*\()/.test(s))}});
console.log('SUMMARY '+JSON.stringify({pass,fail}));if(fail)process.exitCode=1;
