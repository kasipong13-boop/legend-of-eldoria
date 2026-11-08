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
