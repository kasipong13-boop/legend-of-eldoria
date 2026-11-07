/* Legend of Eldoria - Prototype 0.1
   battle.js: turn-based card battle rules. No DOM here, so it can be tested alone. */
(function (root) {
  var E = root.ELDORIA = root.ELDORIA || {};

  function shuffle(arr, rng) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  // cfg: { player: {hp, maxHp}, monsterId, deck: [cardIds], rng? }
  E.createBattle = function (cfg) {
    var rng = cfg.rng || Math.random;
    var def = E.MONSTERS[cfg.monsterId];
    var rules = E.RULES;

    var s = {
      turn: 0,
      over: null, // null | 'win' | 'lose'
      player: { hp: cfg.player.hp, maxHp: cfg.player.maxHp, block: 0, energy: rules.energy },
      enemy: { id: def.id, name: def.name, hp: def.hp, maxHp: def.hp, intent: null },
      drawPile: shuffle(cfg.deck.slice(), rng),
      discardPile: [],
      hand: []
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

    // Returns { ok, reason?, msgs: [], pops: [{who, text, cls}] }
    function playCard(handIndex) {
      var res = { ok: false, msgs: [], pops: [] };
      if (s.over) { res.reason = 'over'; return res; }
      var id = s.hand[handIndex];
      if (id === undefined) { res.reason = 'nocard'; return res; }
      var card = E.CARDS[id];
      if (card.cost > s.player.energy) { res.reason = 'energy'; return res; }

      s.player.energy -= card.cost;
      s.hand.splice(handIndex, 1);
      s.discardPile.push(id);
      res.ok = true;

      if (card.damage) {
        var dealt = Math.min(card.damage, s.enemy.hp);
        s.enemy.hp -= dealt;
        res.msgs.push(card.name + ' hits ' + s.enemy.name + ' for ' + card.damage + '.');
        res.pops.push({ who: 'enemy', text: '-' + card.damage, cls: 'dmg' });
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

      // discard hand
      while (s.hand.length) s.discardPile.push(s.hand.pop());

      // enemy acts
      var it = s.enemy.intent;
      var absorbed = Math.min(s.player.block, it.damage);
      var through = it.damage - absorbed;
      s.player.block -= absorbed;
      s.player.hp = Math.max(0, s.player.hp - through);
      res.attack = true;
      res.msgs.push(s.enemy.name + ' uses ' + it.name + ': ' +
        (through > 0 ? through + ' damage' : 'fully blocked') +
        (absorbed > 0 && through > 0 ? ' (' + absorbed + ' blocked)' : '') + '.');
      res.pops.push({ who: 'player', text: through > 0 ? '-' + through : 'Blocked', cls: through > 0 ? 'dmg' : 'blk' });

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

  // Rewards after a win: returns { exp, gold, drops: [{id,name}] }
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
