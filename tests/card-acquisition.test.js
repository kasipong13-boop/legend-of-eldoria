const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function boot(cards,table){
  const context={ELDORIA:{CARDS:cards||{},MONSTER_CARD_DROP_TABLE:table||{poring:[]}}};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(require.resolve('../js/card-acquisition.js'),'utf8'),context);
  return context.ELDORIA.CardAcquisition;
}
function plain(value){return JSON.parse(JSON.stringify(value));}

test('exposes the five confirmed rarity tiers without assigning rates',()=>{
  const acquisition=boot();
  assert.deepEqual(plain(acquisition.rarities),['Common','Uncommon','Rare','Epic','Legendary']);
});

test('Poring has no configured card drops until approved card content and rates exist',()=>{
  const acquisition=boot();
  assert.deepEqual(plain(acquisition.rollMonsterDrops('poring',()=>0)),[]);
});

test('drop chance is evaluated independently from rarity',()=>{
  const cards={
    skill_common:{id:'skill_common',name:'Common Skill',acquisitionType:'monster-special-skill',rarity:'Common'},
    skill_legendary:{id:'skill_legendary',name:'Legendary Skill',acquisitionType:'monster-special-skill',rarity:'Legendary'}
  };
  const table={poring:[
    {cardId:'skill_common',chance:0.5},
    {cardId:'skill_legendary',chance:0.5}
  ]};
  const rolls=[0.1,0.9];
  const acquisition=boot(cards,table);
  const rewards=acquisition.rollMonsterDrops('poring',()=>rolls.shift());
  assert.deepEqual(plain(rewards),[{cardId:'skill_common',stars:1,quantity:1,name:'Common Skill',rarity:'Common'}]);
});

test('a monster cannot drop a Monster Card or any non-special card',()=>{
  const cards={poring_card:{id:'poring_card',name:'Poring Card',acquisitionType:'monster-card',rarity:'Rare'}};
  const acquisition=boot(cards);
  assert.throws(()=>acquisition.rollMonsterDrops('poring',()=>0,{poring:[{cardId:'poring_card',chance:1}]}),/only drop Monster Special Skill Cards/);
});

test('rejects unknown cards, invalid rarity, and out-of-range drop chance',()=>{
  const unknown=boot();
  assert.throws(()=>unknown.rollMonsterDrops('poring',()=>0,{poring:[{cardId:'missing',chance:1}]}),/Unknown card/);
  const noRarity=boot({skill:{id:'skill',acquisitionType:'monster-special-skill',rarity:'Mythic'}});
  assert.throws(()=>noRarity.rollMonsterDrops('poring',()=>0,{poring:[{cardId:'skill',chance:1}]}),/valid rarity/);
  const valid=boot({skill:{id:'skill',acquisitionType:'monster-special-skill',rarity:'Common'}});
  assert.throws(()=>valid.rollMonsterDrops('poring',()=>0,{poring:[{cardId:'skill',chance:1.1}]}),/Invalid monster card drop entry/);
});
