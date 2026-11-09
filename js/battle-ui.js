/* Legend of Eldoria — live single-enemy adapter for Battle Core v2.
   The existing encounter screen remains visually compatible while using the
   new deterministic rules engine. Multi-unit presentation remains in its harness. */
(function (root) {
  'use strict';
  var E = root.ELDORIA, Core = E.BattleCore;
  function $(id) { return document.getElementById(id); }
  var battle = null, onEnd = null, locked = false, monsterId = null, monsterIds = [], selectedCard = null, selectedTargets = [];

  function flash(el, cls) {
    el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
    setTimeout(function () { el.classList.remove(cls); }, 450);
  }
  function pop(who, text, cls) {
    var host = who === 'enemy' ? $('enemy-stage') : $('player-panel');
    var el = document.createElement('div'); el.className = 'pop ' + cls; el.textContent = text;
    if (who === 'player') { el.style.top = '-30px'; el.style.left = '45%'; }
    host.style.position = 'relative'; host.appendChild(el);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 950);
  }
  function setLog(messages) { $('battle-log').textContent = messages.join(' '); }
  function unit(id) { return battle.state.units.find(function (u) { return u.id === id; }); }
  function effectDetails(u) {
    var effects = [];
    (u.statuses || []).forEach(function (s) {
      var label = s.id === 'vulnerable' ? 'VUL' : s.id === 'bleed' ? 'BLD' : s.id === 'stun' ? 'STN' : s.id.toUpperCase();
      effects.push({ label: label + ' ' + s.stacks, detail: s.id + ' · ' + s.stacks + ' stack(s)' + (s.duration === null ? '' : ' · ' + s.duration + ' turn(s)') });
    });
    (u.buffs || []).forEach(function (b) {
      effects.push({ label: (b.id || 'BUFF').toUpperCase() + ' ' + (b.stacks || 1), detail: (b.id || 'Buff') + ' · ' + (b.stacks || 1) + ' stack(s)' + (b.duration === null || b.duration === undefined ? '' : ' · ' + b.duration + ' turn(s)') + (b.disabled ? ' · disabled' : '') + (Number.isInteger(b.charges) ? ' · ' + b.charges + ' charge(s)' : '') });
    });
    return effects;
  }
  function renderEffects(id, u) {
    var host = $(id), effects = effectDetails(u);
    host.textContent = effects.length ? 'Effects: ' + effects.map(function (e) { return e.label; }).join(' · ') : '';
    host.title = effects.map(function (e) { return e.detail; }).join(' | ');
  }
  function statusText(u) {
    return effectDetails(u).map(function (e) { return e.label; }).join(' · ');
  }
  function renderBattlefield() {
    var arena = $('live-battlefield');
    if (!arena) return;
    arena.innerHTML = '';
    for (var y = 0; y < 10; y++) {
      for (var x = 0; x < 10; x++) {
        var cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'live-cell ' + (x < 5 ? 'player-zone' : 'enemy-zone');
        cell.setAttribute('role', 'gridcell');
        cell.setAttribute('aria-label', 'Column ' + (x + 1) + ', row ' + (y + 1));
        var occupant = battle.state.units.find(function (u) { return u.alive && u.x === x && u.y === y; });
        if (occupant) {
          if (occupant.side === 'enemy' && selectedCard !== null) cell.classList.add('targetable');
          var marker = document.createElement('span');
          marker.className = 'live-unit ' + occupant.side;
          marker.textContent = occupant.side === 'player' ? '🛡️' : '🩷';
          var hp = document.createElement('small');
          hp.textContent = occupant.hp + '/' + occupant.maxHp;
          marker.appendChild(hp);
          cell.appendChild(marker);
          var effects = effectDetails(occupant);
          if (effects.length) {
            var badges = document.createElement('small');
            badges.className = 'live-unit-effects';
            badges.textContent = effects.map(function (e) { return e.label; }).join(' · ');
            badges.title = effects.map(function (e) { return e.detail; }).join(' | ');
            cell.appendChild(badges);
          }
          if (occupant.side === 'enemy' && occupant.intent) {
            var intent = document.createElement('small');
            intent.className = 'live-unit-intent';
            intent.textContent = occupant.intent.name + (Number.isFinite(occupant.intent.damage) ? ' ' + occupant.intent.damage : '');
            intent.title = 'Next: ' + occupant.intent.name + (Number.isFinite(occupant.intent.damage) ? ' · ' + occupant.intent.damage + ' damage' : '');
            cell.appendChild(intent);
          }
        }
        if (occupant && occupant.side === 'enemy') {
          var targetId = occupant.id;
          cell.addEventListener('click', function () { chooseTarget(targetId); });
        }
        arena.appendChild(cell);
      }
    }
  }
  function render() {
    var s = battle.state, hero = unit('hero'), enemies = s.units.filter(function (u) { return u.side === 'enemy'; }), enemy = enemies[0];
    renderBattlefield();
    $('enemy-name').textContent = enemies.length > 1 ? enemies.length + ' Enemies' : enemy.name;
    $('enemy-hp-fill').style.width = (enemy ? 100 * enemy.hp / enemy.maxHp : 0) + '%';
    $('enemy-hp-text').textContent = enemies.length > 1 ? enemies.filter(function(u){return u.alive;}).length + ' / ' + enemies.length + ' alive' : enemy.hp + ' / ' + enemy.maxHp;
    $('enemy-intent').textContent = enemies.filter(function(u){return u.alive && u.intent;}).map(function(u){return u.name + ': ' + u.intent.name + (Number.isFinite(u.intent.damage) ? ' ' + u.intent.damage : '');}).join(' · ');
    $('enemy-intent').style.visibility = s.over ? 'hidden' : 'visible';
    renderEffects('enemy-status', enemy || {statuses:[],buffs:[]});
    $('player-hp-fill').style.width = (100 * hero.hp / hero.maxHp) + '%';
    $('player-hp-text').textContent = 'You  ' + hero.hp + ' / ' + hero.maxHp;
    renderEffects('player-status', hero);
    var blk = $('player-block'); blk.textContent = '\uD83D\uDEE1\uFE0F ' + hero.block;
    blk.classList.toggle('zero', hero.block === 0);
    var orbs = '';
    for (var i = 0; i < E.RULES.energy; i++) orbs += i < s.energy ? '\u25CF' : '\u25CB';
    $('player-energy').textContent = '\u26A1 ' + orbs;
    $('piles').textContent = 'Draw ' + s.drawPile.length + '  Discard ' + s.discardPile.length;
    var hand = $('hand'); hand.innerHTML = '';
    s.hand.forEach(function (id, idx) {
      var c = E.CARDS[id], b = document.createElement('button');
      b.type = 'button'; b.className = 'card ' + c.kind + (c.cost > s.energy || s.over || locked ? ' disabled' : '');
      b.disabled = c.cost > s.energy || !!s.over || locked || (selectedCard !== null && idx !== selectedCard);
      if (selectedCard === idx) b.classList.add('selected');
      b.innerHTML = '<span class="cost">' + c.cost + '</span><span class="icon">' + c.icon +
        '</span><span class="name">' + c.name + '</span><span class="text">' + c.text + '</span>';
      b.addEventListener('click', function () { onCard(idx); }); hand.appendChild(b);
    });
    $('btn-end-turn').disabled = !!s.over || locked;
  }
  function describe(events) {
    return events.map(function (e) {
      if (e.type === 'damage') return 'Hit ' + e.target + ' for ' + e.result.hpDamage + ' damage.';
      if (e.type === 'block') return 'Gain ' + e.amount + ' Block.';
      if (e.type === 'heal') return 'Restore ' + e.amount + ' HP.';
      if (e.type === 'enemy-attack') return e.source + ' uses its intent on ' + e.target + ' for ' + e.result.hpDamage + ' damage.';
      if (e.type === 'bleed') return 'Bleed deals ' + e.result.hpDamage + ' damage to ' + e.target + '.';
      return e.type + '.';
    });
  }
  function finishIfOver() {
    var s = battle.state; if (!s.over) return false;
    locked = true; render();
    if (s.over === 'win') $('enemy-sprite').classList.add('dead');
    var result = { won: s.over === 'win', monsterId: monsterId, monsterIds: monsterIds.slice(), hp: unit('hero').hp, maxHp: unit('hero').maxHp };
    setTimeout(function () { if (onEnd) onEnd(result); }, 900);
    return true;
  }
  function onCard(idx) {
    if (locked) return;
    var cardId = battle.state.hand[idx], card = E.CARDS[cardId] || {};
    var needsSelection = card.target !== 'self' && card.target !== 'all-enemies' && !card.aoe && (card.damage || card.statuses) && battle.state.units.filter(function(u){return u.side === 'enemy' && u.alive;}).length > Math.max(1, Number(card.targetCount) || 1);
    if (needsSelection) { selectedCard = idx; selectedTargets = []; setLog(['Choose ' + Math.max(1, Number(card.targetCount) || 1) + ' enemy target(s).']); render(); return; }
    var res = battle.playCard(idx, 'hero');
    if (!res.ok) { setLog([res.reason === 'energy' ? 'Not enough energy.' : res.reason === 'stunned' ? 'You are stunned and cannot act.' : 'Cannot play that card.']); return; }
    setLog(describe(res.events));
    res.events.forEach(function (e) {
      if (e.type === 'damage') { pop('enemy', '-' + e.result.hpDamage, 'dmg'); flash($('enemy-sprite'), 'hit'); }
      if (e.type === 'block') pop('player', '+' + e.amount, 'blk');
      if (e.type === 'heal') pop('player', '+' + e.amount, 'heal');
      if (e.type === 'bleed') pop('player', '-' + e.result.hpDamage, 'dmg');
    });
    render(); finishIfOver();
  }
  function chooseTarget(id) {
    if (locked || selectedCard === null) return;
    var candidates = battle.state.units.filter(function(u){return u.side === 'enemy' && u.alive;});
    if (!candidates.some(function(u){return u.id === id;})) return;
    if (selectedTargets.indexOf(id) >= 0) { setLog(['That enemy is already selected.']); return; }
    selectedTargets.push(id);
    var required = Math.max(1, Number((E.CARDS[battle.state.hand[selectedCard]] || {}).targetCount) || 1);
    if (selectedTargets.length < required) { setLog(['Choose ' + (required-selectedTargets.length) + ' more target(s).']); render(); return; }
    var idx = selectedCard, targets = selectedTargets.slice(); selectedCard = null; selectedTargets = [];
    var res = battle.playCard(idx, 'hero', targets);
    if (!res.ok) { setLog(['Cannot play that card: ' + res.reason]); render(); return; }
    setLog(describe(res.events)); render(); finishIfOver();
  }
  function onEndTurn() {
    if (locked) return;
    var res = battle.endTurn(); if (!res.ok) return;
    setLog(describe(res.events));
    res.events.forEach(function (e) { if (e.type === 'enemy-attack') { flash($('enemy-sprite'), 'attack'); pop('player', '-' + e.result.hpDamage, e.result.hpDamage ? 'dmg' : 'blk'); } });
    render(); finishIfOver();
  }
  var wired = false;
  function wire() { if (wired) return; wired = true; $('btn-end-turn').addEventListener('click', onEndTurn); }
  function start(playerState, id, cb) {
    if (!Core) throw new Error('Battle Core v2 must load before Battle UI.');
    wire(); onEnd = cb; locked = false; monsterId = id; monsterIds = [id]; selectedCard = null; selectedTargets = [];
    $('enemy-sprite').classList.remove('dead', 'hit', 'attack');
    var def = E.MONSTERS[id];
    createBattle(playerState, [{ id: 'enemy', monsterId: id, x: 8, y: 4 }]);
    setLog(['A wild ' + def.name + ' appears!']); render(); finishIfOver();
  }
  function createBattle(playerState, encounterUnits) {
    battle = Core.create({
      playerUnits: [{ id: 'hero', name: 'Novice', hp: playerState.hp, maxHp: playerState.maxHp, x: 1, y: 4 }],
      enemyUnits: encounterUnits.map(function(entry, index){ var def = E.MONSTERS[entry.monsterId]; if (!def) throw new Error('Unknown monster: ' + entry.monsterId); return { id: entry.id || 'enemy-' + index, name: def.name, hp: def.hp, maxHp: def.hp, x: entry.x === undefined ? 8 : entry.x, y: entry.y === undefined ? index + 2 : entry.y, moves: def.moves, boss: !!def.boss, resistance: def.resistance || {} }; }),
      deck: E.STARTER_DECK, energy: E.RULES.energy, drawPerTurn: E.RULES.handSize
    });
  }
  function startEncounter(playerState, encounterUnits, cb) {
    if (!Array.isArray(encounterUnits) || !encounterUnits.length || encounterUnits.length > Core.LIMITS.unitsPerSide) throw new Error('Encounter must contain 1–5 enemy units.');
    monsterIds = encounterUnits.map(function(e){return e.monsterId;}); monsterId = monsterIds[0];
    wire(); onEnd = cb; locked = false; selectedCard = null; selectedTargets = [];
    $('enemy-sprite').classList.remove('dead', 'hit', 'attack');
    createBattle(playerState, encounterUnits);
    setLog(['An enemy group approaches!']); render(); finishIfOver();
  }
  E.BattleUI = { start: start, startEncounter: startEncounter };
})(typeof window !== 'undefined' ? window : globalThis);
