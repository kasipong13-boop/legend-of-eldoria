/* Run with: node verification/surface-navigation-experimental.test.js
 * Offline synthetic tests only. Does not execute the game's world.js or Save Engine.
 */
'use strict';
const assert=require('node:assert/strict');
const nav=require('../js/surface-navigation-experimental.js');
const fixture={
  nodes:[
    {id:'a',x:0,y:0,surfaceId:'GROUND-H0',kind:'GROUND',elevation:0},
    {id:'b',x:1,y:0,surfaceId:'GROUND-H0',kind:'GROUND',elevation:0},
    {id:'bridge',x:2,y:0,surfaceId:'BRIDGE-H1',kind:'BRIDGE',elevation:1},
    {id:'groundH1',x:3,y:0,surfaceId:'GROUND-H1',kind:'GROUND',elevation:1},
    {id:'underpass',x:2,y:0,surfaceId:'UNDERPASS-H0',kind:'GROUND',elevation:0}
  ],
  edges:[
    {a:'a',b:'b',type:'WALK'},
    {a:'b',b:'bridge',type:'BRIDGE_ACCESS'},
    {a:'bridge',b:'groundH1',type:'BRIDGE_ACCESS'},
    {a:'underpass',b:'bridge',type:'WALK'}
  ],
  spawnExclusions:[{nodeId:'bridge',surfaceId:'BRIDGE-H1'}]
};
const a=nav.createAdapter(fixture);
assert.equal(nav.DEFAULT_ENABLED,false);
assert.equal(a.enabled(),false);
assert.equal(a.navigate('a','b').mode,'LEGACY_DELEGATE');
assert.equal(a.graph.nodeCount,5);
assert.equal(a.graph.edgeCount,4);
assert.equal(a.graph.find(2,0,'BRIDGE-H1'),'bridge');
assert.equal(a.graph.find(2,0,'UNDERPASS-H0'),'underpass');
assert.equal(a.graph.isEdgeValid(3),false);
assert.equal(a.graph.spawnAllowed('bridge'),false);
assert.equal(a.graph.spawnAllowed('underpass'),true);
assert.equal(a.graph.route('underpass','a'),null);
a.setEnabled(true);
assert.equal(a.enabled(),true);
assert.deepEqual(a.navigate('a','b').map(e=>e.to),['b']);
assert.equal(a.graph.route('a','groundH1'),null); // fixture lacks a legal H0->H1 ramp
a.setEnabled(false);
assert.equal(a.navigate('a','b').mode,'LEGACY_DELEGATE');
assert.throws(()=>nav.build({nodes:[],edges:[{a:'missing',b:'other',type:'WALK'}]}),/UNKNOWN_EDGE_NODE/);
console.log('PASS: 15 experimental adapter assertions');
