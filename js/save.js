/* Eldoria Prototype 0.2 save foundation. Kept separate from 0.1 gameplay. */
(function(root){
'use strict';
var E=root.ELDORIA=root.ELDORIA||{}, mem={}, store=null, persistent=false;
var PREFIX='eldoria.char.', INDEX='eldoria.index';
try { store=root.localStorage; var p='eldoria.probe'; store.setItem(p,'1'); if(store.getItem(p)==='1'){store.removeItem(p);persistent=true;} else store=null; } catch(e){store=null;}
function get(k){try{return store?store.getItem(k):(Object.prototype.hasOwnProperty.call(mem,k)?mem[k]:null);}catch(e){store=null;persistent=false;return mem[k]||null;}}
function put(k,v){try{if(store)store.setItem(k,v);else mem[k]=v;return true;}catch(e){store=null;persistent=false;mem[k]=v;return false;}}
function sum(v){var s=JSON.stringify(v),h=2166136261;for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return ('00000000'+(h>>>0).toString(16)).slice(-8);}
function pack(p){return JSON.stringify({payload:p,checksum:sum(p)});}
function unpack(s){try{var x=JSON.parse(s);return x&&x.payload&&x.checksum===sum(x.payload)?x.payload:null;}catch(e){return null;}}
function k(id,s){return PREFIX+id+'.'+s;}
function id(){if(!root.crypto||!root.crypto.getRandomValues)throw Error('Secure random unavailable; use HTTPS and a modern browser.');var a=new Uint8Array(16);root.crypto.getRandomValues(a);return Array.from(a,function(x){return ('0'+x.toString(16)).slice(-2);}).join('');}
function name(v){if(typeof v!=='string')throw Error('Name required.');v=v.trim().normalize('NFC');if(!v||/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060\ufeff]/.test(v))throw Error('Invalid name.');if(!root.Intl||!root.Intl.Segmenter)throw Error('Modern browser required for grapheme validation.');var n=Array.from(new root.Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(v)).length;if(n<1||n>16)throw Error('Name must be 1–16 graphemes.');return v;}
function idx(){try{var a=JSON.parse(get(INDEX)||'[]');return Array.isArray(a)?a:[];}catch(e){return [];}}
function save(p){var id=p.characterId,raw=pack(p);if(!put(k(id,'backup'),raw))throw Error('Backup write failed.');if(!put(k(id,'guard'),JSON.stringify({revision:p.revision,checksum:sum(p)})))throw Error('Guard write failed.');if(!put(k(id,'main'),raw))throw Error('Main write failed.');return JSON.parse(JSON.stringify(p));}
function load(id){var a=unpack(get(k(id,'main'))),b=unpack(get(k(id,'backup'))),g;try{g=JSON.parse(get(k(id,'guard'))||'null');}catch(e){}var c=[a,b].filter(function(p){return p&&p.characterId===id&&p.status==='ready'&&g&&p.revision>=g.revision;}).sort(function(x,y){return y.revision-x.revision;});if(!c.length)return null;if(!a||a.revision<c[0].revision)save(c[0]);return JSON.parse(JSON.stringify(c[0]));}
function create(profile){var p={name:name(profile.name),gender:profile.gender,hairstyle:profile.hairstyle,hairColor:profile.hairColor,job:'novice'};if(['male','female'].indexOf(p.gender)<0||!Number.isInteger(p.hairstyle)||p.hairstyle<0||p.hairstyle>5||!Number.isInteger(p.hairColor)||p.hairColor<0||p.hairColor>7)throw Error('Invalid character appearance.');var cid=id(),base={schemaVersion:1,characterId:cid,revision:1,savedAt:new Date().toISOString(),status:'creating',profile:p,stats:{level:1,exp:0,hp:50,maxHp:50},gold:0,items:{jelly:0},world:{mapId:'greenvale-village',x:5,y:5},deckId:'starter',pendingReward:null,rewardSequence:0};save(base);base.revision=2;base.status='ready';save(base);var a=idx();a.push(cid);put(INDEX,JSON.stringify(a));return JSON.parse(JSON.stringify(base));}
function update(p){var old=load(p.characterId);if(!old)throw Error('Character not found.');p=JSON.parse(JSON.stringify(p));p.revision=old.revision+1;p.status='ready';p.savedAt=new Date().toISOString();return save(p);}
function list(){return idx().map(load).filter(Boolean).sort(function(a,b){return b.savedAt.localeCompare(a.savedAt);});}
function pending(p,r){p=JSON.parse(JSON.stringify(p));p.rewardSequence++;p.pendingReward={id:p.characterId+':'+p.rewardSequence,reward:r,claimed:false};return update(p);}
function claim(p){p=JSON.parse(JSON.stringify(p));var q=p.pendingReward;if(!q||q.claimed)return {payload:p,claimed:false};var r=q.reward||{};p.stats.exp+=(Number(r.exp)||0);p.gold+=(Number(r.gold)||0);(r.drops||[]).forEach(function(d){if(d.id==='jelly')p.items.jelly+=(Number(d.quantity)||1);});p.pendingReward=null;return {payload:update(p),claimed:true};}
E.Save={createCharacter:create,loadCharacter:load,listCharacters:list,saveCharacter:update,setPendingReward:pending,claimPendingReward:claim,validateName:name,get persistentAvailable(){return persistent;},get storageWarning(){return persistent?null:'Session-only: persistent storage unavailable.';}};
})(typeof window!=='undefined'?window:globalThis);
