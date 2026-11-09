/* Legend of Eldoria - Combat Effect Integration
   Deterministic turn-based combat rules; no DOM dependencies. */
(function (root) {
  var E = root.ELDORIA = root.ELDORIA || {};

  function shuffle(arr, rng) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function cloneCardInstance(value) {
    if (typeof value === 'string') return { id: value, stars: 1 };
    return { id: value.id || value.cardId, stars: Math.max(1, Math.min(3, Number(value.stars) || 1)) };
  }

  function statusOf(target, type) {
    return target.statuses && target.statuses[type] ? target.statuses[type] : null;
  }

  function applyStatus(target, type, stacks, duration) {
    if (!target.statuses) target.statuses = {};
    var current = target.statuses[type];
    var nextStacks = Math.max(0, Math.min(99, (current ? current.stacks : 0) + stacks));
    if (!nextStacks) {
      delete target.statuses[type];
      return nextStacks;
    }
    // Bleed is explicitly permanent; Vulnerable uses its supplied finite duration.
    var nextDuration = type === 'bleed' ? null : duration;
    if (current && type !== 'bleed') nextDuration = duration;
    target.statuses[type] = { stacks: nextStacks, duration: nextDuration == null ? null : Math.max(1, nextDuration) };
    return nextStacks;
  }

  function removeOneStack(target, type) {
    var current = statusOf(target, type);
    if (!current) return 0;
    current.stacks = Math.max(0, current.stacks - 1);
    if (!current.stacks) delete target.statuses[type];
    return current.stacks;
  }

  function decayTimedStatuses(target) {
    if (!target.statuses) return;
    Object.keys(target.statuses).forEach(function (type) {
      var status = target.statuses[type];
      if (status.duration == null) return;
      status.duration -= 1;
      if (status.duration <= 0) delete target.statuses[type];
    });
  }

  function damageMultiplier(target) {
    return statusOf(target, 'vulnerable') ? 1.5 : 1;
  }

  // Exposed for deterministic tests and future status-effect integrations.
  E.applyCombatStatus = applyStatus;

  E.createBattle = function (cfg) {
    var rng = cfg.rng || Math.random;
    var def = E.MONSTERS[cfg.monsterId];
    var rules = E.RULES;
    var s = {
      turn: 0, over: null,
      player: { hp: cfg.player.hp, maxHp: cfg.player.maxHp, block: 0, energy: rules.energy, statuses: {} },
      enemy: { id: def.id, name: def.name, hp: def.hp, maxHp: def.hp, intent: null, statuses: {} },
      drawPile: shuffle(cfg.deck.map(cloneCardInstance), rng),
      discardPile: [], hand: []
    };

    function drawCards(n) {
      for (var i = 0; i < n; i++) {
        if (!s.drawPile.length) {
          if (!s.discardPile.length) break;
          s.drawPile = shuffle(s.discardPile, rng);
          s.discardPile = [];
        }
        s.hand.push(s.drawPile.pop());
      }
    }

    function pickIntent() {
      var mv = def.moves[Math.floor(rng() * def.moves.length)];
      s.enemy.intent = { name: mv.name, damage: mv.damage };
    }

    function startPlayerTurn() {
      s.turn++;
      s.player.block = 0;
      s.player.energy = rules.energy;
      drawCards(rules.handSize);
    }

    function dealDamage(target, baseDamage) {
      var actual = Math.max(0, Math.round(baseDamage * damageMultiplier(target)));
      var dealt = Math.min(actual, target.hp);
      target.hp = Math.max(0, target.hp - dealt);
      return { amount: dealt, calculated: actual };
    }

    function playCard(handIndex) {
      var res = { ok: false, msgs: [], pops: [] };
      if (s.over) { res.reason = 'over'; return res; }
      var instance = s.hand[handIndex];
      if (!instance) { res.reason = 'nocard'; return res; }
      var card = E.CARDS[instance.id];
      if (!card) { res.reason = 'unknown-card'; return res; }
      if (card.cost > s.player.energy) { res.reason = 'energy'; return res; }

      var stars = instance.stars || 1;
      var prePlayHp = s.enemy.hp;
      var hadVulnerable = !!statusOf(s.enemy, 'vulnerable');
      var hadBleed = !!statusOf(s.enemy, 'bleed');
      s.player.energy -= card.cost;
      s.hand.splice(handIndex, 1);
      s.discardPile.push(instance);
      res.ok = true;

      var damage = card.damage || 0;
      if (damage) {
        var hit = dealDamage(s.enemy, damage);
        res.msgs.push(card.name + ' hits ' + s.enemy.name + ' for ' + hit.amount + ' damage.');
        res.pops.push({ who: 'enemy', text: '-' + hit.amount, cls: 'dmg' });
      }
      if (card.id === 'msc-por-001' && stars >= 3 && hadVulnerable && s.enemy.hp > 0) {
        var bonusHit = dealDamage(s.enemy, 3);
        res.msgs.push('Slime Splash bonus hit deals ' + bonusHit.amount + ' damage.');
        res.pops.push({ who: 'enemy', text: '-' + bonusHit.amount, cls: 'dmg' });
      }

      if (card.block) {
        s.player.block += card.block;
        res.msgs.push('You gain ' + card.block + ' block.');
        res.pops.push({ who: 'player', text: '+' + card.block, cls: 'blk' });
      }
      if (card.heal) {
        var before = s.player.hp;
        s.player.hp = Math.min(s.player.maxHp, s.player.hp + card.heal);
        var healed = s.player.hp - before;
        res.msgs.push('You restore ' + healed + ' HP.');
        res.pops.push({ who: 'player', text: '+' + healed, cls: 'heal' });
      }

      (card.statusEffects || []).forEach(function (effect) {
        if (effect.type === 'bleed' || effect.type === 'vulnerable') {
          applyStatus(s.enemy, effect.type, effect.stacks || 1, effect.duration);
          res.msgs.push(s.enemy.name + ' gains ' + effect.type + ' (' + s.enemy.statuses[effect.type].stacks + ').');
        }
      });

      if (card.id === 'msc-wolf-001' && stars >= 2 && prePlayHp * 100 <= s.enemy.maxHp * 50) {
        applyStatus(s.enemy, 'bleed', 1);
        res.msgs.push('Savage Bite applies 1 additional Bleed stack.');
      }
      if (card.id === 'msc-wolf-001' && stars >= 3 && hadBleed) {
        applyStatus(s.enemy, 'vulnerable', 1, 1);
        res.msgs.push(s.enemy.name + ' becomes Vulnerable.');
      }
      if (card.id === 'msc-por-001' && stars >= 2) {
        res.msgs.push('Slime Splash deals Water-element damage.');
      }

      if (s.enemy.hp <= 0) {
        s.over = 'win';
        res.msgs.push(s.enemy.name + ' is defeated!');
      }
      return res;
    }

    function endTurn() {
      var res = { ok: false, msgs: [], pops: [] };
      if (s.over) return res;
      res.ok = true;

      while (s.hand.length) s.discardPile.push(s.hand.pop());
      // Timed effects on the player expire at the end of the player's turn.
      decayTimedStatuses(s.player);

      var it = s.enemy.intent;
      var bleed = statusOf(s.enemy, 'bleed');
      if (bleed) {
        var bleedDamage = Math.min(s.enemy.hp, bleed.stacks);
        s.enemy.hp -= bleedDamage;
        var remaining = removeOneStack(s.enemy, 'bleed');
        res.msgs.push(s.enemy.name + ' takes ' + bleedDamage + ' Bleed damage' + (remaining ? ' (' + remaining + ' stacks left).' : '.'));
        res.pops.push({ who: 'enemy', text: '-' + bleedDamage, cls: 'dmg' });
        if (s.enemy.hp <= 0) {
          s.over = 'win';
          res.msgs.push(s.enemy.name + ' is defeated by Bleed before it can attack!');
          return res;
        }
      }

      var rawDamage = it.damage;
      var modifiedDamage = Math.round(rawDamage * damageMultiplier(s.player));
      var absorbed = Math.min(s.player.block, modifiedDamage);
      var through = modifiedDamage - absorbed;
      s.player.block -= absorbed;
      s.player.hp = Math.max(0, s.player.hp - through);
      res.attack = true;
      res.msgs.push(s.enemy.name + ' uses ' + it.name + ': ' +
        (through > 0 ? through + ' damage' : 'fully blocked') +
        (absorbed > 0 && through > 0 ? ' (' + absorbed + ' blocked)' : '') + '.');
      res.pops.push({ who: 'player', text: through > 0 ? '-' + through : 'Blocked', cls: through > 0 ? 'dmg' : 'blk' });

      // Enemy's finite-duration effects expire after its action. Bleed has no timer.
      decayTimedStatuses(s.enemy);
      if (s.player.hp <= 0) {
        s.over = 'lose';
        res.msgs.push('You fall...');
        return res;
      }
      pickIntent();
      startPlayerTurn();
      return res;
    }

    pickIntent();
    startPlayerTurn();
    return { state: s, playCard: playCard, endTurn: endTurn };
  };

  E.rollRewards = function (monsterId, rng) {
    rng = rng || Math.random;
    var def = E.MONSTERS[monsterId];
    var gold = def.gold[0] + Math.floor(rng() * (def.gold[1] - def.gold[0] + 1));
    var drops = [];
    def.drops.forEach(function (d) {
      if (rng() < d.chance) drops.push({ id: d.id, name: d.name });
    });
    return { exp: def.exp, gold: gold, drops: drops };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = E;
})(typeof window !== 'undefined' ? window : globalThis);
