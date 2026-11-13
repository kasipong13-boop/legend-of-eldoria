'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const A=require('../../../js/encounter-adapter');
const source=fs.readFileSync(path.join(__dirname,'../../../js/map-data.js'),'utf8');
const context={ELDORIA:{}};
vm.runInNewContext(source,context,{filename:'map-data.js'});
const M=context.ELDORIA.MapData;
test('real mapdata exposes required API',()=>{assert.equal(typeof M.get,'function');assert.equal(typeof M.isWalkable,'function');});
for(const id of ['greenvale','whispering_forest']){
 test('real map '+id+' adapter respects tiles and bounds',()=>{
  const m=M.get(id);assert.ok(m,'missing '+id);const a=A.createMapAdapter(M,m);assert.equal(a.id,id);
  for(let r=0;r<m.tiles.length;r++)for(let c=0;c<m.tiles[r].length;c++)assert.equal(a.isWalkable(c,r),M.isWalkable(m,c,r),'tile '+c+','+r);
  assert.equal(a.isWalkable(-1,0),false);assert.equal(a.isWalkable(m.tiles[0].length,0),false);
 });
}
