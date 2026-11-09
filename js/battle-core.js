/* LEGEND OF ELDORIA — Battle Core v2
 * Modular multi-unit rules engine. Kept separate from the legacy adapter until
 * the complete battlefield UI is ready, so existing saves and encounters remain safe.
 */
(function (root) {
  'use strict';
  var E = root.ELDORIA = root.ELDORIA || {};
  var BattleCore = {};

  var LIMITS = Object.freeze({ width: 10, height: 10, unitsPerSide: 5, totalUnits: 10, deckSize: 20, hand: 10, statusStacks: 99 });
  var SIDES = ['player', 'enemy'];
  var clone = function (v) { return JSON.parse(JSON.stringify(v)); };
  var integer = function (v, fallback) { return Number.isFinite(v) ? Math.floor(v) : fallback; };
  var clamp = function (v, lo, hi) { return Math.max(lo, Math.min(hi, v)); };
  function shuffle(a, rng) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function normalizeUnit(input, side, index) {
    if (!input || !input.id) throw new Error('Every battle unit requires a stable id.');
    var hp = Math.max(0, integer(input.hp, 1));
    var maxHp = Math.max(1, integer(input.maxHp, hp || 1));
    return {
      id: String(input.id), name: String(input.name || input.id), side: side,
      hp: clamp(hp, 0, maxHp), maxHp: maxHp, block: 0,
      x: integer(input.x, side === 'player' ? 1 : 8),
      y: integer(input.y, index + 2), range: input.range || 'middle',
      race: input.race || null, element: input.element || null,
      boss: !!input.boss, resistance: clone(input.resistance || {}),
      statuses: clone(input.statuses || []), buffs: clone(input.buffs || []),
      moves: clone(Array.isArray(input.moves) ? input.moves : []),
      intent: null, alive: hp > 0, summoned: !!input.summoned
    };
  }
  function validateDeck(deck, cards, rules) {
    rules = rules || {};
    var errors = [];
    if (!Array.isArray(deck)) return { valid: false, errors: ['Deck must be an array.'] };
    if (deck.length !== (rules.deckSize || LIMITS.deckSize)) errors.push('Deck must contain exactly ' + (rules.deckSize || LIMITS.deckSize) + ' cards.');
    var counts = Object.create(null);
    deck.forEach(function (id) {
      if (!cards[id]) { errors.push('Unknown card: ' + id); return; }
      var c = cards[id], key = id + '@' + (c.stars || 1);
      counts[key] = (counts[key] || 0) + 1;
      var max = c.rarity === 'Legendary' ? 1 : c.category === 'monster-special' ? 2 : 3;
      if (counts[key] > max) errors.push('Copy limit exceeded for ' + key + ' (max ' + max + ').');
    });
    return { valid: errors.length === 0, errors: errors };
  }
  function aliveUnits(state, side) {
    return state.units.filter(function (u) { return u.side === side && u.alive && u.hp > 0; });
  }
  function status(unit, id) {
    return unit.statuses.find(function (s) { return s.id === id && s.stacks > 0; });
  }
  function applyStatus(unit, effect) {
    var s = status(unit, effect.id), stacks = clamp(integer(effect.stacks, 1), 1, LIMITS.statusStacks);
    if (s) {
      s.stacks = clamp(s.stacks + stacks, 1, LIMITS.statusStacks);
      if (effect.duration !== undefined) s.duration = effect.duration;
      if (effect.tickAt !== undefined) s.tickAt = effect.tickAt;
    } else unit.statuses.push({ id: effect.id, stacks: stacks, duration: effect.duration === undefined ? null : effect.duration, tickAt: effect.tickAt === undefined ? null : effect.tickAt });
  }
  function damage(state, target, amount, kind) {
    amount = Math.max(0, integer(amount, 0));
    if (!target || !target.alive || target.hp <= 0) return { amount: 0, blocked: 0, hpDamage: 0, defeated: !!target && !target.alive };
    var vulnerable = status(target, 'vulnerable');
    if (vulnerable) amount = Math.round(amount * 1.5);
    var resistance = target.resistance[kind] || 0;
    if (target.boss && target.resistance[kind] === undefined && kind === 'status') resistance = 0;
    amount = Math.max(0, Math.round(amount * (1 - clamp(resistance, 0, 1))));
    var blocked = Math.min(target.block, amount);
    target.block -= blocked;
    var hpDamage = Math.min(target.hp, amount - blocked);
    target.hp -= hpDamage;
    target.alive = target.hp > 0;
    return { amount: amount, blocked: blocked, hpDamage: hpDamage, defeated: !target.alive };
  }
  function rangeAllowed(source, target, card, state) {
    if (!card.range || card.range === 'any') return true;
    var dx = Math.abs(source.x - target.x), dy = Math.abs(source.y - target.y);
    var distance = Math.max(dx, dy);
    var bands = state.config.rangeBands;
    if (!bands) return true; // mapping intentionally configurable; no unapproved cell distances.
    var band = distance <= bands.near ? 'near' : distance <= bands.middle ? 'middle' : 'far';
    return card.range === band || card.range === 'all';
  }
  function chooseTargets(state, sourceId, card, selectedIds) {
    var source = state.units.find(function (u) { return u.id === sourceId; });
    if (!source) return { ok: false, reason: 'source' };
    var candidates = aliveUnits(state, source.side === 'player' ? 'enemy' : 'player')
      .filter(function (u) { return rangeAllowed(source, u, card, state); });
    if (card.target === 'self') return { ok: true, targets: [source] };
    if (card.target === 'all-enemies' || card.aoe) return { ok: true, targets: candidates };
    var count = Math.max(1, integer(card.targetCount, 1));
    if (candidates.length <= count) return { ok: true, targets: candidates };
    if (!Array.isArray(selectedIds)) return { ok: false, reason: 'select-targets', candidates: candidates.map(function (u) { return u.id; }), required: count };
    var selected = selectedIds.slice(0, count).map(function (id) { return candidates.find(function (u) { return u.id === id; }); });
    if (selected.some(function (u) { return !u; }) || selected.length !== count) return { ok: false, reason: 'invalid-targets' };
    return { ok: true, targets: selected };
  }
  function revealIntents(state) {
    aliveUnits(state, 'enemy').forEach(function (enemy) {
      var moves = enemy.moves || [];
      if (moves.length) enemy.intent = clone(moves[Math.floor(state.rng() * moves.length)]);
    });
  }
  function triggerBleed(unit, events) {
    var bleed = status(unit, 'bleed');
    if (!bleed) return;
    var tick = damage(null, unit, bleed.stacks, 'true');
    events.push({ type: 'bleed', target: unit.id, result: tick });
  }
  function draw(state, n) {
    var drawn = [];
    while (n-- > 0 && state.hand.length < LIMITS.hand) {
      if (!state.drawPile.length) {
        if (!state.discardPile.length) break;
        state.drawPile = shuffle(state.discardPile.splice(0), state.rng);
      }
      if (!state.drawPile.length) break;
      var id = state.drawPile.pop(); state.hand.push(id); drawn.push(id);
    }
    return drawn;
  }
  function startTurn(state, side) {
    state.activeSide = side;
    state.units.forEach(function (u) {
      if (u.side !== side || !u.alive) return;
      u.block = 0;
      // Duration decrements are effect-specific and only tick at configured boundaries.
      u.statuses = u.statuses.filter(function (s) {
        if (s.tickAt !== side + '-turn-start' || s.duration === null) return true;
        s.duration -= 1; return s.duration > 0;
      });
      u.buffs = u.buffs.filter(function (b) {
        if (b.tickAt !== side + '-turn-start' || b.duration === null) return true;
        b.duration -= 1; return b.duration > 0;
      });
    });
    if (side === 'player') {
      state.energy = state.config.energy;
      draw(state, state.config.drawPerTurn);
      state.turn += 1;
    }
  }
  function create(config) {
    config = config || {};
    var rng = typeof config.rng === 'function' ? config.rng : Math.random;
    var playerUnits = (config.playerUnits || []).map(function (u, i) { return normalizeUnit(u, 'player', i); });
    var enemyUnits = (config.enemyUnits || []).map(function (u, i) { return normalizeUnit(u, 'enemy', i); });
    if (!playerUnits.length || !enemyUnits.length) throw new Error('Battle requires at least one unit on each side.');
    if (playerUnits.length > LIMITS.unitsPerSide || enemyUnits.length > LIMITS.unitsPerSide || playerUnits.length + enemyUnits.length > LIMITS.totalUnits) throw new Error('Battle unit slot limit exceeded.');
    var units = playerUnits.concat(enemyUnits);
    var unitIds = Object.create(null), occupied = Object.create(null);
    units.forEach(function (u) {
      if (unitIds[u.id]) throw new Error('Duplicate battle unit id: ' + u.id);
      unitIds[u.id] = true;
      if (u.x < 0 || u.x >= LIMITS.width || u.y < 0 || u.y >= LIMITS.height) throw new Error('Unit position is outside the 10x10 battlefield: ' + u.id);
      if ((u.side === 'player' && u.x >= 5) || (u.side === 'enemy' && u.x < 5)) throw new Error('Unit is placed on the wrong side of the battlefield: ' + u.id);
      var cell = u.x + ',' + u.y;
      if (u.alive && occupied[cell]) throw new Error('Battlefield cell is already occupied: ' + cell);
      if (u.alive) occupied[cell] = true;
    });
    var state = {
      turn: 0, round: 1, activeSide: 'player', over: null, winner: null,
      units: units, energy: 0, hand: [], drawPile: (config.deck || []).slice(), discardPile: [],
      config: { energy: config.energy === undefined ? 3 : config.energy, drawPerTurn: config.drawPerTurn === undefined ? 5 : config.drawPerTurn, rangeBands: config.rangeBands || null },
      rng: rng, log: []
    };
    shuffle(state.drawPile, rng);
    revealIntents(state);
    startTurn(state, 'player');
    function finishCheck() {
      if (!aliveUnits(state, 'player').length) { state.over = 'lose'; state.winner = 'enemy'; }
      else if (!aliveUnits(state, 'enemy').length) { state.over = 'win'; state.winner = 'player'; }
    }
        finishCheck(); // Resolve battles that begin with a side already defeated.
function playCard(index, sourceId, selectedIds) {
      if (state.over) return { ok: false, reason: 'over' };
      if (state.activeSide !== 'player') return { ok: false, reason: 'turn' };
      var id = state.hand[index], card = E.CARDS[id];
      if (!id || !card) return { ok: false, reason: 'card' };
      var source = state.units.find(function (u) { return u.id === (sourceId || playerUnits[0].id); });
      if (!source || source.side !== 'player' || !source.alive) return { ok: false, reason: 'source' };
      if (status(source, 'stun')) return { ok: false, reason: 'stunned' };
      if (card.cost > state.energy) return { ok: false, reason: 'energy' };
      var targetResult = chooseTargets(state, source.id, card, selectedIds);
      if (!targetResult.ok) return targetResult;
      state.energy -= card.cost; state.hand.splice(index, 1); state.discardPile.push(id);
      var events = [];
      var targets = targetResult.targets;
      var madeAttack = !!card.damage;
      targets.forEach(function (target) {
        var hits = Math.max(1, integer(card.hits, 1));
        for (var h = 0; h < hits && target.alive; h++) {
          if (card.damage) events.push({ type: 'damage', target: target.id, result: damage(state, target, card.damage, card.damageType || 'physical') });
        }
        // Card-applied statuses resolve once per target per card, not once per hit.
        (card.statuses || []).forEach(function (effect) { if (target.alive) applyStatus(target, effect); });
      });
      if (madeAttack) triggerBleed(source, events);
      if (card.block) { source.block += card.block; events.push({ type: 'block', target: source.id, amount: card.block }); }
      if (card.heal) { var before = source.hp; source.hp = Math.min(source.maxHp, source.hp + card.heal); events.push({ type: 'heal', target: source.id, amount: source.hp - before }); }
      finishCheck(); state.log.push({ turn: state.turn, card: id, events: clone(events) });
      return { ok: true, events: events, over: state.over };
    }
    function endTurn() {
      if (state.over || state.activeSide !== 'player') return { ok: false, reason: 'over-or-turn' };
      while (state.hand.length) state.discardPile.push(state.hand.pop());
      startTurn(state, 'enemy');
      var events = [];
      aliveUnits(state, 'enemy').forEach(function (enemy) {
        if (status(enemy, 'stun')) return;
        var intent = enemy.intent;
        if (!intent) {
          var moves = enemy.moves || [];
          if (!moves.length) return;
          intent = moves[Math.floor(rng() * moves.length)];
        }
        enemy.intent = clone(intent);
        var targets = aliveUnits(state, 'player');
        if (!targets.length) return;
        var target = targets[Math.floor(rng() * targets.length)];
        var dealt = damage(state, target, intent.damage || 0, intent.damageType || 'physical');
        events.push({ type: 'enemy-attack', source: enemy.id, target: target.id, result: dealt });
        // Bleed triggers once for each attack action made by the afflicted unit.
        triggerBleed(enemy, events);
      });
      finishCheck();
      if (!state.over) { revealIntents(state); state.round += 1; startTurn(state, 'player'); }
      return { ok: true, events: events, over: state.over };
    }
    function summon(unit) {
      if (state.over) return { ok: false, reason: 'over' };
      var side = unit.side || 'player', same = aliveUnits(state, side);
      if (SIDES.indexOf(side) < 0 || !unit.id || state.units.some(function (u) { return u.id === String(unit.id); })) return { ok: false, reason: 'invalid-unit' };
      if (!Number.isInteger(unit.x) || !Number.isInteger(unit.y) || unit.x < 0 || unit.x >= LIMITS.width || unit.y < 0 || unit.y >= LIMITS.height || (side === 'player' && unit.x >= 5) || (side === 'enemy' && unit.x < 5)) return { ok: false, reason: 'position' };
      if (same.length >= LIMITS.unitsPerSide || state.units.length >= LIMITS.totalUnits) return { ok: false, reason: 'slots' };
      if (state.units.some(function (u) { return u.x === unit.x && u.y === unit.y && u.alive; })) return { ok: false, reason: 'occupied' };
      var added = normalizeUnit(Object.assign({}, unit, { summoned: true }), side, same.length);
      state.units.push(added); return { ok: true, unit: added };
    }
    return { state: state, playCard: playCard, endTurn: endTurn, summon: summon, applyStatus: applyStatus };
  }

  BattleCore.LIMITS = LIMITS;
  BattleCore.validateDeck = validateDeck;
  BattleCore.create = create;
  BattleCore.applyStatus = applyStatus;
  BattleCore.damage = damage;
  E.BattleCore = BattleCore;
  if (typeof module !== 'undefined' && module.exports) module.exports = BattleCore;
})(typeof window !== 'undefined' ? window : globalThis);
