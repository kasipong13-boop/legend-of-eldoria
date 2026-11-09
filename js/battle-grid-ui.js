/* Isolated UI harness for Battle Core v2. Does not replace or mutate the live legacy battle flow. */
(function(root){
  'use strict';
  var E=root.ELDORIA, Core=E&&E.BattleCore;
  if(!Core) throw new Error('Battle Core v2 is required before Battle Grid UI.');
  var $=function(id){return document.getElementById(id);};
  var battle=null, selectedCard=null, selectedTargets=[], locked=false;
  var labels={strike:'Strike',guard:'Guard',bash:'Bash',firebolt:'Fire Bolt',heal:'Heal'};
  function cardMeta(id){
    var c=E.CARDS[id]||{};
    if(id==='heal') return Object.assign({},c,{target:'self'});
    if(id==='guard') return Object.assign({},c,{target:'self'});
    return Object.assign({target:'enemy'},c);
  }
  function start(){
    selectedCard=null;selectedTargets=[];locked=false;
    battle=Core.create({
      playerUnits:[{id:'hero',name:'Novice',hp:50,maxHp:50,x:1,y:4}],
      enemyUnits:[
        {id:'poring-a',name:'Poring',hp:20,maxHp:20,x:8,y:3,moves:E.MONSTERS.poring.moves},
        {id:'poring-b',name:'Poring',hp:20,maxHp:20,x:8,y:6,moves:E.MONSTERS.poring.moves}
      ],
      deck:['strike','strike','strike','strike','guard','guard','guard','bash','firebolt','heal'],
      energy:3,drawPerTurn:5,rng:function(){return 0;}
    });
    $('battle-log').textContent='Two Porings appear. Choose a card to begin.';
    render();
  }
  function targetIds(card){
    var meta=cardMeta(card), source=battle.state.units.find(u=>u.id==='hero');
    if(meta.target==='self'||meta.target==='all-enemies'||meta.aoe)return [];
    return battle.state.units.filter(u=>u.side==='enemy'&&u.alive&&u.hp>0);
  }
  function useCard(index){
    if(locked||!battle)return;
    var id=battle.state.hand[index], meta=cardMeta(id);
    if(!id||meta.cost>battle.state.energy)return;
    if(meta.target==='enemy'&&!meta.aoe&&targetIds(id).length>Math.max(1,meta.targetCount||1)){
      selectedCard=index;selectedTargets=[];
      $('arena-help').textContent='Tap an enemy on the battlefield to choose the target.';
      $('battle-log').textContent='Choose a target for '+(labels[id]||id)+'.';
      render();return;
    }
    resolveCard(index,meta.target==='self'?['hero']:undefined);
  }
  function chooseTarget(id){
    if(selectedCard===null||locked)return;
    var cardId=battle.state.hand[selectedCard],meta=cardMeta(cardId);
    var valid=targetIds(cardId).some(u=>u.id===id);
    if(!valid)return;
    if(selectedTargets.indexOf(id)!==-1){
      $('battle-log').textContent='That enemy is already selected. Choose a different target.';
      return;
    }
    selectedTargets.push(id);
    if(selectedTargets.length>=Math.max(1,meta.targetCount||1))resolveCard(selectedCard,selectedTargets.slice());
    else $('battle-log').textContent='Choose '+(Math.max(1,meta.targetCount||1)-selectedTargets.length)+' more target(s).';
  }
  function resolveCard(index,targets){
    var result=battle.playCard(index,'hero',targets);
    if(!result.ok){$('battle-log').textContent='Cannot play card: '+result.reason;return;}
    selectedCard=null;selectedTargets=[];$('arena-help').textContent='Select an enemy when a card requires a target.';
    $('battle-log').textContent=result.events.map(e=>e.type==='damage'?'Damage to '+e.target+': '+e.result.hpDamage:e.type==='block'?'Block +'+e.amount:e.type==='heal'?'Heal +'+e.amount:e.type==='bleed'?'Bleed triggers on '+e.target:e.type).join(' · ')||'Card played.';
    if(result.over){locked=true;$('battle-log').textContent=result.over==='win'?'Victory! All enemies defeated.':'Defeat. Your party has fallen.';}
    render();
  }
  function render(){
    var s=battle.state,arena=$('arena');arena.innerHTML='';
    for(var y=0;y<10;y++)for(var x=0;x<10;x++){
      var cell=document.createElement('button');cell.type='button';cell.className='cell '+(x<5?'player-zone':'enemy-zone');cell.setAttribute('role','gridcell');cell.setAttribute('aria-label','Column '+(x+1)+', row '+(y+1));
      let unit=s.units.find(u=>u.x===x&&u.y===y&&u.alive);
      if(unit){
        cell.classList.add(unit.alive?'living':'dead');
        if(unit.side==='enemy'&&selectedCard!==null)cell.classList.add('targetable');
        var glyph=unit.side==='player'?'🛡️':'🩷';
        var unitView=document.createElement('span');unitView.className='unit';unitView.textContent=glyph;
        var hp=document.createElement('small');hp.textContent=Math.max(0,unit.hp)+' HP';unitView.appendChild(hp);
        var effects=[];
        (unit.statuses||[]).forEach(function(s){effects.push({label:(s.id==='vulnerable'?'VUL':s.id==='bleed'?'BLD':s.id==='stun'?'STN':s.id.toUpperCase())+' '+s.stacks,detail:s.id+' · '+s.stacks+' stack(s)'+(s.duration===null?'':' · '+s.duration+' turn(s)')});});
        (unit.buffs||[]).forEach(function(b){effects.push({label:(b.id||'BUFF').toUpperCase()+' '+(b.stacks||1),detail:(b.id||'Buff')+' · '+(b.stacks||1)+' stack(s)'+(b.duration===null||b.duration===undefined?'':' · '+b.duration+' turn(s)')+(b.disabled?' · disabled':'')});});
        if(effects.length){
          var badges=document.createElement('span');badges.className='unit-effects';
          badges.textContent=effects.map(function(e){return e.label;}).join(' ');
          badges.title=effects.map(function(e){return e.detail;}).join(' | ');
          unitView.appendChild(badges);
        }
        cell.appendChild(unitView);
        if(unit.side==='enemy'&&unit.intent){
          var intent=document.createElement('span');intent.className='unit-intent';
          intent.textContent=(unit.intent.name||'Intent')+(Number.isFinite(unit.intent.damage)?' · '+unit.intent.damage+' DMG':'');
          intent.title='Next action: '+(unit.intent.name||'Unknown')+(Number.isFinite(unit.intent.damage)?' · '+unit.intent.damage+' damage':'');
          cell.appendChild(intent);
        }
        if(unit.side==='enemy')cell.addEventListener('click',()=>chooseTarget(unit.id));
      }
      arena.appendChild(cell);
    }
    var hero=s.units.find(u=>u.id==='hero');
    $('hero-hp').textContent=hero.hp+' / '+hero.maxHp+' HP';$('hero-block').textContent='Block '+hero.block;
    $('energy').textContent='Energy '+s.energy;$('piles').textContent='Draw '+s.drawPile.length+' · Discard '+s.discardPile.length;
    $('round-label').textContent='Round '+s.round;$('phase-label').textContent=s.over?'Battle '+s.over:'Player turn';
    var hand=$('hand');hand.innerHTML='';
    s.hand.forEach((id,index)=>{
      var c=cardMeta(id),b=document.createElement('button');b.type='button';b.className='card '+(c.kind||'');b.disabled=locked||c.cost>s.energy;
      b.innerHTML='<small>'+c.cost+' Energy</small><strong>'+({strike:'⚔️',guard:'🛡️',bash:'🔨',firebolt:'🔥',heal:'💚'}[id]||'✦')+'</strong><b>'+(labels[id]||id)+'</b><small>'+(c.damage?c.damage+' damage':c.block?c.block+' block':c.heal?c.heal+' HP':'Skill')+'</small>';
      b.addEventListener('click',()=>useCard(index));hand.appendChild(b);
    });
    $('end-turn').disabled=locked||!!s.over;
  }
  $('end-turn').addEventListener('click',function(){
    if(locked)return;var r=battle.endTurn();
    $('battle-log').textContent=r.events.map(e=>e.type==='enemy-attack'?e.source+' attacks '+e.target+' for '+e.result.hpDamage+' damage':e.type).join(' · ')||'Enemy turn ends.';
    if(r.over){locked=true;$('battle-log').textContent=r.over==='win'?'Victory!':'Defeat.';}
    render();
  });
  $('restart').addEventListener('click',start);
  start();
})(typeof window!=='undefined'?window:globalThis);
