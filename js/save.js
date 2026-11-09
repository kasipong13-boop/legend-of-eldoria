/* Eldoria Prototype 0.2 save foundation. Kept separate from 0.1 gameplay. */
(function(root){
'use strict';
var E=root.ELDORIA=root.ELDORIA||{}, mem={}, store=null, persistent=false;
var PREFIX='eldoria.char.', INDEX='eldoria.index';
try { store=root.localStorage; var p='eldoria.probe'; store.setItem(p,'1'); if(store.getItem(p)==='1'){store.removeItem(p);persistent=true;} else store=null; } catch(e){store=null;}
function migrateToMemory(extraKey){
  if(store){
    var old=store, ids=[];
    try{var list=JSON.parse(old.getItem(INDEX)||'[]');if(Array.isArray(list))ids=list;}catch(e){}
    if(extraKey&&extraKey.indexOf(PREFIX)===0){var match=extraKey.slice(PREFIX.length).split('.')[0];if(match&&ids.indexOf(match)<0)ids.push(match);}
    try{var indexValue=old.getItem(INDEX);if(indexValue!==null)mem[INDEX]=indexValue;}catch(e){}
    ids.forEach(function(cid){['main','backup','guard'].forEach(function(part){var key=k(cid,part);try{var value=old.getItem(key);if(value!==null)mem[key]=value;}catch(e){}});});
    if(extraKey)try{var value=old.getItem(extraKey);if(value!==null)mem[extraKey]=value;}catch(e){}
  }
  store=null;persistent=false;
}
function get(key){if(!store)return Object.prototype.hasOwnProperty.call(mem,key)?mem[key]:null;try{return store.getItem(key);}catch(e){migrateToMemory(key);return Object.prototype.hasOwnProperty.call(mem,key)?mem[key]:null;}}
function put(key,value){if(!store){mem[key]=value;return true;}try{store.setItem(key,value);return true;}catch(e){migrateToMemory(key);mem[key]=value;return true;}}
function sum(v){var s=JSON.stringify(v),h=2166136261;for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return ('00000000'+(h>>>0).toString(16)).slice(-8);}
function pack(p){return JSON.stringify({payload:p,checksum:sum(p)});}
function unpack(s){try{var x=JSON.parse(s);return x&&x.payload&&x.checksum===sum(x.payload)?x.payload:null;}catch(e){return null;}}
function k(id,s){return PREFIX+id+'.'+s;}
function id(){if(!root.crypto||!root.crypto.getRandomValues)throw Error('Secure random unavailable; use HTTPS and a modern browser.');var a=new Uint8Array(16);root.crypto.getRandomValues(a);return Array.from(a,function(x){return ('0'+x.toString(16)).slice(-2);}).join('');}
function name(v){if(typeof v!=='string')throw Error('Name required.');v=v.trim().normalize('NFC');if(!v||/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060\ufeff]/.test(v))throw Error('Invalid name.');if(!root.Intl||!root.Intl.Segmenter)throw Error('Modern browser required for grapheme validation.');var n=Array.from(new root.Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(v)).length;if(n<1||n>16)throw Error('Name must be 1–16 graphemes.');return v;}
function idx(){try{var a=JSON.parse(get(INDEX)||'[]');return Array.isArray(a)?a:[];}catch(e){return [];}}
function save(p){var id=p.characterId,raw=pack(p);if(!put(k(id,'backup'),raw))throw Error('Backup write failed.');if(!put(k(id,'guard'),JSON.stringify({revision:p.revision,checksum:sum(p)})))throw Error('Guard write failed.');if(!put(k(id,'main'),raw))throw Error('Main write failed.');return JSON.parse(JSON.stringify(p));}
function load(id){var a=unpack(get(k(id,'main'))),b=unpack(get(k(id,'backup'))),g;try{g=JSON.parse(get(k(id,'guard'))||'null');}catch(e){}var guardOK=g&&Number.isInteger(g.revision)&&g.revision>=1&&typeof g.checksum==='string';var c=[a,b].filter(function(p){return p&&p.characterId===id&&p.status==='ready'&&guardOK&&Number.isInteger(p.revision)&&p.revision>=g.revision&&(p.revision!==g.revision||g.checksum===sum(p));}).sort(function(x,y){return y.revision-x.revision;});if(!c.length)return null;if(!a||a.revision<c[0].revision)save(c[0]);return JSON.parse(JSON.stringify(c[0]));}
function create(profile){var p={name:name(profile.name),gender:profile.gender,hairstyle:profile.hairstyle,hairColor:profile.hairColor,job:'novice'};if(['male','female'].indexOf(p.gender)<0||!Number.isInteger(p.hairstyle)||p.hairstyle<0||p.hairstyle>5||!Number.isInteger(p.hairColor)||p.hairColor<0||p.hairColor>7)throw Error('Invalid character appearance.');var cid=id(),base={schemaVersion:1,characterId:cid,revision:1,savedAt:new Date().toISOString(),status:'creating',profile:p,stats:{level:1,exp:0,hp:50,maxHp:50},gold:0,items:{jelly:0},world:{mapId:'greenvale-village',x:5,y:5},deckId:'starter',pendingReward:null,rewardSequence:0};save(base);base.revision=2;base.status='ready';save(base);var a=idx();a.push(cid);if(!put(INDEX,JSON.stringify(a)))throw Error('Unable to index character.');return JSON.parse(JSON.stringify(base));}
function update(p){var old=load(p.characterId);if(!old)throw Error('Character not found.');p=JSON.parse(JSON.stringify(p));p.revision=old.revision+1;p.status='ready';p.savedAt=new Date().toISOString();return save(p);}
function list(){return idx().map(load).filter(Boolean).sort(function(a,b){return b.savedAt.localeCompare(a.savedAt);});}
function pending(p,r){p=JSON.parse(JSON.stringify(p));p.rewardSequence++;p.pendingReward={id:p.characterId+':'+p.rewardSequence,reward:r,claimed:false};return update(p);}
function claim(p){p=JSON.parse(JSON.stringify(p));var q=p.pendingReward;if(!q||q.claimed)return {payload:p,claimed:false};var r=q.reward||{};p.stats.exp+=(Number(r.exp)||0);p.gold+=(Number(r.gold)||0);(r.drops||[]).forEach(function(d){if(d.id==='jelly')p.items.jelly+=(Number(d.quantity)||1);});p.pendingReward=null;return {payload:update(p),claimed:true};}
function saveDeckData(p,data){
  if(!p||!p.characterId)throw Error('Character required.');
  if(!data||!Array.isArray(data.owned)||!Array.isArray(data.presets)||(data.activePresetId!==null&&typeof data.activePresetId!=='string'))throw Error('Invalid deck data.');
  var owned=Object.create(null);
  data.owned.forEach(function(entry){
    if(!entry||typeof entry.cardId!=='string'||!entry.cardId||!Number.isInteger(entry.stars)||entry.stars<1||entry.stars>3||!Number.isInteger(entry.quantity)||entry.quantity<0)throw Error('Invalid owned-card entry.');
    var key=entry.cardId+'@'+entry.stars;owned[key]=(owned[key]||0)+entry.quantity;
  });
  var presetIds=Object.create(null);
  data.presets.forEach(function(preset){
    if(!preset||typeof preset.id!=='string'||!preset.id||typeof preset.name!=='string'||!preset.name.trim()||!Array.isArray(preset.cardRefs))throw Error('Invalid deck preset.');
    if(preset.cardRefs.length>20)throw Error('Deck preset cannot exceed 20 cards.');
    if(presetIds[preset.id])throw Error('Duplicate deck preset id.');
    presetIds[preset.id]=true;
    var used=Object.create(null);
    preset.cardRefs.forEach(function(ref){
      if(!ref||typeof ref.cardId!=='string'||!ref.cardId||!Number.isInteger(ref.stars)||ref.stars<1||ref.stars>3)throw Error('Invalid preset card reference.');
      var key=ref.cardId+'@'+ref.stars;used[key]=(used[key]||0)+1;
      if(used[key]>(owned[key]||0))throw Error('Preset references unowned cards: '+key+'.');
    });
  });
  if(data.presets.length&&!presetIds[data.activePresetId])throw Error('Active deck preset does not exist.');
  if(!data.presets.length&&data.activePresetId)throw Error('Active deck preset does not exist.');
  var current=load(p.characterId);if(!current)throw Error('Character not found.');
  current.deckCollection={owned:JSON.parse(JSON.stringify(data.owned))};
  current.deckPresets=JSON.parse(JSON.stringify(data.presets));
  current.activeDeckPresetId=data.activePresetId||null;
  return update(current);
}
function getDeckData(p){
  if(!p||!p.characterId)throw Error('Character required.');
  var current=load(p.characterId);if(!current)throw Error('Character not found.');
  return {owned:JSON.parse(JSON.stringify(current.deckCollection&&Array.isArray(current.deckCollection.owned)?current.deckCollection.owned:[])),presets:JSON.parse(JSON.stringify(Array.isArray(current.deckPresets)?current.deckPresets:[])),activePresetId:current.activeDeckPresetId||null};
}
E.Save={createCharacter:create,loadCharacter:load,listCharacters:list,saveCharacter:update,saveDeckData:saveDeckData,getDeckData:getDeckData,setPendingReward:pending,claimPendingReward:claim,validateName:name,get persistentAvailable(){return persistent;},get storageWarning(){return persistent?null:'Session-only: persistent storage unavailable.';}};
})(typeof window!=='undefined'?window:globalThis);
