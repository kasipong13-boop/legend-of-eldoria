#!/usr/bin/env node
'use strict';
// WF41 graph-only preview static regression checks. No dependencies, no writes.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../..');
const fixture=JSON.parse(fs.readFileSync(path.join(root,'verification/fixtures/wf41-surface-graph.json'),'utf8'));
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
let count=0;
function check(name,fn){try{fn();console.log('PASS '+name);count++}catch(e){console.error('FAIL '+name+': '+e.message);process.exitCode=1}}
check('128x128 node bounds',()=>assert(fixture.nodes.every(n=>Number.isInteger(n.x)&&Number.isInteger(n.y)&&n.x>=0&&n.y>=0&&n.x<128&&n.y<128)));
check('unique node IDs',()=>assert.equal(new Set(fixture.nodes.map(n=>n.id)).size,fixture.nodes.length));
check('no dangling edges',()=>{const ids=new Set(fixture.nodes.map(n=>n.id));assert(fixture.edges.every(e=>ids.has(e.a)&&ids.has(e.b)))});
check('cardinal adjacency only',()=>{const map=new Map(fixture.nodes.map(n=>[n.id,n]));assert(fixture.edges.every(e=>{const a=map.get(e.a),b=map.get(e.b);return Math.abs(a.x-b.x)+Math.abs(a.y-b.y)===1}))});
check('graph count matches original',()=>{assert.equal(fixture.nodes.length,337);assert.equal(fixture.edges.length,416)});
check('fixture fetch stays in experimental preview',()=>assert(html.includes("../../verification/fixtures/wf41-surface-graph.json")));
check('unknown cannot become walkable',()=>{assert(html.includes('neighbors().find('));assert(html.includes('no verified graph edge'));assert(html.includes('UNKNOWN'))});
check('no Save Engine / storage access',()=>assert(!/localStorage|sessionStorage|indexedDB|setPosition\s*\(|saveGame\s*\(/.test(html)));
check('mobile controls present',()=>{for(const id of ['up','down','left','right','zin','zout','home'])assert(html.includes('id="'+id+'"'));assert(html.includes('pointerdown'))});
check('preview HTML remains isolated',()=>assert(!/<script[^>]+src=/.test(html)));
console.log('WF41 static checks: '+count+'/10 PASS. Browser execution and Safari device test NOT EXECUTED.');
if(process.exitCode)process.exit(process.exitCode);
