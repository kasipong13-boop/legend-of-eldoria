const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
function boot(){const data={};const localStorage={getItem:k=>data[k]??null,setItem:(k,v)=>data[k]=String(v),removeItem:k=>delete data[k]};const c={localStorage,crypto:webcrypto,Intl,Date,Uint8Array,Math,JSON,Object,Array,String,Number,Error,RegExp};c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync(require.resolve('../js/save.js'),'utf8'),c);return {Save:c.ELDORIA.Save,data};}
const profile={name:'นักผจญภัย',gender:'male',hairstyle:2,hairColor:3};
test('creates ready character with 128-bit id',()=>{const {Save}=boot();const c=Save.createCharacter(profile);assert.match(c.characterId,/^[a-f0-9]{32}$/);assert.equal(c.revision,2);assert.equal(c.status,'ready');assert.equal(Save.listCharacters().length,1);});
test('validates Thai name length and invisible controls',()=>{const {Save}=boot();assert.equal(Save.validateName(' นักผจญภัย '),'นักผจญภัย');assert.throws(()=>Save.validateName('a'.repeat(17)));assert.throws(()=>Save.validateName('ab\u200Bcd'));});
test('recovers latest backup if main is corrupt',()=>{const {Save,data}=boot();let c=Save.createCharacter(profile);c.gold=77;c=Save.saveCharacter(c);data['eldoria.char.'+c.characterId+'.main']='broken';assert.equal(Save.loadCharacter(c.characterId).gold,77);});
test('reward can be claimed only once',()=>{const {Save}=boot();let c=Save.createCharacter(profile);c=Save.setPendingReward(c,{exp:12,gold:5,drops:[{id:'jelly'}]});const a=Save.claimPendingReward(c);assert.equal(a.claimed,true);assert.equal(a.payload.gold,5);assert.equal(a.payload.items.jelly,1);assert.equal(Save.claimPendingReward(a.payload).claimed,false);});
test('fails closed without crypto random',()=>{const data={};const c={localStorage:{getItem:k=>data[k]||null,setItem:(k,v)=>data[k]=v,removeItem:k=>delete data[k]},Intl,Date,Uint8Array,Math,JSON,Object,Array,String,Number,Error,RegExp};c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync(require.resolve('../js/save.js'),'utf8'),c);assert.throws(()=>c.ELDORIA.Save.createCharacter(profile));});

test('supports multiple independent character identities',()=>{const {Save}=boot();const a=Save.createCharacter(profile);const b=Save.createCharacter({...profile,name:'นักเวท'});assert.notEqual(a.characterId,b.characterId);assert.equal(Save.listCharacters().length,2);assert.equal(Save.loadCharacter(a.characterId).profile.name,'นักผจญภัย');assert.equal(Save.loadCharacter(b.characterId).profile.name,'นักเวท');});
test('increments revisions on each committed save',()=>{const {Save}=boot();let c=Save.createCharacter(profile);assert.equal(c.revision,2);c.gold=42;c=Save.saveCharacter(c);assert.equal(c.revision,3);assert.equal(Save.loadCharacter(c.characterId).gold,42);});
test('rejects invalid appearance without creating a character',()=>{const {Save}=boot();assert.throws(()=>Save.createCharacter({...profile,hairstyle:99}));assert.equal(Save.listCharacters().length,0);});

test('uses session-only memory when persistent storage is unavailable',()=>{const c={crypto:webcrypto,Intl,Date,Uint8Array,Math,JSON,Object,Array,String,Number,Error,RegExp,localStorage:{getItem(){throw Error('blocked');},setItem(){throw Error('blocked');},removeItem(){}}};c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync(require.resolve('../js/save.js'),'utf8'),c);const S=c.ELDORIA.Save;assert.equal(S.persistentAvailable,false);const ch=S.createCharacter(profile);assert.equal(S.listCharacters().length,1);assert.equal(S.loadCharacter(ch.characterId).profile.name,'นักผจญภัย');});
test('keeps reward transaction pending until explicit claim',()=>{const {Save}=boot();let c=Save.createCharacter(profile);c=Save.setPendingReward(c,{exp:12,gold:8,drops:[]});const restored=Save.loadCharacter(c.characterId);assert.ok(restored.pendingReward);assert.equal(restored.gold,0);const claimed=Save.claimPendingReward(restored);assert.equal(claimed.payload.gold,8);assert.equal(claimed.payload.stats.exp,12);});
test('character screens and save module load before main integration',()=>{const html=fs.readFileSync(require.resolve('../index.html'),'utf8');for(const id of ['screen-select','screen-create','btn-new-character','btn-create-confirm','character-list','storage-warning'])assert.match(html,new RegExp('id="'+id+'"'));assert.ok(html.indexOf('js/save.js')<html.indexOf('js/main.js'));});
test('world exposes public stable-position API without depending on debug object',()=>{const world=fs.readFileSync(require.resolve('../js/world.js'),'utf8');assert.match(world,/W\.getPosition\s*=/);assert.match(world,/W\.setPosition\s*=/);assert.match(world,/W\.onSafeTile/);});

test('pending reward is recovered after simulated reload and applied once',()=>{const {Save}=boot();let c=Save.createCharacter(profile);c=Save.setPendingReward(c,{exp:12,gold:9,drops:[{id:'jelly',quantity:1}]});const reloaded=Save.loadCharacter(c.characterId);const recovery=Save.claimPendingReward(reloaded);assert.equal(recovery.claimed,true);assert.equal(recovery.payload.stats.exp,12);assert.equal(recovery.payload.gold,9);assert.equal(recovery.payload.items.jelly,1);const second=Save.claimPendingReward(Save.loadCharacter(c.characterId));assert.equal(second.claimed,false);assert.equal(second.payload.gold,9);});
test('continue flow resolves pending rewards before loading character state',()=>{const main=fs.readFileSync(require.resolve('../js/main.js'),'utf8');assert.match(main,/if\(c\.pendingReward\)\{var recovered=S\.claimPendingReward\(c\);c=recovered\.payload;\}/);});
test('encounter transition ends movement on a completed tile',()=>{const world=fs.readFileSync(require.resolve('../js/world.js'),'utf8');assert.match(world,/hero\.x = hero\.c; hero\.y = hero\.r; hero\.moving = false;/);});

test('migrates existing saves into session memory when storage later fails',()=>{const data={};let failWrites=false;const localStorage={getItem:k=>data[k]??null,setItem:(k,v)=>{if(failWrites)throw Error('quota exceeded');data[k]=String(v);},removeItem:k=>delete data[k]};const c={localStorage,crypto:webcrypto,Intl,Date,Uint8Array,Math,JSON,Object,Array,String,Number,Error,RegExp};c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync(require.resolve('../js/save.js'),'utf8'),c);const S=c.ELDORIA.Save;let ch=S.createCharacter(profile);failWrites=true;ch.gold=31;ch=S.saveCharacter(ch);assert.equal(S.persistentAvailable,false);assert.equal(S.loadCharacter(ch.characterId).gold,31);assert.equal(S.listCharacters().length,1);});
test('rejects a corrupted guard checksum rather than loading an untrusted revision',()=>{const {Save,data}=boot();const ch=Save.createCharacter(profile);const key='eldoria.char.'+ch.characterId+'.guard';const guard=JSON.parse(data[key]);guard.checksum='00000000';data[key]=JSON.stringify(guard);assert.equal(Save.loadCharacter(ch.characterId),null);});

test('world exposes saved character appearance API and main applies profile on continue',()=>{const world=fs.readFileSync(require.resolve('../js/world.js'),'utf8');const main=fs.readFileSync(require.resolve('../js/main.js'),'utf8');assert.match(world,/W\.setAppearance\s*=\s*function\(profile\)/);assert.match(world,/HAIR\s*=\s*\[/);assert.match(main,/E\.World\.setAppearance\(c\.profile\)/);});

test('character creation and select screens render avatar previews',()=>{const html=fs.readFileSync(require.resolve('../index.html'),'utf8');const main=fs.readFileSync(require.resolve('../js/main.js'),'utf8');const css=fs.readFileSync(require.resolve('../css/character.css'),'utf8');assert.match(html,/id="creation-avatar"/);assert.match(main,/function makeAvatar\(profile,small\)/);assert.match(main,/info\.appendChild\(makeAvatar\(c\.profile,true\)\)/);assert.match(css,/\.avatar-preview-wrap/);});


test('legacy characters expose empty deck data without changing existing save fields',()=>{
  const {Save}=boot();let c=Save.createCharacter(profile);c.gold=41;c=Save.saveCharacter(c);
  const deck=Save.getDeckData(c);
  assert.deepEqual(JSON.parse(JSON.stringify(deck)),{owned:[],presets:[],activePresetId:null});
  const loaded=Save.loadCharacter(c.characterId);
  assert.equal(loaded.deckId,'starter');assert.equal(loaded.gold,41);assert.equal(loaded.schemaVersion,1);
});

test('saves and reloads owned cards and reusable deck presets additively',()=>{
  const {Save}=boot();let c=Save.createCharacter(profile);
  const data={owned:[{cardId:'strike',stars:1,quantity:3},{cardId:'guard',stars:1,quantity:2}],presets:[
    {id:'preset-a',name:'Balanced',cardRefs:[{cardId:'strike',stars:1},{cardId:'guard',stars:1}]},
    {id:'preset-b',name:'Alternate',cardRefs:[{cardId:'strike',stars:1}]}
  ],activePresetId:'preset-a'};
  c=Save.saveDeckData(c,data);
  const reloaded=Save.loadCharacter(c.characterId);
  assert.deepEqual(JSON.parse(JSON.stringify(Save.getDeckData(reloaded))),data);
  assert.equal(reloaded.deckId,'starter');
  assert.equal(reloaded.schemaVersion,1);
});

test('deck save rejects preset references beyond owned quantity without modifying save',()=>{
  const {Save}=boot();let c=Save.createCharacter(profile);c.gold=12;c=Save.saveCharacter(c);
  assert.throws(()=>Save.saveDeckData(c,{owned:[{cardId:'strike',stars:1,quantity:1}],presets:[{id:'p1',name:'Test',cardRefs:[{cardId:'strike',stars:1},{cardId:'strike',stars:1}]}],activePresetId:'p1'}),/unowned cards/);
  assert.equal(Save.loadCharacter(c.characterId).gold,12);
  assert.deepEqual(JSON.parse(JSON.stringify(Save.getDeckData(c))),{owned:[],presets:[],activePresetId:null});
});

test('deck save rejects malformed ownership and missing active preset',()=>{
  const {Save}=boot();const c=Save.createCharacter(profile);
  assert.throws(()=>Save.saveDeckData(c,{owned:[{cardId:'strike',stars:4,quantity:1}],presets:[],activePresetId:null}),/Invalid owned-card/);
  assert.throws(()=>Save.saveDeckData(c,{owned:[],presets:[{id:'p1',name:'Test',cardRefs:[]}],activePresetId:'missing'}),/Active deck preset/);
});

test('deck save rejects presets larger than the confirmed 20-card deck size',()=>{
  const {Save}=boot();const c=Save.createCharacter(profile);
  const cardRefs=Array.from({length:21},()=>({cardId:'strike',stars:1}));
  assert.throws(()=>Save.saveDeckData(c,{owned:[{cardId:'strike',stars:1,quantity:21}],presets:[{id:'p1',name:'Oversized',cardRefs}],activePresetId:'p1'}),/cannot exceed 20 cards/);
});

test('Card Collection is registered as a read-only screen with world navigation',()=>{
  const html=fs.readFileSync(require.resolve('../index.html'),'utf8');
  const main=fs.readFileSync(require.resolve('../js/main.js'),'utf8');
  assert.match(html,/id="screen-card-collection"/);
  assert.match(html,/id="btn-card-collection"/);
  assert.match(html,/id="btn-card-collection-back"/);
  assert.match(html,/id="collection-owned"/);
  assert.match(html,/id="collection-presets"/);
  assert.match(main,/function openCardCollection\(\)/);
  assert.match(main,/function closeCardCollection\(\)/);
  assert.match(main,/E\.World\.pause\(\);renderCardCollection\(\);show\('screen-card-collection'\)/);
  assert.match(main,/function closeCardCollection\(\)\{show\('screen-world'\);E\.World\.resume\(\);\}/);
  assert.doesNotMatch(main,/function openCardCollection\(\)[\s\S]*?saveDeckData/);
});
