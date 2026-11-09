const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');

function loadGame(){
  const context={};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(require.resolve('../js/data.js'),'utf8'),context);
  vm.runInContext(fs.readFileSync(require.resolve('../js/card-acquisition.js'),'utf8'),context);
  return context.ELDORIA;
}

test('approved Monster Special Skill Cards are registered with their confirmed catalog data',()=>{
  const E=loadGame();
  const slime=E.CARDS['msc-por-001'];
  const wolf=E.CARDS['msc-wolf-001'];
  assert.ok(slime);
  assert.ok(wolf);
  for(const card of [slime,wolf]){
    assert.equal(card.cardFamily,'monster-special-skill');
    assert.equal(card.acquisitionType,'monster-special-skill');
    assert.equal(card.deckCopyLimit,2);
    assert.equal(card.implementationStatus,'catalog-only');
    assert.equal(card.cost,1);
    assert.equal(card.element,'neutral');
    assert.ok(card.starUpgrades[2]);
    assert.ok(card.starUpgrades[3]);
  }
  assert.equal(slime.name,'Slime Splash');
  assert.equal(slime.rarity,'Uncommon');
  assert.equal(slime.sourceMonsterId,'poring');
  assert.equal(slime.damage,5);
  assert.deepEqual(JSON.parse(JSON.stringify(slime.statusEffects)),[{type:'vulnerable',stacks:1,duration:1}]);
  assert.equal(slime.starUpgrades[2].element,'water');
  assert.equal(slime.starUpgrades[3].effect.damage,3);
  assert.equal(wolf.name,'Savage Bite');
  assert.equal(wolf.rarity,'Rare');
  assert.equal(wolf.sourceMonsterId,'wolf');
  assert.equal(wolf.damage,7);
  assert.deepEqual(JSON.parse(JSON.stringify(wolf.statusEffects)),[{type:'bleed',stacks:2}]);
  assert.equal(wolf.starUpgrades[2].effect.threshold,50);
  assert.equal(wolf.starUpgrades[3].effect.status,'bleed');
});

test('approved cards remain inactive in drop tables until independent drop chances are approved',()=>{
  const E=loadGame();
  assert.deepEqual(JSON.parse(JSON.stringify(E.MONSTER_CARD_DROP_TABLE)),{poring:[]});
  assert.deepEqual(E.CardAcquisition.rollMonsterDrops('poring',()=>0),[]);
  assert.deepEqual(E.CardAcquisition.rollMonsterDrops('wolf',()=>0),[]);
});
