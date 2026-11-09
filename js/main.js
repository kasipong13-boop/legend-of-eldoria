/* Prototype 0.2 integration. Existing combat rules remain delegated to 0.1 modules. */
(function () {
  'use strict';
  var E = window.ELDORIA, S = E.Save;
  function $(id) { return document.getElementById(id); }
  var player = { level:1, exp:0, gold:0, jelly:0, maxHp:E.RULES.playerMaxHp, hp:E.RULES.playerMaxHp };
  var current = null;
  var screens = ['screen-title','screen-select','screen-create','screen-world','screen-card-collection','screen-battle','screen-result'];
  function show(id) { screens.forEach(function(s){$(s).classList.toggle('active',s===id);}); }
  function toast(msg,ms) { var t=$('toast');t.textContent=msg;t.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(function(){t.classList.remove('show');},ms||4000); }
  function updateHud() {
    var need=E.expToNext(player.level);
    $('hud-level').textContent='Lv '+player.level;
    $('hud-hp-fill').style.width=(100*player.hp/player.maxHp)+'%';
    $('hud-hp-text').textContent='HP '+player.hp+' / '+player.maxHp;
    $('hud-exp-fill').style.width=(100*player.exp/need)+'%';
    $('hud-exp-text').textContent='EXP '+player.exp+' / '+need;
    $('hud-gold').textContent=player.gold+' gold';
    $('hud-jelly').textContent=player.jelly+' jelly';
  }
  function snapshot() {
    if(!current) return;
    var pos=E.World.getPosition();
    if(!pos.safe) return;
    // Merge the latest saved payload before writing world state so optional systems
    // cannot be overwritten by an older in-memory character snapshot.
    var latest=S.loadCharacter(current.characterId);
    if(latest) current=latest;
    current.stats={level:player.level,exp:player.exp,hp:player.hp,maxHp:player.maxHp};
    current.gold=player.gold;current.items={jelly:player.jelly};current.world=pos;
    current=S.saveCharacter(current);
  }
  function applyCharacter(c) {
    // Complete a reward transaction interrupted by a reload before entering the world.
    if(c.pendingReward){var recovered=S.claimPendingReward(c);c=recovered.payload;}
    current=c;
    player.level=c.stats.level;player.exp=c.stats.exp;player.hp=c.stats.hp;player.maxHp=c.stats.maxHp;
    player.gold=c.gold;player.jelly=(c.items&&c.items.jelly)||0;
    if(c.world) E.World.setPosition(c.world);
    E.World.setAppearance(c.profile);
    updateHud();
  }
  function enterWorld(c) {
    applyCharacter(c);show('screen-world');
    E.World.resume();toast('Tap the ground to walk. Touch the pink Poring to fight.',4500);
  }
  var hairPalette=['#302018','#65402a','#e4c36b','#a83f32','#426fb7','#43834c','#b9c4cf','#8052a2'];
  function makeAvatar(profile,small) {
    var avatar=document.createElement('div');avatar.className='avatar-preview'+(small?' avatar-small':'');avatar.setAttribute('aria-hidden','true');
    var body=document.createElement('span');body.className='avatar-body';var head=document.createElement('span');head.className='avatar-head';
    var hair=document.createElement('i');hair.className='avatar-hair';var left=document.createElement('i');left.className='avatar-eye left';var right=document.createElement('i');right.className='avatar-eye right';
    hair.style.backgroundColor=hairPalette[profile.hairColor]||hairPalette[0];hair.classList.add('hair-style-'+(profile.hairstyle||0));if(profile.gender==='female')avatar.classList.add('avatar-female');
    head.appendChild(hair);head.appendChild(left);head.appendChild(right);avatar.appendChild(body);avatar.appendChild(head);return avatar;
  }
  function updateCreationPreview(){var host=$('creation-avatar');if(!host)return;var profile={gender:$('character-gender').value,hairstyle:Number($('character-hair').value),hairColor:Number($('character-color').value)};var avatar=makeAvatar(profile,false);host.replaceWith(avatar);avatar.id='creation-avatar';avatar.setAttribute('aria-label','Character preview');}
  function renderCharacterList() {
    var host=$('character-list');host.innerHTML='';
    var chars=S.listCharacters();
    if(!S.persistentAvailable) $('storage-warning').textContent=S.storageWarning+' Characters will not survive closing this session.';
    else $('storage-warning').textContent='';
    if(!chars.length){var empty=document.createElement('p');empty.className='character-empty';empty.textContent='No saved characters yet.';host.appendChild(empty);return;}
    chars.forEach(function(c){
      var row=document.createElement('div');row.className='character-row';
      var info=document.createElement('div'),name=document.createElement('strong'),meta=document.createElement('small');
      name.textContent=c.profile.name;meta.textContent='Novice · Lv '+c.stats.level+' · '+c.gold+' Gold';
      info.appendChild(makeAvatar(c.profile,true));info.appendChild(name);info.appendChild(meta);
      var btn=document.createElement('button');btn.type='button';btn.className='btn primary';btn.textContent='Play';
      btn.addEventListener('click',function(){enterWorld(c);});
      row.appendChild(info);row.appendChild(btn);host.appendChild(row);
    });
  }
  function openSelect(){renderCharacterList();show('screen-select');}
  function createCharacter(){
    $('create-error').textContent='';
    try {
      var c=S.createCharacter({name:$('character-name').value,gender:$('character-gender').value,hairstyle:Number($('character-hair').value),hairColor:Number($('character-color').value)});
      $('character-name').value='';enterWorld(c);
    } catch(e){$('create-error').textContent=e.message||'Unable to create character.';}
  }
  function startBattle(monsterId){E.World.pause();show('screen-battle');E.BattleUI.start({hp:player.hp,maxHp:player.maxHp},monsterId,onBattleEnd);}
  function onBattleEnd(result){
    var list=$('result-list');list.innerHTML='';
    function line(text,cls){var li=document.createElement('li');li.textContent=text;if(cls)li.className=cls;list.appendChild(li);}
    if(result.won){
      var rw=E.rollRewards(result.monsterId);
      var cardDrops=E.CardAcquisition.rollMonsterDrops(result.monsterId);
      // Persist item and card rewards together before the result screen can be shown.
      current=S.setPendingReward(current,{exp:rw.exp,gold:rw.gold,drops:rw.drops.map(function(d){return {id:d.id,name:d.name,quantity:1};}),cardDrops:cardDrops});
      var claimed=S.claimPendingReward(current);current=claimed.payload;
      $('result-title').textContent='Victory!';
      line('+'+rw.exp+' EXP');line('+'+rw.gold+' gold');
      rw.drops.forEach(function(d){line('Dropped: '+d.name,'loot');});
      cardDrops.forEach(function(card){line('Card acquired: '+card.name+' · '+card.rarity,'card-loot');});
      if(!rw.drops.length&&!cardDrops.length)line('No drops this time.');
      player.level=current.stats.level;player.exp=current.stats.exp;player.gold=current.gold;player.jelly=current.items.jelly;
      while(player.exp>=E.expToNext(player.level)){
        player.exp-=E.expToNext(player.level);player.level++;player.maxHp+=E.levelUpMaxHp;
        line('Level up! Now Lv '+player.level+', max HP '+player.maxHp,'level');
      }
      $('btn-result').textContent='Return to the village';
    } else {
      $('result-title').textContent='Defeated';
      line('You wake up safe in Greenvale Village.');line('Nothing was lost.');
      $('btn-result').textContent='Wake up';
    }
    player.hp=player.maxHp;
    snapshot();
    $('btn-result').onclick=function(){backToVillage(!result.won);};
    show('screen-result');
  }
  function renderCardCollection(){
    if(!current)return;
    var data=S.getDeckData(current),owned=$('collection-owned'),presets=$('collection-presets');
    owned.innerHTML='';presets.innerHTML='';
    var total=data.owned.reduce(function(sum,item){return sum+item.quantity;},0);
    $('collection-summary').textContent=total+' owned card copies · '+data.owned.length+' card variants · '+data.presets.length+' deck presets';
    if(!data.owned.length){
      var empty=document.createElement('p');empty.className='collection-empty';empty.textContent='No cards collected yet. Card rewards and acquisition will be added in a later milestone.';owned.appendChild(empty);
    }else{
      data.owned.forEach(function(item){
        var def=E.CARDS[item.cardId]||{},row=document.createElement('div');row.className='collection-row';
        var info=document.createElement('div'),name=document.createElement('strong'),meta=document.createElement('small'),qty=document.createElement('span');
        name.textContent=def.name||item.cardId;meta.textContent='Star '+item.stars+' · '+(def.rarity||'Rarity unassigned')+' · '+(def.kind||'Card');
        info.appendChild(name);info.appendChild(meta);qty.className='collection-quantity';qty.textContent='×'+item.quantity;
        row.appendChild(info);row.appendChild(qty);owned.appendChild(row);
      });
    }
    if(!data.presets.length){
      var noPresets=document.createElement('p');noPresets.className='collection-empty';noPresets.textContent='No saved deck presets yet.';presets.appendChild(noPresets);
    }else{
      data.presets.forEach(function(preset){
        var row=document.createElement('div');row.className='collection-row';
        var info=document.createElement('div'),name=document.createElement('strong'),meta=document.createElement('small');
        name.textContent=preset.name;meta.textContent=preset.cardRefs.length+' / 20 cards';
        info.appendChild(name);info.appendChild(meta);
        var state=document.createElement('span');state.className='collection-state';
        state.textContent=preset.id===data.activePresetId?'Active':'Saved';
        row.appendChild(info);row.appendChild(state);presets.appendChild(row);
      });
    }
  }
  function openCardCollection(){
    if(!current||!$('screen-world').classList.contains('active'))return;
    E.World.pause();renderCardCollection();show('screen-card-collection');
  }
  function closeCardCollection(){show('screen-world');E.World.resume();}
  function backToVillage(resetHero){if(resetHero)E.World.respawn(true);updateHud();snapshot();show('screen-world');E.World.resume();}
  $('btn-card-collection').addEventListener('click',openCardCollection);
  $('btn-card-collection-back').addEventListener('click',closeCardCollection);
  $('btn-start').addEventListener('click',openSelect);
  $('btn-new').addEventListener('click',function(){show('screen-create');});
  $('btn-new-character').addEventListener('click',function(){show('screen-create');});
  $('btn-select-back').addEventListener('click',function(){show('screen-title');});
  $('btn-create-back').addEventListener('click',function(){openSelect();});
  $('btn-create-confirm').addEventListener('click',createCharacter);
  ['character-gender','character-hair','character-color'].forEach(function(id){$(id).addEventListener('change',updateCreationPreview);});
  updateCreationPreview();
  $('character-name').addEventListener('keydown',function(e){if(e.key==='Enter')createCharacter();});
  E.World.init($('world-canvas'));
  E.World.onEncounter=function(monsterId){startBattle(monsterId);};
  E.World.onSafeTile=function(){if(current&&$('screen-world').classList.contains('active'))snapshot();};
  window.addEventListener('pagehide',function(){if(current&&$('screen-world').classList.contains('active'))snapshot();});
  updateHud();
})();